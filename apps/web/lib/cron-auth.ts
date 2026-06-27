/**
 * Centralized cron authentication helper.
 *
 * Vercel Cron sends:  Authorization: Bearer <CRON_SECRET>  (constant-time compared).
 * The ?secret=<CRON_SECRET> query-param fallback is DEV-ONLY (SEC-013): query-string
 * secrets leak into access logs, reverse proxies, browser history and Referer headers,
 * so it is rejected when NODE_ENV === "production".
 *
 * Usage in a route handler:
 *   const auth = isAuthorizedCronRequest(request);
 *   if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.status });
 */
import { timingSafeEqual } from "crypto";

/** Constant-time string compare (unequal lengths short-circuit to false). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export type CronAuthResult =
  | { ok: true }
  | { ok: false; status: number; reason: string };

export function isAuthorizedCronRequest(req: Request): CronAuthResult {
  const cronSecret = process.env.CRON_SECRET;

  // Fail-closed: never allow when secret is not configured.
  if (!cronSecret) {
    console.error("[Cron] CRON_SECRET is not configured — refusing to run");
    return { ok: false, status: 500, reason: "Cron not configured" };
  }

  // PRIMARY: Authorization: Bearer <CRON_SECRET>  (what Vercel Cron sends).
  const authHeader = req.headers.get("authorization") ?? "";
  if (safeEqual(authHeader, `Bearer ${cronSecret}`)) {
    return { ok: true };
  }

  // FALLBACK: ?secret=<CRON_SECRET> — DEV-ONLY (SEC-013). Query-string secrets
  // leak into logs/proxies/Referer; never honour them in production.
  if (process.env.NODE_ENV !== "production") {
    const q = new URL(req.url).searchParams.get("secret");
    if (q !== null && safeEqual(q, cronSecret)) {
      return { ok: true };
    }
  }

  return { ok: false, status: 401, reason: "Unauthorized" };
}
