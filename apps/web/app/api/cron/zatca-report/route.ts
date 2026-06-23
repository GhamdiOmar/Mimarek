import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "../../../../lib/cron-auth";
import { runReportingSweepInternal } from "../../../../lib/zatca-reporting";

/**
 * ZATCA B2C reporting-recovery sweep endpoint (D24, Track C / R4b).
 *
 * Vercel Cron sends:  Authorization: Bearer $CRON_SECRET
 * Manual trigger:     GET /api/cron/zatca-report?secret=$CRON_SECRET
 *
 * Documents are reported/cleared at issuance time; any that hit a transport error are parked at
 * `zatcaStatus = PENDING` with their stored payload. This endpoint re-submits each parked
 * document (idempotent re-POST). Cron-secret gated; never tenant-reachable.
 */
async function handle(request: Request) {
  const auth = isAuthorizedCronRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  try {
    const summary = await runReportingSweepInternal();
    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    console.error("[Cron] ZATCA reporting sweep failed", e);
    return NextResponse.json({ ok: false, error: "Reporting sweep failed" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
