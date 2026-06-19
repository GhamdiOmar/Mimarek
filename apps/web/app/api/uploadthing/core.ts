import { createUploadthing, type FileRouter } from "uploadthing/next";
import { auth } from "../../../auth";
import { hasPermission, isSystemRole } from "../../../lib/permissions";

const f = createUploadthing();

/**
 * Shared auth middleware for all upload routes.
 * Validates session, checks documents:write permission, and enforces tenant audience
 * (system users must not upload to tenant document storage).
 */
async function authMiddleware() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const role = session.user.role ?? "USER";
  const organizationId = session.user.organizationId;

  if (!hasPermission(role, "documents:write")) {
    throw new Error("Insufficient permissions");
  }

  // Enforce tenant audience: system users have null organizationId and must not
  // access tenant document storage even if they hold documents:write permission.
  if (isSystemRole(role) || !organizationId) {
    throw new Error("Forbidden: document upload requires a tenant account");
  }

  return {
    userId: session.user.id,
    organizationId,
    role,
  };
}

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

  contractUploader: f({ pdf: { maxFileSize: "16MB" } })
    .middleware(authMiddleware)
    .onUploadComplete(async ({ metadata, file }) => {
      return { uploadedBy: metadata.userId, organizationId: metadata.organizationId };
    }),

  blueprintUploader: f({ image: { maxFileSize: "32MB" }, pdf: { maxFileSize: "32MB" } })
    .middleware(authMiddleware)
    .onUploadComplete(async ({ metadata, file }) => {
      return { uploadedBy: metadata.userId, organizationId: metadata.organizationId };
    }),

  // Balady & project documents: PDF, images, DWG, and common formats
  projectDocumentUploader: f({
    pdf: { maxFileSize: "32MB", maxFileCount: 10 },
    image: { maxFileSize: "16MB", maxFileCount: 10 },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { maxFileSize: "16MB", maxFileCount: 5 },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { maxFileSize: "16MB", maxFileCount: 5 },
  })
    .middleware(authMiddleware)
    .onUploadComplete(async ({ metadata, file }) => {
      return { uploadedBy: metadata.userId, organizationId: metadata.organizationId, url: file.url, name: file.name };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
