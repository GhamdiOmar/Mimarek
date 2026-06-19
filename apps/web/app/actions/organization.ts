"use server";

import { db, Prisma, type EntityType, type LegalForm, type RegistrationStatus } from "@repo/db";
import { revalidatePath } from "next/cache";
import { ROUTES } from "../../lib/routes";
import { serialize } from "../../lib/serialize";
import { requirePermission, getTenantSessionOrThrow, getSessionOrThrow } from "../../lib/auth-helpers";
import { logAuditEvent } from "../../lib/audit";

/**
 * Lightweight org name lookup — any authenticated user can see their own org name.
 * Org-less platform (system) users have no organization, so they get `null`
 * rather than a thrown error. Using `getTenantSessionOrThrow` here previously
 * surfaced as an HTTP 500 on every dashboard load for system users (CX-001),
 * because the shared top bar calls this on mount for all roles.
 */
export async function getOrgName(): Promise<{ name: string; nameArabic?: string | null; nameEnglish?: string | null } | null> {
  const session = await getSessionOrThrow();
  if (!session.organizationId) return null;
  const org = await db.organization.findUnique({
    where: { id: session.organizationId },
    select: { name: true, nameArabic: true, nameEnglish: true },
  });
  return org;
}

export async function getOrganization() {
  const session = await requirePermission("organization:read");

  const org = await db.organization.findUnique({
    where: { id: session.organizationId },
  });
  return serialize(org);
}

export async function updateOrganization(data: {
  name?: string;
  nameArabic?: string;
  nameEnglish?: string;
  tradeNameArabic?: string;
  tradeNameEnglish?: string;
  crNumber?: string;
  unifiedNumber?: string;
  vatNumber?: string;
  entityType?: string;
  legalForm?: string;
  registrationStatus?: string;
  registrationDate?: string;
  expiryDate?: string;
  capitalAmountSar?: number;
  mainActivityCode?: string;
  mainActivityNameAr?: string;
  contactInfo?: Prisma.InputJsonValue;
  nationalAddress?: Prisma.InputJsonValue;
  managerInfo?: Prisma.InputJsonValue;
}) {
  const session = await requirePermission("organization:write");

  // Callers pass the enum fields as plain strings (form state); cast at the write
  // boundary so the params stay caller-compatible while the Prisma input stays typed.
  const updateData: Prisma.OrganizationUpdateInput = {
    ...data,
    entityType: data.entityType as EntityType | undefined,
    legalForm: data.legalForm as LegalForm | undefined,
    registrationStatus: data.registrationStatus as RegistrationStatus | undefined,
  };
  if (data.registrationDate) updateData.registrationDate = new Date(data.registrationDate);
  if (data.expiryDate) updateData.expiryDate = new Date(data.expiryDate);

  const org = await db.organization.update({
    where: { id: session.organizationId },
    data: updateData,
  });

  logAuditEvent({ userId: session.userId, userEmail: session.email, userRole: session.role, action: "UPDATE", resource: "Organization", resourceId: session.organizationId, metadata: { fields: Object.keys(data) }, organizationId: session.organizationId });

  revalidatePath(ROUTES.settings);
  return serialize(org);
}

export async function clearAppCache() {
  await getTenantSessionOrThrow();
  revalidatePath(ROUTES.dashboard, "layout");
}
