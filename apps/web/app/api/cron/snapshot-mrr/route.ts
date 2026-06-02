import { NextResponse } from "next/server";
import { snapshotMrrForMonth } from "../../../actions/admin-analytics/snapshotMrrForMonth";

/**
 * Monthly cron — writes the previous-month-end snapshot row per active
 * subscription (and any sub that churned within that month for the ARR
 * waterfall churn bucket). Runs day 1 at 00:05 UTC (vercel.json schedule
 * "5 0 1 * *") — so on June 1 it snapshots May.
 *
 * Idempotent — the upsert pattern means re-runs are safe.
 *
 * GET /api/cron/snapshot-mrr?secret=$CRON_SECRET
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[Cron] CRON_SECRET is not configured — refusing to run");
    return NextResponse.json({ error: "Cron not configured" }, { status: 500 });
  }
  if (secret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
