import { NextResponse } from "next/server";
import { db } from "@repo/db";
import { isAuthorizedCronRequest } from "../../../../lib/cron-auth";

/**
 * Cron endpoint to expire never-verified organizations (E1 registration
 * hardening). An org created via self-signup starts at
 * `appStatus = PENDING_VERIFICATION` and flips to ACTIVE only when its
 * registering admin confirms their email. If 14 days pass with NO verified user
 * in the org, the org is marked EXPIRED so it can no longer be logged into.
 *
 * Idempotent and conservative:
 *   • Only touches orgs still PENDING_VERIFICATION (never resurrects EXPIRED,
 *     never demotes an already-ACTIVE org).
 *   • `users: { none: { emailVerified: { not: null } } }` — if ANY user in the
 *     org has verified, the org should already be ACTIVE; we leave it alone.
 *
 * Vercel Cron sends:  Authorization: Bearer $CRON_SECRET
 * Manual trigger:     GET /api/cron/expire-unverified-orgs?secret=$CRON_SECRET
 */
const EXPIRY_WINDOW_DAYS = 14;

export async function GET(request: Request) {
  const auth = isAuthorizedCronRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  try {
    const cutoff = new Date(Date.now() - EXPIRY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const result = await db.organization.updateMany({
      where: {
        appStatus: "PENDING_VERIFICATION",
        createdAt: { lt: cutoff },
        users: { none: { emailVerified: { not: null } } },
      },
      data: { appStatus: "EXPIRED" },
    });
    return NextResponse.json({ success: true, expired: result.count });
  } catch (error: any) {
    console.error("[Cron] expire-unverified-orgs failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
