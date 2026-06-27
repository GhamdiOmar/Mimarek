import { createUploadthing, type FileRouter } from "uploadthing/next";
import { auth } from "../../../auth";
import { hasPermission } from "../../../lib/permissions";

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
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
