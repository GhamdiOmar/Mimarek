import { NextResponse } from "next/server";
import { db } from "@repo/db";
import { UTApi } from "uploadthing/server";
import { resolvePortalIdentity } from "../../../../../lib/server/portal-access";
import { uploadThingFileKeyFromUrl } from "../../../../../lib/uploadthing-url";

/**
 * Authorized PORTAL document download (SEC-006 — portal variant).
 *
 * The dashboard route `/api/documents/[id]` gates on the `documents:read`
 * permission, which a tenant end-user (role `USER`) does NOT hold — so it cannot
 * serve the portal. This route authorizes by **portal ownership** instead:
 *
 *   1. `resolvePortalIdentity()` — must be a signed-in `USER` with a customer
 *      profile in their org (else → redirect to login).
 *   2. The document must belong to THAT customer, or to the unit of their
 *      active/pending lease — exactly the scope `getTenantPortalSummary` lists.
 *      Anything else is `404`, so a portal user can never enumerate another
 *      tenant's (or an unrelated org-level) document by guessing its id.
 *
 * On success it redirects to a SHORT-LIVED signed URL minted offline via
 * `UTApi.generateSignedURL` — the raw object URL is never returned to the client
 * (it was a permanent public bearer credential). Mirrors the dashboard route.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let identity;
  try {
    identity = await resolvePortalIdentity();
  } catch {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }
  const { customer } = identity;

  const { id } = await params;

  // Ownership scope — mirror getTenantPortalSummary's document filter.
  const activeLease = await db.lease.findFirst({
    where: { customerId: customer.id, status: { in: ["ACTIVE", "PENDING_SIGNATURE"] } },
    select: { unitId: true },
    orderBy: { startDate: "desc" },
  });

  const doc = await db.document.findFirst({
    where: {
      id,
      organizationId: customer.organizationId,
      OR: [
        { customerId: customer.id },
        ...(activeLease ? [{ unitId: activeLease.unitId }] : []),
      ],
    },
    select: { id: true, url: true },
  });
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const key = uploadThingFileKeyFromUrl(doc.url);
  if (!key) {
    return NextResponse.json({ error: "File unavailable" }, { status: 404 });
  }

  try {
    const { ufsUrl } = await new UTApi().generateSignedURL(key, { expiresIn: 60 * 15 });
    return NextResponse.redirect(ufsUrl);
  } catch (error) {
    console.error(`[portal-documents] signed URL failed for ${id}:`, error);
    return NextResponse.json({ error: "File temporarily unavailable" }, { status: 502 });
  }
}
