"use server";

import { db, MaintenanceCategory, MaintenancePriority } from "@repo/db";
import { revalidatePath } from "next/cache";
import { ROUTES } from "../../lib/routes";
import { serialize } from "../../lib/serialize";
import { resolvePortalIdentity } from "../../lib/server/portal-access";

const MAINTENANCE_CATEGORIES = new Set([
  "HVAC",
  "PLUMBING",
  "ELECTRICAL",
  "STRUCTURAL",
  "FIRE_SAFETY",
  "ELEVATOR",
  "CLEANING",
  "LANDSCAPING",
  "PEST_CONTROL",
  "GENERAL",
]);
const MAINTENANCE_PRIORITIES = new Set(["LOW", "MEDIUM", "HIGH", "URGENT"]);

// eslint-disable-next-line mimaric/require-action-guard -- guarded via resolvePortalIdentity() (auth() + role==="USER" check + org-scoped customer resolution).
export async function getTenantPortalSummary() {
  const { customer } = await resolvePortalIdentity();
  const activeLease = await db.lease.findFirst({
    where: { customerId: customer.id, status: { in: ["ACTIVE", "PENDING_SIGNATURE"] } },
    include: {
      unit: { select: { id: true, number: true, type: true, buildingName: true, addressLine: true, city: true, district: true } },
      installments: { orderBy: { dueDate: "asc" } },
    },
    orderBy: { startDate: "desc" },
  });

  const maintenance = activeLease
    ? await db.maintenanceRequest.findMany({
        where: { organizationId: customer.organizationId, unitId: activeLease.unitId },
        orderBy: { createdAt: "desc" },
        take: 10,
      })
    : [];

  return serialize({ customer, activeLease, maintenance });
}

// eslint-disable-next-line mimaric/require-action-guard -- guarded via resolvePortalIdentity() (auth() + role==="USER" + org-scoped customer/lease) before any write.
export async function createTenantMaintenanceRequest(data: {
  title: string;
  description?: string;
  category: string;
  priority: string;
}) {
  const { customer } = await resolvePortalIdentity();
  const activeLease = await db.lease.findFirst({
    where: { customerId: customer.id, status: "ACTIVE" },
    select: { unitId: true },
    orderBy: { startDate: "desc" },
  });
  if (!activeLease) return { success: false, error: "No active lease found" };

  const title = data.title.trim();
  if (title.length < 3) return { success: false, error: "Title is required" };
  if (!MAINTENANCE_CATEGORIES.has(data.category)) return { success: false, error: "Invalid maintenance category" };
  if (!MAINTENANCE_PRIORITIES.has(data.priority)) return { success: false, error: "Invalid maintenance priority" };

  await db.maintenanceRequest.create({
    data: {
      title,
      description: data.description?.trim() || null,
      category: data.category as MaintenanceCategory,
      priority: data.priority as MaintenancePriority,
      unitId: activeLease.unitId,
      organizationId: customer.organizationId,
      status: "OPEN",
    },
  });

  revalidatePath(ROUTES.portal);
  return { success: true };
}
