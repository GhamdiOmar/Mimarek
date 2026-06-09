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
 * all share the same counter.  On any DB error the function **fails open**
 * (returns allowed=true) so a transient Postgres hiccup never locks users out.
 *
 * @param key       Unique limiter key, e.g. "login:user@example.com" or "invite:<orgId>"
 * @param limit     Max requests allowed inside the window
 * @param windowMs  Window size in milliseconds
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
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
 * Fails open on DB error.
 */
export async function peekRateLimit(
  key: string,
  limit: number,
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
    console.warn("[rate-limit] DB error in peek (failing open) for key:", key, err);
    return { allowed: true, remaining: limit };
  }
}
