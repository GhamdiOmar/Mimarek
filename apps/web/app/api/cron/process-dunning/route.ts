import { NextResponse } from "next/server";
import { processDunning } from "../../../../lib/payment/subscription-machine";
import { isAuthorizedCronRequest } from "../../../../lib/cron-auth";

/**
 * Cron endpoint: run the dunning retry schedule (1d/3d/7d) for PAST_DUE
 * subscriptions and transition exhausted ones to UNPAID. Across all orgs.
 * Daily via Vercel Cron.
 *
 * Vercel Cron sends:  Authorization: Bearer $CRON_SECRET
 */
export async function GET(request: Request) {
  const auth = isAuthorizedCronRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  try {
    await processDunning();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Cron] process-dunning failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
