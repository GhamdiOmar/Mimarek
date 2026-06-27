"use server";

import { db, Prisma, ContractType } from "@repo/db";
import { z } from "zod";
import { requirePermission } from "../../lib/auth-helpers";
import { logAuditEvent } from "../../lib/audit";
import { serialize } from "../../lib/serialize";

// Mass-assignment allowlist (same class as SEC-001/005). Ownership is already
// verified via findFirst below; this stops a direct call smuggling extra columns.
const UpdateContractTemplateSchema = z.object({
  name: z.string().optional(),
  nameArabic: z.string().optional(),
  content: z.string().optional(),
  isActive: z.boolean().optional(),
});

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
      // `type` stays a `string` param (callers pass plain strings); cast to the
      // enum only at the Prisma write site — value is unchanged at runtime.
      type: data.type as ContractType,
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

  const parsed = UpdateContractTemplateSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Invalid input: " + parsed.error.issues.map((i) => i.message).join(", "));
  }
  const input = parsed.data;

  const existing = await db.contractTemplate.findFirst({
    where: { id: templateId, organizationId: session.organizationId },
  });
  if (!existing) throw new Error("Contract template not found. Please refresh and try again.");

  // If content changed, increment version
  const versionBump = input.content && input.content !== existing.content;

  const updated = await db.contractTemplate.update({
    where: { id: templateId },
    data: {
      ...input,
      version: versionBump ? existing.version + 1 : undefined,
    },
  });

  return serialize(updated);
}

export async function getContractTemplates(type?: string) {
  const session = await requirePermission("contracts:read");

  const where: Prisma.ContractTemplateWhereInput = { organizationId: session.organizationId };
  // `type` stays a `string` param; cast only at the WhereInput field (value unchanged).
  if (type) where.type = type as ContractType;

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
