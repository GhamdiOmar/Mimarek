import { createUploadthing, type FileRouter } from "uploadthing/next";
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

/**
 * SEC-016: gate the marketplace deed-proof upload to a tenant seller authorized to
 * execute transfers. Mirrors the §8 access-model: a non-system user, bound to an
 * org, holding `marketplace:transfer:execute` (the same permission `submitDeedTransferProof`
 * requires). Platform staff do not upload deed proofs — they verify them.
 */
async function deedProofAuthMiddleware() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = session.user.role ?? "USER";
  if (isSystemRole(role)) throw new Error("Forbidden");
  if (!session.user.organizationId) throw new Error("Forbidden");
  if (!hasPermission(role, "marketplace:transfer:execute")) {
    throw new Error("Insufficient permissions");
  }
  return { userId: session.user.id, organizationId: session.user.organizationId };
}

export const ourFileRouter = {
  seoAssetUploader: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(seoAuthMiddleware)
    .onUploadComplete(async ({ file }) => {
      return { url: file.url, name: file.name };
    }),

  // SEC-016: deed-transfer proof — PDF or image, single file. We persist the
  // UploadThing fileKey (not the raw CDN URL) so the admin verifier downloads via a
  // short-lived signed URL minted by the authorized route, never a permanent bearer link.
  // NOTE: UploadThing's FileSize type only accepts power-of-two prefixes (1/2/4/8/16/32),
  // so "10MB" is not expressible — "8MB" is the cap nearest the intended ≤10MB.
  deedProofUploader: f({
    pdf: { maxFileSize: "8MB", maxFileCount: 1 },
    image: { maxFileSize: "8MB", maxFileCount: 1 },
  })
    .middleware(deedProofAuthMiddleware)
    .onUploadComplete(async ({ file }) => {
      return { fileKey: uploadThingFileKeyFromUrl(file.url), name: file.name };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
