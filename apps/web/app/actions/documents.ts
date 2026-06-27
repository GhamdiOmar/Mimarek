"use server";

import { db, DocCategory, Prisma } from "@repo/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { UTApi } from "uploadthing/server";
import { ROUTES } from "../../lib/routes";
import { requirePermission } from "../../lib/auth-helpers";
import { logAuditEvent } from "../../lib/audit";
import { serialize } from "../../lib/serialize";
// SEC-006: the UploadThing URL helpers (fileKey extraction + CDN-origin allowlist)
// live in one shared module so the server action, the dashboard download route,
// and the portal download route can't drift apart. "use server" forbids re-exporting
// them from here, which is the other reason they're external.
import { uploadThingFileKeyFromUrl, isAllowedUploadThingUrl } from "../../lib/uploadthing-url";

// Module-private — NOT exported
const RegisterFileSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  type: z.string().min(1),
  size: z.number().positive().optional(),
  customerId: z.string().cuid().optional(),
  unitId: z.string().cuid().optional(),
  category: z.nativeEnum(DocCategory).optional(),
});

export async function registerFileInDb(data: {
  name: string;
  url: string;
  type: string;
  size?: number;
  customerId?: string;
  unitId?: string;
  category?: DocCategory;
}) {
  const parsed = RegisterFileSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Invalid input: " + parsed.error.issues.map((i) => i.message).join(", "));
  }
  const safe = parsed.data;

  // URL-origin guard: only accept files from known UploadThing CDN hosts
  if (!isAllowedUploadThingUrl(safe.url)) {
    throw new Error(
      "File URL is not from a trusted source. Please upload files through the application uploader."
    );
  }

  const session = await requirePermission("documents:write");

  // Org-ownership check for customerId
  if (safe.customerId) {
    const customer = await db.customer.findFirst({
      where: { id: safe.customerId, organizationId: session.organizationId },
      select: { id: true },
    });
    if (!customer) {
      throw new Error(
        "The selected customer does not belong to your organization. Please verify and try again."
      );
    }
  }

  // Org-ownership check for unitId
  if (safe.unitId) {
    const unit = await db.unit.findFirst({
      where: { id: safe.unitId, organizationId: session.organizationId },
      select: { id: true },
    });
    if (!unit) {
      throw new Error(
        "The selected unit does not belong to your organization. Please verify and try again."
      );
    }
  }

  const document = await db.document.create({
    data: {
      name: safe.name,
      url: safe.url,
      type: safe.type,
      size: safe.size,
      customerId: safe.customerId,
      unitId: safe.unitId,
      category: safe.category ?? DocCategory.GENERAL,
      organizationId: session.organizationId,
      userId: session.userId,
    },
  });

  revalidatePath(ROUTES.documents);
  return document;
}

export async function getDocuments(filters?: {
  category?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const session = await requirePermission("documents:read");

  const where: Prisma.DocumentWhereInput = { organizationId: session.organizationId };

  if (filters?.category) {
    // `category` arrives as a plain string from the UI filter; the runtime value
    // is passed through unchanged — the cast only satisfies the enum-typed field.
    where.category = filters.category as DocCategory;
  }
  if (filters?.search) {
    where.name = { contains: filters.search, mode: "insensitive" };
  }

  const page = Math.max(1, filters?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters?.pageSize ?? 50));
  const skip = (page - 1) * pageSize;

  const rows = await db.document.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take: pageSize,
  });

  // SEC-006: never serialize the raw UploadThing object URL into the client/DOM —
  // it was a permanent public bearer credential. Strip it; downloads go through the
  // authorized `/api/documents/[id]` route (session + documents:read + org-scope →
  // short-lived signed URL). serialize() keeps the rows plain JSON for RSC props.
  return serialize(rows.map(({ url: _url, ...rest }) => rest));
}

export async function deleteDocument(documentId: string) {
  const session = await requirePermission("documents:delete");

  // Fetch the org-scoped row first so we have (a) the stored URL to remove the
  // remote object and (b) a before-snapshot for the audit log. The org filter is
  // the access guard: a row from another org is simply not found.
  const document = await db.document.findFirst({
    where: { id: documentId, organizationId: session.organizationId },
    select: { id: true, name: true, url: true, category: true, customerId: true, unitId: true },
  });
  if (!document) {
    throw new Error(
      "Document not found or you don't have access. Please verify it exists in your organization.",
    );
  }

  // Delete the DB row (org-scoped — defense in depth alongside the find above).
  await db.document.delete({
    where: { id: documentId, organizationId: session.organizationId },
  });

  // Remove the remote stored object from UploadThing so a DB-row delete doesn't
  // leak orphaned files in object storage. Best-effort: the row is already gone
  // and the audit entry must still be written, so a remote-delete failure is
  // logged but never thrown (e.g. transient UploadThing outage, already-deleted
  // object). UTApi reads its credentials from the environment
  // (UPLOADTHING_TOKEN; on this app the legacy UPLOADTHING_SECRET/APP_ID pair).
  const fileKey = uploadThingFileKeyFromUrl(document.url);
  if (fileKey) {
    try {
      await new UTApi().deleteFiles(fileKey);
    } catch (error) {
      console.error(
        `[documents] Remote object delete failed for document ${document.id} (key ${fileKey}):`,
        error,
      );
    }
  }

  // Audit the deletion (RED before-snapshot — id/name/category/links, never the
  // raw URL beyond what's needed to trace the object).
  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "DELETE",
    resource: "Document",
    resourceId: document.id,
    organizationId: session.organizationId,
    before: {
      name: document.name,
      category: document.category,
      customerId: document.customerId,
      unitId: document.unitId,
      remoteFileKey: fileKey,
    },
  });

  revalidatePath(ROUTES.documents);
}
