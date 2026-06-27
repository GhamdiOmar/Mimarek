import { NextResponse } from "next/server";
import { expireTrials } from "../../../../lib/payment/subscription-machine";
import { isAuthorizedCronRequest } from "../../../../lib/cron-auth";

/**
 * Cron endpoint: transition TRIALING subscriptions past `trialEndsAt` to ACTIVE
 * (payment method on file) or CANCELED (none). Across all orgs. Daily via Vercel Cron.
 *
 * Vercel Cron sends:  Authorization: Bearer $CRON_SECRET
 */
export async function GET(request: Request) {
  const auth = isAuthorizedCronRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  try {
    const transitioned = await expireTrials();
    return NextResponse.json({ success: true, transitioned });
  } catch (error) {
    console.error("[Cron] expire-trials failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
