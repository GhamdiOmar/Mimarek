"use server";

import { db, CustomerStatus } from "@repo/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission, getSessionWithPermissions } from "../../lib/auth-helpers";
import { logAuditEvent } from "../../lib/audit";
import { encryptCustomerData, decryptCustomerData, decryptCustomerList } from "../../lib/pii-crypto";
import { maskCustomerPii } from "../../lib/pii-masking";
import { hashForSearch } from "../../lib/encryption";
import { normalizeSaudiPhoneE164 } from "../../lib/phone";

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
});

export async function updateCustomerStatus(customerId: string, status: any, lostReason?: string) {
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
    revalidatePath("/dashboard/crm");
    return JSON.parse(JSON.stringify({ ...existing, status: validatedStatus, lostReason: resolvedLostReason }));
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

  revalidatePath("/dashboard/crm");
  return JSON.parse(JSON.stringify(customer));
}

export async function createCustomer(data: {
  name: string;
  phone: string;
  email?: string;
  source?: string;
  status?: any;
  nationalId?: string;
  nameArabic?: string;
  personType?: any;
  gender?: any;
  dateOfBirth?: string;
  dateOfBirthHijri?: string;
  nationality?: string;
  nationalityCode?: string;
  maritalStatus?: string;
  address?: any;
  documentInfo?: any;
  budget?: number;
  propertyTypeInterest?: string;
  agentId?: string;
}) {
  const parsed = CreateCustomerSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Invalid input: " + parsed.error.issues.map(i => i.message).join(", "));
  }
  data = parsed.data;

  const session = await requirePermission("customers:write");

  // Encrypt PII fields before saving
  const encryptedData = encryptCustomerData({
    nationalId: data.nationalId,
    phone: data.phone,
    email: data.email,
  });

  const customer = await db.customer.create({
    data: {
      name: data.name,
      phone: encryptedData.phone,
      email: encryptedData.email || undefined,
      source: data.source || undefined,
      status: data.status || undefined,
      nationalId: encryptedData.nationalId,
      nationalIdHash: encryptedData.nationalIdHash,
      phoneHash: encryptedData.phoneHash,
      emailHash: encryptedData.emailHash,
      nameArabic: data.nameArabic || undefined,
      personType: data.personType || undefined,
      gender: data.gender || undefined,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      dateOfBirthHijri: data.dateOfBirthHijri || undefined,
      nationality: data.nationality || undefined,
      nationalityCode: data.nationalityCode || undefined,
      maritalStatus: data.maritalStatus || undefined,
      address: data.address || undefined,
      documentInfo: data.documentInfo || undefined,
      budget: data.budget ?? undefined,
      propertyTypeInterest: data.propertyTypeInterest || undefined,
      agentId: data.agentId || undefined,
      organizationId: session.organizationId,
    },
  });

  logAuditEvent({ userId: session.userId, userEmail: session.email, userRole: session.role, action: "CREATE", resource: "Customer", resourceId: customer.id, organizationId: session.organizationId });

  revalidatePath("/dashboard/crm");
  return JSON.parse(JSON.stringify(customer));
}

export async function getCustomer(customerId: string) {
  const session = await getSessionWithPermissions();
  const hasPiiAccess = session.can("customers:read_pii");

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

  return JSON.parse(JSON.stringify({ ...masked, contactPhoneE164 }));
}

export async function updateCustomer(
  customerId: string,
  data: {
    name?: string;
    phone?: string;
    email?: string;
    nationalId?: string;
    nameArabic?: string;
    personType?: any;
    gender?: any;
    dateOfBirth?: string;
    dateOfBirthHijri?: string;
    nationality?: string;
    nationalityCode?: string;
    maritalStatus?: string;
    address?: any;
    documentInfo?: any;
    source?: string;
    agentId?: string;
    budget?: number;
    propertyTypeInterest?: string;
  }
) {
  const session = await requirePermission("customers:write");

  // Sanitize empty strings to undefined for enum/optional fields
  const updateData: any = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, v === "" ? undefined : v])
  );
  if (data.dateOfBirth) updateData.dateOfBirth = new Date(data.dateOfBirth);

  // Encrypt PII fields if being updated
  if (data.nationalId) {
    const enc = encryptCustomerData({ nationalId: data.nationalId });
    updateData.nationalId = enc.nationalId;
    updateData.nationalIdHash = enc.nationalIdHash;
  }
  if (data.phone) {
    const enc = encryptCustomerData({ phone: data.phone });
    updateData.phone = enc.phone;
    updateData.phoneHash = enc.phoneHash;
  }
  if (data.email) {
    const enc = encryptCustomerData({ email: data.email });
    updateData.email = enc.email;
    updateData.emailHash = enc.emailHash;
  }

  const customer = await db.customer.update({
    where: { id: customerId, organizationId: session.organizationId },
    data: updateData,
  });

  logAuditEvent({ userId: session.userId, userEmail: session.email, userRole: session.role, action: "UPDATE", resource: "Customer", resourceId: customerId, metadata: { fields: Object.keys(data) }, organizationId: session.organizationId });

  revalidatePath("/dashboard/crm");
  return JSON.parse(JSON.stringify(customer));
}

export async function getCustomers(filters?: {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const session = await getSessionWithPermissions();
  const hasPiiAccess = session.can("customers:read_pii");

  const where: any = { organizationId: session.organizationId };

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.search) {
    const searchHash = hashForSearch(filters.search);
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { nameArabic: { contains: filters.search, mode: "insensitive" } },
      // Exact match via hash for encrypted fields
      { phoneHash: searchHash },
      { emailHash: searchHash },
      { nationalIdHash: searchHash },
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

  logAuditEvent({ userId: session.userId, userEmail: session.email, userRole: session.role, action: hasPiiAccess ? "READ_PII" : "READ", resource: "Customer", metadata: { filters, count: results.length }, organizationId: session.organizationId });

  return JSON.parse(JSON.stringify(maskedList));
}

export async function deleteCustomer(customerId: string) {
  const session = await requirePermission("customers:delete");

  await db.customer.delete({
    where: { id: customerId, organizationId: session.organizationId },
  });

  logAuditEvent({ userId: session.userId, userEmail: session.email, userRole: session.role, action: "DELETE", resource: "Customer", resourceId: customerId, organizationId: session.organizationId });

  revalidatePath("/dashboard/crm");
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

  return JSON.parse(JSON.stringify(units));
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
      type: data.type as any,
      note: data.note,
      createdById: session.userId,
    },
    include: {
      createdBy: { select: { id: true, name: true } },
    },
  });

  revalidatePath("/dashboard/crm");
  return JSON.parse(JSON.stringify(activity));
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

  return JSON.parse(JSON.stringify(activities));
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
  revalidatePath("/dashboard/crm");
}
