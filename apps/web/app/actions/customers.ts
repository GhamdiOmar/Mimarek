"use server";

import { db, CustomerStatus, PersonType, Gender, ActivityType, CustomerKind, Prisma } from "@repo/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "../../lib/auth-helpers";
import { hasPermission } from "../../lib/permissions";
import { logAuditEvent } from "../../lib/audit";
import {
  encryptCustomerData,
  decryptCustomerData,
  decryptCustomerList,
  searchHashCandidates,
  phoneSearchHashCandidates,
} from "../../lib/pii-crypto";
import { maskCustomerPii } from "../../lib/pii-masking";
import { normalizeSaudiPhoneE164 } from "../../lib/phone";
import { ROUTES } from "../../lib/routes";
import { serialize } from "../../lib/serialize";

const UpdateCustomerStatusSchema = z.object({
  status: z.string().min(1),
  lostReason: z.string().optional(),
});

const CreateCustomerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional(),
  source: z.string().optional(),
  status: z.string().optional(),
  nationalId: z.string().optional(),
  nameArabic: z.string().optional(),
  personType: z.string().optional(),
  gender: z.string().optional(),
  dateOfBirth: z.string().optional(),
  dateOfBirthHijri: z.string().optional(),
  nationality: z.string().optional(),
  nationalityCode: z.string().optional(),
  maritalStatus: z.string().optional(),
  address: z.any().optional(),
  documentInfo: z.any().optional(),
  budget: z.number().positive().optional(),
  propertyTypeInterest: z.string().optional(),
  agentId: z.string().optional(),
  // ZATCA Track C buyer party (D18) — plaintext business identifiers, not encrypted.
  customerKind: z.string().optional(),
  vatNumber: z.string().optional(),
  crNumber: z.string().optional(),
  companyNameAr: z.string().optional(),
  companyNameEn: z.string().optional(),
});

// SEC-005: strict allowlist for updateCustomer — exactly the editable fields and
// nothing else. zod strips every unknown key, so a direct invocation can no longer
// smuggle organizationId / *Hash / createdAt into db.customer.update. Value rules
// are intentionally loose (matching the prior pass-through behaviour); the security
// property is the key allowlist, not per-field validation.
const UpdateCustomerSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  nationalId: z.string().optional(),
  nameArabic: z.string().optional(),
  personType: z.string().optional(),
  gender: z.string().optional(),
  dateOfBirth: z.string().optional(),
  dateOfBirthHijri: z.string().optional(),
  nationality: z.string().optional(),
  nationalityCode: z.string().optional(),
  maritalStatus: z.string().optional(),
  address: z.any().optional(),
  documentInfo: z.any().optional(),
  source: z.string().optional(),
  agentId: z.string().optional(),
  budget: z.number().optional(),
  propertyTypeInterest: z.string().optional(),
  customerKind: z.string().optional(),
  vatNumber: z.string().optional(),
  crNumber: z.string().optional(),
  companyNameAr: z.string().optional(),
  companyNameEn: z.string().optional(),
});

export async function updateCustomerStatus(customerId: string, status: string, lostReason?: string) {
  const parsed = UpdateCustomerStatusSchema.safeParse({ status, lostReason });
  if (!parsed.success) {
    throw new Error("Invalid input: " + parsed.error.issues.map(i => i.message).join(", "));
  }
  const validatedStatus = parsed.data.status;
  const resolvedLostReason = parsed.data.lostReason;

  const session = await requirePermission("customers:write");

  // Verify ownership FIRST — before any side effects
  const existing = await db.customer.findFirst({
    where: { id: customerId, organizationId: session.organizationId },
  });
  if (!existing) {
    throw new Error("Customer not found or you don't have access. Please verify the customer exists in your organization.");
  }

  // When marking LOST: cascade cancel all active reservations + drop all active interests.
  // All side effects run inside one transaction using only verified customer data.
  if (validatedStatus === "LOST") {
    await db.$transaction(async (tx) => {
      const activeReservations = await tx.reservation.findMany({
        where: { customerId: existing.id, status: { in: ["PENDING", "CONFIRMED"] } },
        select: { id: true, unitId: true },
      });
      for (const res of activeReservations) {
        await tx.reservation.update({ where: { id: res.id }, data: { status: "CANCELLED" } });
        await tx.unit.update({ where: { id: res.unitId }, data: { status: "AVAILABLE" } });
      }
      // Manual LOST is an explicit override — cascade-lose every active deal so
      // the derived pipeline (Deal.stage is the writer of record — R3) stays
      // coherent and can't later resurrect a non-LOST status.
      await tx.deal.updateMany({
        where: { customerId: existing.id, status: "ACTIVE" },
        data: { status: "DROPPED", stage: "LOST" },
      });
      await tx.customer.update({
        where: { id: existing.id },
        data: {
          status: validatedStatus as CustomerStatus,
          // Status is definitionally changing here (LOST branch) — stamp the stage entry time.
          stageEnteredAt: new Date(),
          ...(resolvedLostReason !== undefined ? { lostReason: resolvedLostReason } : {}),
        },
      });
    });

    logAuditEvent({ userId: session.userId, userEmail: session.email, userRole: session.role, action: "UPDATE", resource: "Customer", resourceId: customerId, metadata: { field: "status", newStatus: validatedStatus }, organizationId: session.organizationId });
    revalidatePath(ROUTES.crm);
    return serialize({ ...existing, status: validatedStatus, lostReason: resolvedLostReason });
  }

  // Only stamp stageEnteredAt when the status genuinely changes.
  const statusChanged = validatedStatus !== existing.status;
  const customer = await db.customer.update({
    where: { id: customerId, organizationId: session.organizationId },
    data: {
      status: validatedStatus as CustomerStatus,
      ...(statusChanged ? { stageEnteredAt: new Date() } : {}),
      ...(resolvedLostReason !== undefined ? { lostReason: resolvedLostReason } : {}),
    },
  });

  logAuditEvent({ userId: session.userId, userEmail: session.email, userRole: session.role, action: "UPDATE", resource: "Customer", resourceId: customerId, metadata: { field: "status", newStatus: validatedStatus }, organizationId: session.organizationId });

  revalidatePath(ROUTES.crm);
  return serialize(customer);
}

export async function createCustomer(data: {
  name: string;
  phone: string;
  email?: string;
  source?: string;
  status?: string;
  nationalId?: string;
  nameArabic?: string;
  personType?: string;
  gender?: string;
  dateOfBirth?: string;
  dateOfBirthHijri?: string;
  nationality?: string;
  nationalityCode?: string;
  maritalStatus?: string;
  address?: Prisma.InputJsonValue;
  documentInfo?: Prisma.InputJsonValue;
  budget?: number;
  propertyTypeInterest?: string;
  agentId?: string;
  customerKind?: string;
  vatNumber?: string;
  crNumber?: string;
  companyNameAr?: string;
  companyNameEn?: string;
}) {
  const parsed = CreateCustomerSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Invalid input: " + parsed.error.issues.map(i => i.message).join(", "));
  }
  data = parsed.data;

  const session = await requirePermission("customers:write");

  // SEC-011: an assigned agent must belong to the caller's org (no cross-org FK injection).
  if (data.agentId) {
    const agent = await db.user.findFirst({
      where: { id: data.agentId, organizationId: session.organizationId },
      select: { id: true },
    });
    if (!agent) throw new Error("The selected agent is not part of your organization.");
  }

  // Encrypt PII fields before saving (per-tenant blind-index hashes, keyed by org).
  // SEC-009: dateOfBirth/address/documentInfo are also encrypted-at-rest here.
  const encryptedData = encryptCustomerData(
    {
      nationalId: data.nationalId,
      phone: data.phone,
      email: data.email,
      dateOfBirth: data.dateOfBirth,
      address: data.address,
      documentInfo: data.documentInfo,
    },
    session.organizationId,
  );

  const customer = await db.customer.create({
    data: {
      name: data.name,
      phone: encryptedData.phone,
      email: encryptedData.email || undefined,
      source: data.source || undefined,
      status: (data.status || undefined) as CustomerStatus | undefined,
      nationalId: encryptedData.nationalId,
      nationalIdHash: encryptedData.nationalIdHash,
      phoneHash: encryptedData.phoneHash,
      emailHash: encryptedData.emailHash,
      nameArabic: data.nameArabic || undefined,
      personType: (data.personType || undefined) as PersonType | undefined,
      gender: (data.gender || undefined) as Gender | undefined,
      // SEC-009: DOB stored only as ciphertext (dateOfBirthEnc); plaintext column nulled.
      dateOfBirth: null,
      dateOfBirthEnc: data.dateOfBirth ? encryptedData.dateOfBirthEnc : undefined,
      dateOfBirthHijri: data.dateOfBirthHijri || undefined,
      nationality: data.nationality || undefined,
      nationalityCode: data.nationalityCode || undefined,
      maritalStatus: data.maritalStatus || undefined,
      // SEC-009: address/documentInfo stored as ciphertext strings in their Json columns.
      address: data.address ? (encryptedData.address as Prisma.InputJsonValue) : undefined,
      documentInfo: data.documentInfo ? (encryptedData.documentInfo as Prisma.InputJsonValue) : undefined,
      budget: data.budget ?? undefined,
      propertyTypeInterest: data.propertyTypeInterest || undefined,
      agentId: data.agentId || undefined,
      // ZATCA Track C buyer party (D18) — plaintext, no encryption.
      customerKind: (data.customerKind || undefined) as CustomerKind | undefined,
      vatNumber: data.vatNumber || undefined,
      crNumber: data.crNumber || undefined,
      companyNameAr: data.companyNameAr || undefined,
      companyNameEn: data.companyNameEn || undefined,
      organizationId: session.organizationId,
    },
  });

  logAuditEvent({ userId: session.userId, userEmail: session.email, userRole: session.role, action: "CREATE", resource: "Customer", resourceId: customer.id, organizationId: session.organizationId });

  revalidatePath(ROUTES.crm);
  return serialize(customer);
}

export async function getCustomer(customerId: string) {
  const session = await requirePermission("customers:read");
  const hasPiiAccess = hasPermission(session.role, "customers:read_pii");

  const customer = await db.customer.findFirst({
    where: { id: customerId, organizationId: session.organizationId },
    include: {
      agent: { select: { id: true, name: true, email: true } },
      leases: { include: { unit: true }, orderBy: { createdAt: "desc" } },
      contracts: { include: { unit: true }, orderBy: { createdAt: "desc" } },
      reservations: { include: { unit: true }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!customer) return null;

  // Decrypt then mask based on permissions
  const decrypted = decryptCustomerData(customer);
  const masked = maskCustomerPii(decrypted, hasPiiAccess);

  // Derive a safe, normalized E.164 phone for contact controls.
  // Masked PII (******4567) and ciphertext both normalize to null → controls are omitted.
  const contactPhoneE164 = normalizeSaudiPhoneE164(masked.phone as string | null | undefined);

  logAuditEvent({ userId: session.userId, userEmail: session.email, userRole: session.role, action: hasPiiAccess ? "READ_PII" : "READ", resource: "Customer", resourceId: customerId, organizationId: session.organizationId });

  return serialize({ ...masked, contactPhoneE164 });
}

export async function updateCustomer(
  customerId: string,
  data: {
    name?: string;
    phone?: string;
    email?: string;
    nationalId?: string;
    nameArabic?: string;
    personType?: string;
    gender?: string;
    dateOfBirth?: string;
    dateOfBirthHijri?: string;
    nationality?: string;
    nationalityCode?: string;
    maritalStatus?: string;
    address?: Prisma.InputJsonValue;
    documentInfo?: Prisma.InputJsonValue;
    source?: string;
    agentId?: string;
    budget?: number;
    propertyTypeInterest?: string;
    customerKind?: string;
    vatNumber?: string;
    crNumber?: string;
    companyNameAr?: string;
    companyNameEn?: string;
  }
) {
  const session = await requirePermission("customers:write");

  // SEC-005: validate against the strict allowlist. zod strips every key not in
  // UpdateCustomerSchema, closing the old Object.entries(data) mass-assignment that
  // let organizationId / *Hash / createdAt reach db.customer.update.
  const parsed = UpdateCustomerSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Invalid input: " + parsed.error.issues.map((i) => i.message).join(", "));
  }
  const input = parsed.data;

  // SEC-011: an assigned agent must belong to the caller's org (no cross-org FK injection).
  if (input.agentId) {
    const agent = await db.user.findFirst({
      where: { id: input.agentId, organizationId: session.organizationId },
      select: { id: true },
    });
    if (!agent) throw new Error("The selected agent is not part of your organization.");
  }

  // Sanitize empty strings to undefined; only allowlisted keys remain in `input`.
  const updateData = Object.fromEntries(
    Object.entries(input).map(([k, v]) => [k, v === "" ? undefined : v])
  ) as Prisma.CustomerUpdateInput;

  // SEC-009: encrypt dateOfBirth/address/documentInfo if being updated — these
  // OVERRIDE the plaintext values the allowlist spread above placed into updateData.
  if (input.dateOfBirth) {
    const enc = encryptCustomerData({ dateOfBirth: input.dateOfBirth }, session.organizationId);
    updateData.dateOfBirth = null;
    updateData.dateOfBirthEnc = enc.dateOfBirthEnc;
  }
  if (input.address) {
    const enc = encryptCustomerData({ address: input.address }, session.organizationId);
    updateData.address = enc.address as Prisma.InputJsonValue;
  }
  if (input.documentInfo) {
    const enc = encryptCustomerData({ documentInfo: input.documentInfo }, session.organizationId);
    updateData.documentInfo = enc.documentInfo as Prisma.InputJsonValue;
  }

  // Encrypt PII fields if being updated
  if (input.nationalId) {
    const enc = encryptCustomerData({ nationalId: input.nationalId }, session.organizationId);
    updateData.nationalId = enc.nationalId;
    updateData.nationalIdHash = enc.nationalIdHash;
  }
  if (input.phone) {
    const enc = encryptCustomerData({ phone: input.phone }, session.organizationId);
    updateData.phone = enc.phone;
    updateData.phoneHash = enc.phoneHash;
  }
  if (input.email) {
    const enc = encryptCustomerData({ email: input.email }, session.organizationId);
    updateData.email = enc.email;
    updateData.emailHash = enc.emailHash;
  }

  const customer = await db.customer.update({
    where: { id: customerId, organizationId: session.organizationId },
    data: updateData,
  });

  logAuditEvent({ userId: session.userId, userEmail: session.email, userRole: session.role, action: "UPDATE", resource: "Customer", resourceId: customerId, metadata: { fields: Object.keys(input) }, organizationId: session.organizationId });

  revalidatePath(ROUTES.crm);
  return serialize(customer);
}

export async function getCustomers(filters?: {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const session = await requirePermission("customers:read");
  const hasPiiAccess = hasPermission(session.role, "customers:read_pii");

  const where: Prisma.CustomerWhereInput = { organizationId: session.organizationId };

  if (filters?.status) {
    where.status = filters.status as CustomerStatus;
  }

  if (filters?.search) {
    // Per-tenant blind index (v2) + legacy (v1) dual-read so both backfilled and
    // not-yet-migrated rows match. Phone uses the SAME normalize-then-hash rule as
    // the write path so "0551234567" and "+966551234567" both match.
    const textHashes = searchHashCandidates(filters.search, session.organizationId);
    const phoneHashes = phoneSearchHashCandidates(filters.search, session.organizationId);
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { nameArabic: { contains: filters.search, mode: "insensitive" } },
      // Exact match via blind index for encrypted fields
      { phoneHash: { in: phoneHashes } },
      { emailHash: { in: textHashes } },
      { nationalIdHash: { in: textHashes } },
    ];
  }

  const page = Math.max(1, filters?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters?.pageSize ?? 50));
  const skip = (page - 1) * pageSize;

  const results = await db.customer.findMany({
    where,
    include: {
      agent: { select: { id: true, name: true, email: true } },
    },
    orderBy: { updatedAt: "desc" },
    skip,
    take: pageSize,
  });

  // Decrypt then mask based on permissions
  const decrypted = decryptCustomerList(results);
  const maskedList = decrypted.map((c) => {
    const masked = maskCustomerPii(c, hasPiiAccess);
    // Derive safe E.164 for each customer — masked PII normalizes to null.
    const contactPhoneE164 = normalizeSaudiPhoneE164(masked.phone as string | null | undefined);
    return { ...masked, contactPhoneE164 };
  });

  // SEC-010: never log the raw search term or raw filter values — `filters.search`
  // can be a phone/email/nationalId. Record only that a search happened + which
  // non-search filter keys were used, plus the result count.
  logAuditEvent({ userId: session.userId, userEmail: session.email, userRole: session.role, action: hasPiiAccess ? "READ_PII" : "READ", resource: "Customer", metadata: { hasSearch: Boolean(filters?.search), filterKeys: Object.keys(filters ?? {}).filter((k) => k !== "search"), count: results.length }, organizationId: session.organizationId });

  return serialize(maskedList);
}

export async function deleteCustomer(customerId: string) {
  const session = await requirePermission("customers:delete");

  await db.customer.delete({
    where: { id: customerId, organizationId: session.organizationId },
  });

  logAuditEvent({ userId: session.userId, userEmail: session.email, userRole: session.role, action: "DELETE", resource: "Customer", resourceId: customerId, organizationId: session.organizationId });

  revalidatePath(ROUTES.crm);
}

export async function getCustomerUnitAssignments(customerId: string) {
  const session = await requirePermission("customers:read");
  const orgId = session.organizationId;

  const customer = await db.customer.findFirst({
    where: { id: customerId, organizationId: orgId },
    include: {
      reservations: {
        where: { status: { in: ["PENDING", "CONFIRMED"] } },
        include: { unit: true },
      },
      contracts: {
        where: { status: "SIGNED" },
        include: { unit: true },
      },
      leases: {
        where: { status: "ACTIVE" },
        include: { unit: true },
      },
    },
  });

  if (!customer) throw new Error("Customer not found or you don't have access. Please verify the customer exists in your organization.");

  const units = [
    ...customer.reservations.map(r => ({ unitId: r.unit.id, unitNumber: r.unit.number, building: r.unit.buildingName ?? r.unit.city ?? "—", type: "reservation" as const, status: r.status })),
    ...customer.contracts.map(c => ({ unitId: c.unit.id, unitNumber: c.unit.number, building: c.unit.buildingName ?? c.unit.city ?? "—", type: "contract" as const, status: c.status })),
    ...customer.leases.map(l => ({ unitId: l.unit.id, unitNumber: l.unit.number, building: l.unit.buildingName ?? l.unit.city ?? "—", type: "lease" as const, status: l.status })),
  ];

  return serialize(units);
}

export async function addCustomerActivity(
  customerId: string,
  data: { type: string; note: string }
) {
  const session = await requirePermission("crm:write");

  const customer = await db.customer.findFirst({
    where: { id: customerId, organizationId: session.organizationId },
  });
  if (!customer) throw new Error("Customer not found or you don't have access.");

  const activity = await db.customerActivity.create({
    data: {
      customerId,
      type: data.type as ActivityType,
      note: data.note,
      createdById: session.userId,
    },
    include: {
      createdBy: { select: { id: true, name: true } },
    },
  });

  revalidatePath(ROUTES.crm);
  return serialize(activity);
}

export async function getCustomerActivities(customerId: string) {
  const session = await requirePermission("crm:read");

  const customer = await db.customer.findFirst({
    where: { id: customerId, organizationId: session.organizationId },
  });
  if (!customer) throw new Error("Customer not found or you don't have access.");

  const activities = await db.customerActivity.findMany({
    where: { customerId },
    include: {
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return serialize(activities);
}

export async function deleteCustomerActivity(activityId: string) {
  const session = await requirePermission("crm:write");

  const activity = await db.customerActivity.findFirst({
    where: { id: activityId },
    include: { customer: { select: { organizationId: true } } },
  });

  if (!activity || activity.customer.organizationId !== session.organizationId) {
    throw new Error("Activity not found or you don't have access.");
  }

  await db.customerActivity.delete({ where: { id: activityId } });
  revalidatePath(ROUTES.crm);
}
