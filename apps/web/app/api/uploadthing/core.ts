import { createUploadthing, type FileRouter } from "uploadthing/next";
import { z } from "zod";
import { db } from "@repo/db";
import { auth } from "../../../auth";
import { hasPermission, isSystemRole } from "../../../lib/permissions";
import { uploadThingFileKeyFromUrl } from "../../../lib/uploadthing-marketplace";

const f = createUploadthing();

async function seoAuthMiddleware() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = session.user.role ?? "USER";
  if (!hasPermission(role, "billing:admin")) throw new Error("Insufficient permissions");
  return { userId: session.user.id };
}

export const ourFileRouter = {
  seoAssetUploader: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(seoAuthMiddleware)
    .onUploadComplete(async ({ file }) => {
      return { url: file.url, name: file.name };
    }),

  // SEC-016: deed-transfer proof — PDF or image, single file. The fileKey is written
  // SERVER-SIDE here (onUploadComplete), bound to a transfer the caller's org provably
  // owns (the middleware verifies `transferId` belongs to the seller org). The submit
  // action therefore never trusts a client-supplied key — closing the integrity gap
  // where a seller could attach a fileKey they didn't upload. The admin verifier later
  // downloads via the authorized short-lived signed-URL route, never a permanent link.
  // NOTE: UploadThing's FileSize type only accepts power-of-two prefixes (1/2/4/8/16/32),
  // so "10MB" is not expressible — "8MB" is the cap nearest the intended ≤10MB.
  deedProofUploader: f({
    pdf: { maxFileSize: "8MB", maxFileCount: 1 },
    image: { maxFileSize: "8MB", maxFileCount: 1 },
  })
    .input(z.object({ transferId: z.string().min(1) }))
    .middleware(async ({ input }) => {
      const session = await auth();
      if (!session?.user) throw new Error("Unauthorized");
      const role = session.user.role ?? "USER";
      if (isSystemRole(role)) throw new Error("Forbidden");
      const organizationId = session.user.organizationId;
      if (!organizationId) throw new Error("Forbidden");
      if (!hasPermission(role, "marketplace:transfer:execute")) {
        throw new Error("Insufficient permissions");
      }
      // Bind the upload to a transfer this org actually owns — so the stored key is
      // server-authoritative and a seller can never attach a foreign deed file.
      const transfer = await db.unitTransferTransaction.findFirst({
        where: { id: input.transferId, sellerOrgId: organizationId },
        select: { id: true },
      });
      if (!transfer) throw new Error("Transfer not found for your organization.");
      return { userId: session.user.id, organizationId, transferId: input.transferId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const fileKey = uploadThingFileKeyFromUrl(file.url);
      // Persist the key onto the (verified-owned) transfer's proof. A new deed doc
      // resets verification to PENDING — re-uploading must re-review.
      await db.marketplaceDeedProof.upsert({
        where: { transferId: metadata.transferId },
        create: { transferId: metadata.transferId, deedDocKey: fileKey },
        update: {
          deedDocKey: fileKey,
          status: "PENDING",
          verifiedByUserId: null,
          verifiedAt: null,
          rejectedReason: null,
        },
      });
      return { fileKey, name: file.name };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
