/**
 * Centralized cron authentication helper.
 *
 * Vercel Cron sends:  Authorization: Bearer <CRON_SECRET>
 * Manual triggers use: ?secret=<CRON_SECRET>  (query-param fallback)
 *
 * Usage in a route handler:
 *   const auth = isAuthorizedCronRequest(request);
 *   if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.status });
 */
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

  // PRIMARY: Authorization: Bearer <CRON_SECRET>  (what Vercel Cron sends)
  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader === `Bearer ${cronSecret}`) {
    return { ok: true };
  }

  // FALLBACK: ?secret=<CRON_SECRET>  (manual / local triggers)
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") === cronSecret) {
    return { ok: true };
  }

  return { ok: false, status: 401, reason: "Unauthorized" };
}
