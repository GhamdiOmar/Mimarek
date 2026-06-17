"use server";

import { db } from "@repo/db";
import { requirePermission } from "../../lib/auth-helpers";
import { logAuditEvent } from "../../lib/audit";
import { serialize } from "../../lib/serialize";
import { revalidatePath } from "next/cache";

// ─── RED: Contract Templates ────────────────────────────────────────────────

export async function createContractTemplate(data: {
  name: string;
  nameArabic?: string;
  type: string;
  content: string;
}) {
  const session = await requirePermission("contracts:write");

  const template = await db.contractTemplate.create({
    data: {
      name: data.name,
      nameArabic: data.nameArabic,
      type: data.type as any,
      content: data.content,
      organizationId: session.organizationId,
    },
  });

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "CREATE",
    resource: "ContractTemplate",
    resourceId: template.id,
    organizationId: session.organizationId,
  });

  return serialize(template);
}

export async function updateContractTemplate(
  templateId: string,
  data: { name?: string; nameArabic?: string; content?: string; isActive?: boolean }
) {
  const session = await requirePermission("contracts:write");

  const existing = await db.contractTemplate.findFirst({
    where: { id: templateId, organizationId: session.organizationId },
  });
  if (!existing) throw new Error("Contract template not found. Please refresh and try again.");

  // If content changed, increment version
  const versionBump = data.content && data.content !== existing.content;

  const updated = await db.contractTemplate.update({
    where: { id: templateId },
    data: {
      ...data,
      version: versionBump ? existing.version + 1 : undefined,
    },
  });

  return serialize(updated);
}

export async function getContractTemplates(type?: string) {
  const session = await requirePermission("contracts:read");

  const where: any = { organizationId: session.organizationId };
  if (type) where.type = type;

  const templates = await db.contractTemplate.findMany({
    where,
    orderBy: { updatedAt: "desc" },
  });

  return serialize(templates);
}

export async function getContractTemplate(templateId: string) {
  const session = await requirePermission("contracts:read");

  const template = await db.contractTemplate.findFirst({
    where: { id: templateId, organizationId: session.organizationId },
  });
  if (!template) throw new Error("Contract template not found. Please refresh and try again.");

  return serialize(template);
}

export async function deleteContractTemplate(templateId: string) {
  const session = await requirePermission("contracts:delete");

  const template = await db.contractTemplate.findFirst({
    where: { id: templateId, organizationId: session.organizationId },
  });
  if (!template) throw new Error("Contract template not found. Please refresh and try again.");

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "DELETE",
    resource: "ContractTemplate",
    resourceId: templateId,
    metadata: { name: template.name },
    organizationId: session.organizationId,
  });

  await db.contractTemplate.delete({ where: { id: templateId } });
}
