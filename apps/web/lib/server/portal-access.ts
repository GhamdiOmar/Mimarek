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
 * Shared by `app/actions/portal.ts` and the portal document download route
 * (`app/api/portal/documents/[id]`) so the auth → role → org-scoped customer
 * resolution lives in exactly ONE place. The portal authorizes by identity +
 * ownership, NOT by the `documents:read` permission — a tenant `USER` does not
 * hold that permission, so the dashboard `/api/documents/[id]` route (which
 * gates on it) cannot be reused for the portal.
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
    select: { id: true, email: true, organizationId: true },
  });
  if (!user?.organizationId) throw new Error("Missing organization");

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
