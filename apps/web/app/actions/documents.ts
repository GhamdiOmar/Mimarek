"use server";

import { db, DocCategory } from "@repo/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "../../lib/auth-helpers";
import { logAuditEvent } from "../../lib/audit";

// UploadThing CDN origins for this app (app ID: c5k2lwc5ws).
// utfs.io  — legacy shared CDN (still serves files from v6 era and older uploads)
// *.ufs.sh — new app-scoped CDN introduced in UploadThing v6+ (app-specific subdomain)
// Source: UPLOADTHING_APP_ID env var + UploadThing v7 SDK behaviour confirmed via package.json
// Module-private — NOT exported (this is a "use server" file)
const UPLOADTHING_ALLOWED_ORIGINS = new Set([
  "https://utfs.io",
  "https://c5k2lwc5ws.ufs.sh",
]);

function isAllowedUploadThingUrl(raw: string): boolean {
  try {
    const { origin } = new URL(raw);
    return UPLOADTHING_ALLOWED_ORIGINS.has(origin);
  } catch {
    return false;
  }
}

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
  category?: any;
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

  revalidatePath("/dashboard/documents");
  return document;
}

export async function getDocuments(filters?: {
  category?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const session = await requirePermission("documents:read");

  const where: any = { organizationId: session.organizationId };

  if (filters?.category) {
    where.category = filters.category;
  }
  if (filters?.search) {
    where.name = { contains: filters.search, mode: "insensitive" };
  }

  const page = Math.max(1, filters?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters?.pageSize ?? 50));
  const skip = (page - 1) * pageSize;

  return db.document.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take: pageSize,
  });
}

export async function deleteDocument(documentId: string) {
  const session = await requirePermission("documents:delete");

  await db.document.delete({
    where: { id: documentId, organizationId: session.organizationId },
  });

  revalidatePath("/dashboard/documents");
}
