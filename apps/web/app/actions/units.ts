"use server";

import { db } from "@repo/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "../../lib/auth-helpers";
import { logAuditEvent } from "../../lib/audit";
import { checkLimit, FEATURE_KEYS } from "../../lib/entitlements";

type UpdateUnitInput = {
  number?: string;
  type?: string;
  area?: number;
  price?: number;
  markupPrice?: number;
  rentalPrice?: number;
  floor?: number;
  buildingName?: string;
  addressLine?: string;
  city?: string;
  district?: string;
  bedrooms?: number;
  bathrooms?: number;
  commercialStrategy?: string;
};

export async function updateUnit(unitId: string, data: UpdateUnitInput) {
  const session = await requirePermission("units:write");

  // Verify unit belongs to user's org
  const unit = await db.unit.findFirst({
    where: { id: unitId, organizationId: session.organizationId },
  });
  if (!unit) {
    throw new Error("Unit not found or you don't have access. Please verify the unit exists in your organization.");
  }

  // Map only whitelisted fields — prevents arbitrary field injection
  // (organizationId, id, status lifecycle fields, timestamps are excluded)
  const safeData: Record<string, unknown> = {};
  if (data.number !== undefined) safeData.number = data.number;
  if (data.type !== undefined) safeData.type = data.type;
  if (data.area !== undefined) safeData.area = data.area;
  if (data.price !== undefined) safeData.price = data.price;
  if (data.markupPrice !== undefined) safeData.markupPrice = data.markupPrice;
  if (data.rentalPrice !== undefined) safeData.rentalPrice = data.rentalPrice;
  if (data.floor !== undefined) safeData.floor = data.floor;
  if (data.buildingName !== undefined) safeData.buildingName = data.buildingName;
  if (data.addressLine !== undefined) safeData.addressLine = data.addressLine;
  if (data.city !== undefined) safeData.city = data.city;
  if (data.district !== undefined) safeData.district = data.district;
  if (data.bedrooms !== undefined) safeData.bedrooms = data.bedrooms;
  if (data.bathrooms !== undefined) safeData.bathrooms = data.bathrooms;
  if (data.commercialStrategy !== undefined) safeData.commercialStrategy = data.commercialStrategy;

  const updated = await db.unit.update({
    where: { id: unitId },
    data: safeData,
  });

  revalidatePath("/dashboard/units");
  return JSON.parse(JSON.stringify(updated));
}

export async function massUpdateUnits(
  units: { id: string; price?: number; status?: any }[]
) {
  const session = await requirePermission("units:write");

  // Verify all units belong to org
  const unitIds = units.map((u) => u.id);
  const existingUnits = await db.unit.findMany({
    where: { id: { in: unitIds }, organizationId: session.organizationId },
  });

  if (existingUnits.length !== unitIds.length) {
    throw new Error("One or more units do not belong to your organization. Please verify the selected units.");
  }

  const results = await db.$transaction(
    units.map((u) =>
      db.unit.update({
        where: { id: u.id },
        data: {
          price: u.price,
          status: u.status,
        },
      })
    )
  );

  revalidatePath("/dashboard/units");
  return JSON.parse(JSON.stringify(results));
}

export async function getUnitsWithBuildings(filters?: {
  page?: number;
  pageSize?: number;
}) {
  const session = await requirePermission("units:read");

  const page = Math.max(1, filters?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters?.pageSize ?? 50));
  const skip = (page - 1) * pageSize;

  const units = await db.unit.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { number: "asc" },
    skip,
    take: pageSize,
  });
  return JSON.parse(JSON.stringify(units));
}

export async function createUnit(data: {
  number: string;
  type: any;
  area?: number;
  price?: number;
  markupPrice?: number;
  rentalPrice?: number;
  status?: any;
}) {
  const session = await requirePermission("units:write");

  // Entitlement check: units.max
  const unitCount = await db.unit.count({
    where: { organizationId: session.organizationId },
  });
  const entitlement = await checkLimit(session.organizationId, FEATURE_KEYS.UNITS_MAX, unitCount);
  if (!entitlement.granted) {
    throw new Error(entitlement.reason ?? "Unit limit reached. Please upgrade your plan.");
  }

  const unit = await db.unit.create({
    data: {
      ...data,
      organizationId: session.organizationId,
      price: data.price ? Number(data.price) : undefined,
      markupPrice: data.markupPrice ? Number(data.markupPrice) : undefined,
      rentalPrice: data.rentalPrice ? Number(data.rentalPrice) : undefined,
    },
  });

  revalidatePath("/dashboard/units");
  return JSON.parse(JSON.stringify(unit));
}

export async function deleteUnit(unitId: string) {
  const session = await requirePermission("units:delete");

  const unit = await db.unit.findFirst({
    where: { id: unitId, organizationId: session.organizationId },
  });
  if (!unit) {
    throw new Error("Unit not found or you don't have access. Please verify the unit exists in your organization.");
  }

  await db.unit.delete({ where: { id: unitId } });
  revalidatePath("/dashboard/units");
}

export async function getUnitFinancialSummary(unitId: string) {
  const session = await requirePermission("units:read");

  const unit = await db.unit.findFirst({
    where: { id: unitId, organizationId: session.organizationId },
    include: {
      leases: {
        include: { installments: true },
      },
      maintenanceRequests: {
        select: { actualCost: true, estimatedCost: true },
      },
      contracts: {
        where: { status: "SIGNED", type: "SALE" },
        select: { amount: true },
      },
    },
  });
  if (!unit) {
    throw new Error("Unit not found or you don't have access. Please verify the unit exists in your organization.");
  }

  const totalRentCollected = unit.leases.reduce((s, l) =>
    s + l.installments.filter(i => i.status === "PAID").reduce((is, i) => is + Number(i.amount), 0), 0);
  const totalMaintenanceCost = unit.maintenanceRequests.reduce((s, m) =>
    s + Number(m.actualCost ?? m.estimatedCost ?? 0), 0);
  const saleRevenue = unit.contracts.reduce((s, c) => s + Number(c.amount), 0);

  return JSON.parse(JSON.stringify({
    totalRentCollected,
    saleRevenue,
    totalMaintenanceCost,
    netIncome: totalRentCollected + saleRevenue - totalMaintenanceCost,
  }));
}

export async function getActiveContractForUnit(unitId: string) {
  const session = await requirePermission("units:read");

  const unit = await db.unit.findFirst({
    where: { id: unitId, organizationId: session.organizationId },
  });
  if (!unit) return null;

  const contract = await db.contract.findFirst({
    where: {
      unitId,
      status: { in: ["DRAFT", "SENT", "SIGNED"] },
    },
    include: { customer: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return contract ? JSON.parse(JSON.stringify(contract)) : null;
}

export async function getCustomersForUnitAction() {
  const session = await requirePermission("customers:read");

  const customers = await db.customer.findMany({
    where: {
      organizationId: session.organizationId,
      status: { in: ["NEW", "INTERESTED", "QUALIFIED", "VIEWING"] as any },
    },
    select: { id: true, name: true, phone: true, status: true },
    orderBy: { name: "asc" },
  });

  return JSON.parse(JSON.stringify(customers));
}
