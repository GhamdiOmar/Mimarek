import "server-only";

import { db } from "@repo/db";
import { auth } from "../../auth";
import { searchHashCandidates } from "../pii-crypto";

export type PortalIdentity = {
  user: { id: string; email: string; organizationId: string };
  customer: { id: string; name: string; organizationId: string };
};

/**
 * Resolve the portal (tenant end-user) identity for the current session.
 *
 * Shared by `getTenantPortalSummary` and `createTenantMaintenanceRequest` in
 * `app/actions/portal.ts` so the auth → role → org-scoped customer resolution
 * lives in exactly ONE place. The portal authorizes by identity + ownership
 * (role === "USER" whose email maps to an org customer), never by a tenant-staff
 * permission.
 *
 * Throws on any failure: not signed in (`Unauthorized`), not a portal user
 * (`Forbidden`, role !== "USER"), no org, or no matching customer profile.
 */
export async function resolvePortalIdentity(): Promise<PortalIdentity> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) throw new Error("Unauthorized");
  if (session.user.role !== "USER") throw new Error("Forbidden");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, organizationId: true, isActive: true, tokenVersion: true },
  });
  // SEC-003 revocation (portal surface — mirror getSessionOrThrow): reject a deleted,
  // deactivated, or token-revoked portal user instead of trusting the ≤7-day JWT. Without
  // this the portal keeps serving a deactivated/revoked tenant until the token naturally
  // expires, while the dashboard (which funnels through getSessionOrThrow) bounces them at once.
  if (!user || !user.isActive) throw new Error("Unauthorized");
  if (user.tokenVersion !== (session.user.tokenVersion ?? 0)) throw new Error("Unauthorized");
  if (!user.organizationId) throw new Error("Missing organization");

  const customer = await db.customer.findFirst({
    where: {
      organizationId: user.organizationId,
      OR: [
        { emailHash: { in: searchHashCandidates(user.email, user.organizationId) } },
        { email: user.email },
      ],
    },
    select: { id: true, name: true, organizationId: true },
  });
  if (!customer) throw new Error("No tenant customer profile found");

  return {
    user: { id: user.id, email: user.email, organizationId: user.organizationId },
    customer: { id: customer.id, name: customer.name, organizationId: customer.organizationId },
  };
}
