import { NextResponse } from "next/server";
import { snapshotMrrForMonth } from "../../../../lib/server/mrr-snapshot";
import { isAuthorizedCronRequest } from "../../../../lib/cron-auth";

/**
 * Every-6-hours cron — upserts the CURRENT-month snapshot rows so the
 * live admin dashboard isn't 30 days stale by mid-month. Without this,
 * the ARR waterfall's Ending bucket would lag the live data.
 *
 * Idempotent — the upsert pattern means re-runs are safe.
 *
 * Vercel Cron sends:  Authorization: Bearer $CRON_SECRET
 * Manual trigger:     GET /api/cron/refresh-current-month-snapshot?secret=$CRON_SECRET
 */
export async function GET(request: Request) {
  const auth = isAuthorizedCronRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  try {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, "0");
    const snapshotMonth = `${y}-${m}`;

    const result = await snapshotMrrForMonth(snapshotMonth);
    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Cron] refresh-current-month-snapshot failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
