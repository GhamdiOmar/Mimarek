"use server";

import { db, UnitStatus, CustomerStatus } from "@repo/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "../../lib/auth-helpers";
import { logAuditEvent } from "../../lib/audit";
import { checkLimit, FEATURE_KEYS } from "../../lib/entitlements";
import { isValidUnitTransition } from "../../lib/units/state-machine";
import { ROUTES } from "../../lib/routes";
import { serialize } from "../../lib/serialize";

// Module-private — NOT exported (this is a "use server" file; only async functions may be exported)
const CreateUnitSchema = z.object({
  number: z.string().min(1, "Unit number is required"),
  type: z.enum(["APARTMENT", "VILLA", "OFFICE", "RETAIL", "WAREHOUSE", "PARKING"], {
    errorMap: () => ({ message: "Invalid unit type" }),
  }),
  area: z.number().positive().optional(),
  price: z.number().nonnegative().optional(),
  markupPrice: z.number().nonnegative().optional(),
  rentalPrice: z.number().nonnegative().optional(),
  floor: z.number().int().optional(),
  buildingName: z.string().optional(),
  addressLine: z.string().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  bedrooms: z.number().int().nonnegative().optional(),
  bathrooms: z.number().int().nonnegative().optional(),
  commercialStrategy: z.enum(["SELL", "LEASE", "HOLD", "TRANSFER", "COMMUNITY"]).optional(),
});

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

  revalidatePath(ROUTES.units);
  return serialize(updated);
}

// Server actions are a trust boundary: the client passes `status` as a plain
// string over the wire (UnitsView builds `{ id, status: newStatus }` where
// newStatus is a string), so the public param keeps `status?: string`. We narrow
// each value to the `UnitStatus` Prisma enum below — replacing the old unchecked
// `as any` with a real runtime guard, so only valid enum members ever reach
// Prisma (an invalid status now fails fast instead of silently flowing through).
type MassUpdateUnitInput = { id: string; price?: number; status?: string };

const UNIT_STATUS_VALUES = new Set<string>(Object.values(UnitStatus));

function toUnitStatus(value: string | undefined): UnitStatus | undefined {
  if (value === undefined) return undefined;
  if (!UNIT_STATUS_VALUES.has(value)) {
    throw new Error(`Invalid unit status: "${value}".`);
  }
  return value as UnitStatus;
}

export async function massUpdateUnits(units: MassUpdateUnitInput[]) {
  const session = await requirePermission("units:write");

  // Narrow each wire-level status string to the UnitStatus enum up front (throws
  // on any invalid value). Downstream code operates on typed UnitStatus only.
  const typedUnits = units.map((u) => ({
    id: u.id,
    price: u.price,
    status: toUnitStatus(u.status),
  }));

  // Verify all units belong to org (also gives us current status for SM validation)
  const unitIds = typedUnits.map((u) => u.id);
  const existingUnits = await db.unit.findMany({
    where: { id: { in: unitIds }, organizationId: session.organizationId },
    select: { id: true, number: true, status: true },
  });

  if (existingUnits.length !== unitIds.length) {
    throw new Error("One or more units do not belong to your organization. Please verify the selected units.");
  }

  // Build a lookup for current status by id
  const currentById = new Map(existingUnits.map((u) => [u.id, u]));

  // ── State-machine validation (QA-BE-01) ──────────────────────────────────────
  // Collect every invalid transition and reject the whole batch with one error.
  const invalidTransitions: string[] = [];

  for (const u of typedUnits) {
    if (!u.status) continue; // price-only update, no status change
    const current = currentById.get(u.id);
    if (!current) continue; // already caught above
    if (current.status === u.status) continue; // same-status no-op, always allowed

    if (!isValidUnitTransition(current.status, u.status)) {
      invalidTransitions.push(
        `Unit "${current.number}": ${current.status} → ${u.status} is not a valid transition`
      );
    }
  }

  if (invalidTransitions.length > 0) {
    throw new Error(
      `Status transition rejected for ${invalidTransitions.length} unit(s):\n` +
      invalidTransitions.join("\n")
    );
  }

  // ── Active-contract / active-lease guard ─────────────────────────────────────
  // Block transitions to AVAILABLE or RESERVED when the unit has an active
  // SIGNED contract or a non-ended lease — these transitions would silently
  // contradict live business records.
  const unitsGoingAvailableOrReserved = typedUnits.filter(
    (u) => u.status === "AVAILABLE" || u.status === "RESERVED"
  );

  if (unitsGoingAvailableOrReserved.length > 0) {
    const targetIds = unitsGoingAvailableOrReserved.map((u) => u.id);

    const [activeContracts, activeLeases] = await Promise.all([
      db.contract.findMany({
        where: {
          unitId: { in: targetIds },
          status: "SIGNED",
        },
        select: { unitId: true },
      }),
      db.lease.findMany({
        where: {
          unitId: { in: targetIds },
          endDate: { gt: new Date() },
        },
        select: { unitId: true },
      }),
    ]);

    const blockedUnitIds = new Set([
      ...activeContracts.map((c) => c.unitId),
      ...activeLeases.map((l) => l.unitId),
    ]);

    if (blockedUnitIds.size > 0) {
      const blockedNumbers = [...blockedUnitIds]
        .map((id) => currentById.get(id)?.number ?? id)
        .join(", ");
      throw new Error(
        `Cannot mark unit(s) as AVAILABLE or RESERVED while an active signed contract or lease exists: ${blockedNumbers}. ` +
        `Resolve the contract or lease first.`
      );
    }
  }

  // ── Execute batch update ──────────────────────────────────────────────────────
  const results = await db.$transaction(
    typedUnits.map((u) =>
      db.unit.update({
        where: { id: u.id },
        data: {
          price: u.price,
          status: u.status,
        },
      })
    )
  );

  revalidatePath(ROUTES.units);
  return serialize(results);
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
  return serialize(units);
}

export async function createUnit(data: {
  number: string;
  type: string;
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
}) {
  const session = await requirePermission("units:write");

  // Validate and whitelist caller input — reject unknown/extra fields, enforce type safety
  const parsed = CreateUnitSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(
      "Invalid unit data: " + parsed.error.issues.map((i) => i.message).join(", ")
    );
  }
  const safe = parsed.data;

  // Entitlement check: units.max
  const unitCount = await db.unit.count({
    where: { organizationId: session.organizationId },
  });
  const entitlement = await checkLimit(session.organizationId, FEATURE_KEYS.UNITS_MAX, unitCount);
  if (!entitlement.granted) {
    throw new Error(entitlement.reason ?? "Unit limit reached. Please upgrade your plan.");
  }

  // Explicit field mapping — no ...spread; status is always AVAILABLE on create
  const unit = await db.unit.create({
    data: {
      number: safe.number,
      type: safe.type,
      status: "AVAILABLE",
      organizationId: session.organizationId,
      area: safe.area,
      price: safe.price !== undefined ? Number(safe.price) : undefined,
      markupPrice: safe.markupPrice !== undefined ? Number(safe.markupPrice) : undefined,
      rentalPrice: safe.rentalPrice !== undefined ? Number(safe.rentalPrice) : undefined,
      floor: safe.floor,
      buildingName: safe.buildingName,
      addressLine: safe.addressLine,
      city: safe.city,
      district: safe.district,
      bedrooms: safe.bedrooms,
      bathrooms: safe.bathrooms,
      commercialStrategy: safe.commercialStrategy,
    },
  });

  revalidatePath(ROUTES.units);
  return serialize(unit);
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
  revalidatePath(ROUTES.units);
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

  return serialize({
    totalRentCollected,
    saleRevenue,
    totalMaintenanceCost,
    netIncome: totalRentCollected + saleRevenue - totalMaintenanceCost,
  });
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

  return contract ? serialize(contract) : null;
}

export async function getCustomersForUnitAction() {
  const session = await requirePermission("customers:read");

  const customers = await db.customer.findMany({
    where: {
      organizationId: session.organizationId,
      status: {
        in: [
          CustomerStatus.NEW,
          CustomerStatus.INTERESTED,
          CustomerStatus.QUALIFIED,
          CustomerStatus.VIEWING,
        ],
      },
    },
    select: { id: true, name: true, phone: true, status: true },
    orderBy: { name: "asc" },
  });

  return serialize(customers);
}
