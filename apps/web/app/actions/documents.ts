"use server";

import { db } from "@repo/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "../../lib/auth-helpers";
import { logAuditEvent } from "../../lib/audit";

const RegisterFileSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  type: z.string().min(1),
  size: z.number().positive().optional(),
  customerId: z.string().cuid().optional(),
  unitId: z.string().cuid().optional(),
  category: z.string().optional(),
});

export async function registerFileInDb(data: {
  name: string;
  url: string;
  type: string;
  size?: number;
  customerId?: string;
  category?: any;
}) {
  const parsed = RegisterFileSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Invalid input: " + parsed.error.issues.map(i => i.message).join(", "));
  }
  data = parsed.data;

  const session = await requirePermission("documents:write");

  const document = await db.document.create({
    data: {
      name: data.name,
      url: data.url,
      type: data.type,
      size: data.size,
      customerId: data.customerId,
      category: data.category || "GENERAL",
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
