"use server";

import { db, MaintenanceCategory, MaintenancePriority } from "@repo/db";
import { revalidatePath } from "next/cache";
import { auth } from "../../auth";
import { hashForSearch } from "../../lib/encryption";

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

async function getPortalIdentity() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) throw new Error("Unauthorized");
  if (session.user.role !== "USER") throw new Error("Forbidden");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, organizationId: true },
  });
  if (!user?.organizationId) throw new Error("Missing organization");

  const customer = await db.customer.findFirst({
    where: {
      organizationId: user.organizationId,
      OR: [{ emailHash: hashForSearch(user.email) }, { email: user.email }],
    },
    select: { id: true, name: true, organizationId: true },
  });
  if (!customer) throw new Error("No tenant customer profile found");

  return { user, customer };
}

export async function getTenantPortalSummary() {
  const { customer } = await getPortalIdentity();
  const activeLease = await db.lease.findFirst({
    where: { customerId: customer.id, status: { in: ["ACTIVE", "PENDING_SIGNATURE"] } },
    include: {
      unit: { select: { id: true, number: true, type: true, buildingName: true, addressLine: true, city: true, district: true } },
      installments: { orderBy: { dueDate: "asc" } },
    },
    orderBy: { startDate: "desc" },
  });

  const documents = await db.document.findMany({
    where: {
      organizationId: customer.organizationId,
      OR: [{ customerId: customer.id }, ...(activeLease ? [{ unitId: activeLease.unitId }] : [])],
    },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  const maintenance = activeLease
    ? await db.maintenanceRequest.findMany({
        where: { organizationId: customer.organizationId, unitId: activeLease.unitId },
        orderBy: { createdAt: "desc" },
        take: 10,
      })
    : [];

  return JSON.parse(JSON.stringify({ customer, activeLease, documents, maintenance }));
}

export async function createTenantMaintenanceRequest(data: {
  title: string;
  description?: string;
  category: string;
  priority: string;
}) {
  const { customer } = await getPortalIdentity();
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

  revalidatePath("/portal");
  return { success: true };
}
