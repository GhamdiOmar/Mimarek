import { NextResponse } from "next/server";
import { snapshotMrrForMonth } from "../../../actions/admin-analytics/snapshotMrrForMonth";

/**
 * Every-6-hours cron — upserts the CURRENT-month snapshot rows so the
 * live admin dashboard isn't 30 days stale by mid-month. Without this,
 * the ARR waterfall's Ending bucket would lag the live data.
 *
 * Idempotent — the upsert pattern means re-runs are safe.
 *
 * GET /api/cron/refresh-current-month-snapshot?secret=$CRON_SECRET
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
