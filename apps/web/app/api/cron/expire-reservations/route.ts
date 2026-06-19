import { NextResponse } from "next/server";
import { autoExpireReservations } from "../../../../lib/server/reservation-expiry";
import { isAuthorizedCronRequest } from "../../../../lib/cron-auth";

/**
 * RED: Cron endpoint to auto-expire PENDING reservations past their expiresAt.
 * Intended to be called hourly via Vercel Cron or similar scheduler.
 *
 * Vercel Cron sends:  Authorization: Bearer $CRON_SECRET
 * Manual trigger:     GET /api/cron/expire-reservations?secret=$CRON_SECRET
 */
export async function GET(request: Request) {
  const auth = isAuthorizedCronRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  try {
    const result = await autoExpireReservations();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[Cron] expire-reservations failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
