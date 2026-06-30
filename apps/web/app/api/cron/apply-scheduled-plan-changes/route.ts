import { NextResponse } from "next/server";
import { applyScheduledPlanChanges } from "../../../../lib/payment/scheduled-plan-changes";
import { isAuthorizedCronRequest } from "../../../../lib/cron-auth";

/**
 * Cron endpoint: announce + apply due ScheduledPlanChange rows. Re-prices each
 * affected subscription's `priceAtRenewal` (and `planId` for a migration) at the
 * cutoff; grandfathering is automatic (the current period was paid at the old
 * price). Daily via Vercel Cron.
 *
 * Vercel Cron sends:  Authorization: Bearer $CRON_SECRET
 */
export async function GET(request: Request) {
  const auth = isAuthorizedCronRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  try {
    const result = await applyScheduledPlanChanges(new Date());
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[Cron] apply-scheduled-plan-changes failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
