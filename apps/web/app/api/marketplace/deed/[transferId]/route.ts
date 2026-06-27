import { NextResponse } from "next/server";
import { db } from "@repo/db";
import { UTApi } from "uploadthing/server";
import { getSessionOrThrow } from "../../../../../lib/auth-helpers";
import { hasPermission, isSystemRole } from "../../../../../lib/permissions";
import { logAuditEvent } from "../../../../../lib/audit";

/**
 * Authorized marketplace deed-document download (SEC-016).
 *
 * The deed-transfer proof is now an UPLOADED file (UploadThing `deedProofUploader`),
 * stored as a fileKey on `MarketplaceDeedProof.deedDocKey`. The raw CDN URL is a
 * permanent bearer credential — anyone who obtained it (DOM scrape, logs, referrer,
 * chat) could fetch the deed outside any auth/ownership check. This route instead
 * authorizes the request, then redirects to a SHORT-LIVED signed URL minted offline
 * via `UTApi.generateSignedURL` (15 min TTL) — so the URL that ever leaves the server
 * expires in minutes and is never rendered into the page.
 *
 * Mirrors the proven SEC-006 portal-document pattern: signed short-lived URL,
 * ownership-scoped read, never the raw permanent URL.
 *
 * Authorization (either grants access):
 *   • a platform moderator — `isSystemRole` + `marketplace:moderate`, OR
 *   • the seller org that owns the underlying transfer — `session.organizationId`
 *     === `transfer.sellerOrgId` + `marketplace:transfer:execute`.
 *
 * Legacy proofs that only carry the pre-SEC-016 seller-supplied `deedDocUrl`
 * redirect to that URL for back-compat (it passed the https-only guard at submit).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ transferId: string }> },
) {
  let session;
  try {
    session = await getSessionOrThrow();
  } catch {
    return NextResponse.redirect(new URL("/auth/login", _request.url));
  }

  const { transferId } = await params;

  const proof = await db.marketplaceDeedProof.findUnique({
    where: { transferId },
    include: { transfer: { select: { sellerOrgId: true } } },
  });
  if (!proof) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isPlatformModerator =
    isSystemRole(session.role) && hasPermission(session.role, "marketplace:moderate");
  const isOwningSeller =
    session.organizationId === proof.transfer.sellerOrgId &&
    hasPermission(session.role, "marketplace:transfer:execute");

  if (!isPlatformModerator && !isOwningSeller) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Audit the access. Fire-and-forget (a deed download must not 500 if the audit
  // store hiccups). READ is in the AuditAction union.
  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "READ",
    resource: "MarketplaceDeedProof",
    resourceId: proof.id,
    metadata: { transferId, via: "signed-url-download" },
    organizationId: session.organizationId,
  });

  // Preferred path: a real uploaded file → short-lived signed URL.
  if (proof.deedDocKey) {
    try {
      const { ufsUrl } = await new UTApi().generateSignedURL(proof.deedDocKey, {
        expiresIn: 60 * 15,
      });
      return NextResponse.redirect(ufsUrl);
    } catch (error) {
      console.error(`[marketplace/deed] signed URL failed for ${transferId}:`, error);
      return NextResponse.json({ error: "File temporarily unavailable" }, { status: 502 });
    }
  }

  // Back-compat: legacy seller-supplied URL (pre-SEC-016).
  if (proof.deedDocUrl) {
    return NextResponse.redirect(proof.deedDocUrl);
  }

  return NextResponse.json({ error: "No deed document" }, { status: 404 });
}
