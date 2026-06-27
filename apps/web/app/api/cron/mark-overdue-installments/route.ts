import { NextResponse } from "next/server";
import { markOverdueInstallmentsInternal } from "../../../../lib/server/installment-overdue";
import { isAuthorizedCronRequest } from "../../../../lib/cron-auth";

/**
 * Cron endpoint: flip past-due rent installments to OVERDUE across all orgs.
 * Intended to be called daily via Vercel Cron.
 *
 * Vercel Cron sends:  Authorization: Bearer $CRON_SECRET
 */
export async function GET(request: Request) {
  const auth = isAuthorizedCronRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  try {
    const result = await markOverdueInstallmentsInternal();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[Cron] mark-overdue-installments failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
