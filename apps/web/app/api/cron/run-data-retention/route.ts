import { NextResponse } from "next/server";
import { db } from "@repo/db";
import { isAuthorizedCronRequest } from "../../../../lib/cron-auth";
import { executeRetention } from "../../../../lib/server/data-retention-core";

/**
 * Daily data-retention sweep (PDPL/NDMO destruction).
 *
 * Gated by the shared cron auth (Bearer CRON_SECRET, or ?secret= fallback). When
 * `retentionSchedulerEnabled` is false the endpoint no-ops (returns {skipped}),
 * so the schedule can stay registered while the platform admin keeps the sweep
 * off. The destruction itself is advisory-locked inside `executeRetention`, so a
 * cron run that overlaps a manual run simply returns SKIPPED_LOCKED.
 *
 * Vercel Cron sends:  Authorization: Bearer $CRON_SECRET
 * Manual trigger:     GET /api/cron/run-data-retention?secret=$CRON_SECRET
 */
export async function GET(request: Request) {
  const auth = isAuthorizedCronRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  try {
    const config = await db.systemConfig.findUnique({
      where: { id: "system" },
      select: { retentionSchedulerEnabled: true },
    });

    if (!config?.retentionSchedulerEnabled) {
      return NextResponse.json({ skipped: true, reason: "scheduler disabled" });
    }

    const result = await executeRetention({ trigger: "CRON", dryRun: false });
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error("[Cron] run-data-retention failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
