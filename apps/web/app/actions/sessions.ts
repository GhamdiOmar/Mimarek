"use server";

import { db } from "@repo/db";
import { getSessionOrThrow } from "../../lib/auth-helpers";
import { logAuditEvent } from "../../lib/audit";

/**
 * Sign out of every device / session (SEC-003).
 *
 * Bumps the acting user's `tokenVersion`, which `getSessionOrThrow` re-reads and
 * compares on EVERY server action and page load. Because the choke point returns
 * Unauthorized when the JWT's tokenVersion no longer matches the DB, every
 * outstanding token for this account — on every device, including the current
 * one — is invalidated on its next request. The client follows this call with a
 * NextAuth `signOut()` to clear the current cookie and redirect to login, so the
 * user lands on a clean re-auth instead of a mid-action rejection.
 */
export async function signOutEverywhere() {
  const session = await getSessionOrThrow();

  await db.user.update({
    where: { id: session.userId },
    data: { tokenVersion: { increment: 1 } },
  });

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "LOGOUT",
    resource: "Auth",
    metadata: { scope: "all_sessions" },
    organizationId: session.organizationId,
  });

  return { success: true as const };
}
