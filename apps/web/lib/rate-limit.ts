import { db } from "@repo/db";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
}

/**
 * Postgres-backed fixed-window rate limiter.
 *
 * Uses a single atomic UPSERT so concurrent callers across multiple instances
 * all share the same counter.
 *
 * **Hybrid failure mode (OWASP-aligned).** On a DB error the behavior depends
 * on `opts.failClosed`:
 *   • Auth-sensitive keys (login / password-reset / resend-verification) pass
 *     `{ failClosed: true }` → on DB error the function **fails CLOSED**
 *     (returns allowed=false) so a Postgres hiccup cannot become a window for
 *     unthrottled credential-stuffing / brute-force / abuse.
 *   • All other keys (marketplace, invite, register, cr-lookup, …) omit the
 *     option and **fail OPEN** (returns allowed=true) so a transient DB blip
 *     never locks legitimate users out of non-security-critical flows.
 *
 * @param key       Unique limiter key, e.g. "login:user@example.com" or "invite:<orgId>"
 * @param limit     Max requests allowed inside the window
 * @param windowMs  Window size in milliseconds
 * @param opts      Optional behavior flags. `failClosed: true` → deny on DB error.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  opts?: { failClosed?: boolean },
): Promise<RateLimitResult> {
  try {
    const expiresAt = new Date(Date.now() + windowMs);

    // Single atomic statement:
    //   • If no row exists → insert with count=1 and a fresh window.
    //   • If a row exists but the window has expired → reset count=1 and start a new window.
    //   • If a row exists and the window is still live → increment count.
    // RETURNING gives us the post-update count and the active expiresAt so we
    // can compute retryAfterMs without a second round-trip.
    const rows = await db.$queryRaw<{ count: number; expiresAt: Date }[]>`
      INSERT INTO "RateLimitCounter" ("key", "count", "windowStart", "expiresAt", "updatedAt")
      VALUES (${key}, 1, now(), ${expiresAt}, now())
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "RateLimitCounter"."expiresAt" <= now() THEN 1
          ELSE "RateLimitCounter"."count" + 1
        END,
        "windowStart" = CASE
          WHEN "RateLimitCounter"."expiresAt" <= now() THEN now()
          ELSE "RateLimitCounter"."windowStart"
        END,
        "expiresAt" = CASE
          WHEN "RateLimitCounter"."expiresAt" <= now() THEN ${expiresAt}
          ELSE "RateLimitCounter"."expiresAt"
        END,
        "updatedAt" = now()
      RETURNING "count", "expiresAt"`;

    const row = rows[0];
    if (!row) {
      // Unexpected — fail open
      console.warn("[rate-limit] UPSERT returned no row for key:", key);
      return { allowed: true, remaining: limit };
    }

    const count = Number(row.count);
    const allowed = count <= limit;
    const remaining = Math.max(0, limit - count);

    if (!allowed) {
      const retryAfterMs = Math.max(0, row.expiresAt.getTime() - Date.now());
      return { allowed: false, remaining: 0, retryAfterMs };
    }

    return { allowed: true, remaining };
  } catch (err) {
    if (opts?.failClosed) {
      // Fail CLOSED — for auth-sensitive keys, a DB hiccup must NOT open an
      // unthrottled brute-force window.
      console.warn("[rate-limit] DB error (failing CLOSED) for key:", key);
      return { allowed: false, remaining: 0, retryAfterMs: windowMs };
    }
    // Fail open — a DB hiccup must never lock users out
    console.warn("[rate-limit] DB error (failing open) for key:", key, err);
    return { allowed: true, remaining: limit };
  }
}

/**
 * Read-only rate limit check — reads the current counter without incrementing.
 * Use this as a pre-flight gate when you want to increment separately (e.g.
 * only on credential failure, not on successful auth).
 *
 * **Hybrid failure mode (OWASP-aligned).** On a DB error the behavior depends
 * on `opts.failClosed`:
 *   • Auth-sensitive keys (login / password-reset / resend-verification) pass
 *     `{ failClosed: true }` → fail CLOSED (returns allowed=false) so a DB blip
 *     cannot become an unthrottled brute-force window.
 *   • All other keys omit the option and **fail OPEN** (returns allowed=true).
 * There is no `windowMs` here, so the failed-closed `retryAfterMs` defaults to
 * 60000ms.
 *
 * @param key    Unique limiter key, e.g. "login:user@example.com"
 * @param limit  Max requests allowed inside the window
 * @param opts   Optional behavior flags. `failClosed: true` → deny on DB error.
 */
export async function peekRateLimit(
  key: string,
  limit: number,
  opts?: { failClosed?: boolean },
): Promise<RateLimitResult> {
  try {
    const rows = await db.$queryRaw<{ count: number; expiresAt: Date }[]>`
      SELECT "count", "expiresAt"
      FROM "RateLimitCounter"
      WHERE "key" = ${key}
        AND "expiresAt" > now()`;

    const row = rows[0];
    if (!row) {
      // No active window — not blocked
      return { allowed: true, remaining: limit };
    }

    const count = Number(row.count);
    const allowed = count < limit;
    const remaining = Math.max(0, limit - count);

    if (!allowed) {
      const retryAfterMs = Math.max(0, row.expiresAt.getTime() - Date.now());
      return { allowed: false, remaining: 0, retryAfterMs };
    }

    return { allowed: true, remaining };
  } catch (err) {
    if (opts?.failClosed) {
      // Fail CLOSED — for auth-sensitive keys, a DB hiccup must NOT open an
      // unthrottled brute-force window. No windowMs here → default retry 60s.
      console.warn("[rate-limit] DB error (failing CLOSED) for key:", key);
      return { allowed: false, remaining: 0, retryAfterMs: 60000 };
    }
    console.warn("[rate-limit] DB error in peek (failing open) for key:", key, err);
    return { allowed: true, remaining: limit };
  }
}
