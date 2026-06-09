import { NextResponse } from "next/server";
import { snapshotMrrForMonth } from "../../../actions/admin-analytics/snapshotMrrForMonth";
import { isAuthorizedCronRequest } from "../../../../lib/cron-auth";

/**
 * Monthly cron — writes the previous-month-end snapshot row per active
 * subscription (and any sub that churned within that month for the ARR
 * waterfall churn bucket). Runs day 1 at 00:05 UTC (vercel.json schedule
 * "5 0 1 * *") — so on June 1 it snapshots May.
 *
 * Idempotent — the upsert pattern means re-runs are safe.
 *
 * Vercel Cron sends:  Authorization: Bearer $CRON_SECRET
 * Manual trigger:     GET /api/cron/snapshot-mrr?secret=$CRON_SECRET
 */
export async function GET(request: Request) {
  const auth = isAuthorizedCronRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  try {
    // Snapshot the previous full calendar month (we run on day 1)
    const now = new Date();
    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const y = prev.getUTCFullYear();
    const m = String(prev.getUTCMonth() + 1).padStart(2, "0");
    const snapshotMonth = `${y}-${m}`;

    const result = await snapshotMrrForMonth(snapshotMonth);
    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Cron] snapshot-mrr failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
