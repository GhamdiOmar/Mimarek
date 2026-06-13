"use server";

import { db } from "@repo/db";
import { revalidatePath } from "next/cache";
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
  return JSON.parse(JSON.stringify(org));
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
  entityType?: any;
  legalForm?: any;
  registrationStatus?: any;
  registrationDate?: string;
  expiryDate?: string;
  capitalAmountSar?: number;
  mainActivityCode?: string;
  mainActivityNameAr?: string;
  contactInfo?: any;
  nationalAddress?: any;
  managerInfo?: any;
}) {
  const session = await requirePermission("organization:write");

  const updateData: any = { ...data };
  if (data.registrationDate) updateData.registrationDate = new Date(data.registrationDate);
  if (data.expiryDate) updateData.expiryDate = new Date(data.expiryDate);

  const org = await db.organization.update({
    where: { id: session.organizationId },
    data: updateData,
  });

  logAuditEvent({ userId: session.userId, userEmail: session.email, userRole: session.role, action: "UPDATE", resource: "Organization", resourceId: session.organizationId, metadata: { fields: Object.keys(data) }, organizationId: session.organizationId });

  revalidatePath("/dashboard/settings");
  return JSON.parse(JSON.stringify(org));
}

export async function clearAppCache() {
  await getTenantSessionOrThrow();
  revalidatePath("/dashboard", "layout");
}
