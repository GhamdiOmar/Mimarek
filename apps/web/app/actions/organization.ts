"use server";

import { db, Prisma, type EntityType, type LegalForm, type RegistrationStatus } from "@repo/db";
import { revalidatePath } from "next/cache";
import { ROUTES } from "../../lib/routes";
import { serialize } from "../../lib/serialize";
import { requirePermission, getTenantSessionOrThrow, getSessionOrThrow } from "../../lib/auth-helpers";
import { logAuditEvent } from "../../lib/audit";
import { z } from "zod";

// Mass-assignment allowlist (same class as SEC-001/005) — the runtime payload is
// validated, so a direct call can't smuggle non-listed Organization columns into
// the update. WHERE is already org-scoped, so this is in-org integrity hardening.
const UpdateOrganizationSchema = z.object({
  name: z.string().optional(),
  nameArabic: z.string().optional(),
  nameEnglish: z.string().optional(),
  tradeNameArabic: z.string().optional(),
  tradeNameEnglish: z.string().optional(),
  crNumber: z.string().optional(),
  unifiedNumber: z.string().optional(),
  vatNumber: z.string().optional(),
  entityType: z.string().optional(),
  legalForm: z.string().optional(),
  registrationStatus: z.string().optional(),
  registrationDate: z.string().optional(),
  expiryDate: z.string().optional(),
  capitalAmountSar: z.number().optional(),
  mainActivityCode: z.string().optional(),
  mainActivityNameAr: z.string().optional(),
  contactInfo: z.any().optional(),
  nationalAddress: z.any().optional(),
  managerInfo: z.any().optional(),
});

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

  const parsed = UpdateOrganizationSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Invalid input: " + parsed.error.issues.map((i) => i.message).join(", "));
  }
  const input = parsed.data;

  // Callers pass the enum fields as plain strings (form state); cast at the write
  // boundary so the params stay caller-compatible while the Prisma input stays typed.
  const updateData: Prisma.OrganizationUpdateInput = {
    ...input,
    entityType: input.entityType as EntityType | undefined,
    legalForm: input.legalForm as LegalForm | undefined,
    registrationStatus: input.registrationStatus as RegistrationStatus | undefined,
  };
  if (input.registrationDate) updateData.registrationDate = new Date(input.registrationDate);
  if (input.expiryDate) updateData.expiryDate = new Date(input.expiryDate);

  const org = await db.organization.update({
    where: { id: session.organizationId },
    data: updateData,
  });

  logAuditEvent({ userId: session.userId, userEmail: session.email, userRole: session.role, action: "UPDATE", resource: "Organization", resourceId: session.organizationId, metadata: { fields: Object.keys(input) }, organizationId: session.organizationId });

  revalidatePath(ROUTES.settings);
  return serialize(org);
}

export async function clearAppCache() {
  await getTenantSessionOrThrow();
  revalidatePath(ROUTES.dashboard, "layout");
}
