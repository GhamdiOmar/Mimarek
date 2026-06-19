import { NextResponse } from "next/server";
import { db } from "@repo/db";
import { isAuthorizedCronRequest } from "../../../../lib/cron-auth";

/**
 * Cron endpoint to purge spent EmailVerificationToken rows — anything already
 * expired (expiresAt < now) OR already consumed (usedAt set). Idempotent and
 * non-destructive to accounts: it only removes one-time token rows.
 *
 * Vercel Cron sends:  Authorization: Bearer $CRON_SECRET
 * Manual trigger:     GET /api/cron/clean-expired-email-tokens?secret=$CRON_SECRET
 *
 * NOTE: stale-ACCOUNT purge (deleting users who never verified) is deliberately
 * NOT implemented here. It is destructive, needs org-cascade rules (a registering
 * ADMIN owns a fresh Organization), and the app is not yet deployed — defer it.
 */
export async function GET(request: Request) {
  const auth = isAuthorizedCronRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  try {
    const now = new Date();
    const result = await db.emailVerificationToken.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }],
      },
    });
    return NextResponse.json({ success: true, deleted: result.count });
  } catch (error) {
    console.error("[Cron] clean-expired-email-tokens failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
