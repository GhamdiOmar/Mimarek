"use server";

import { db } from "@repo/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "../../lib/auth-helpers";

// ─── Recurrence Helpers ──────────────────────────────────────────────────────

function computeNextRunDate(
  recurrenceType: string,
  interval: number,
  from: Date
): Date {
  const next = new Date(from);
  switch (recurrenceType) {
    case "DAILY":
      next.setDate(next.getDate() + interval);
      break;
    case "WEEKLY":
      next.setDate(next.getDate() + 7 * interval);
      break;
    case "BIWEEKLY":
      next.setDate(next.getDate() + 14 * interval);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + interval);
      break;
    case "QUARTERLY":
      next.setMonth(next.getMonth() + 3 * interval);
      break;
    case "SEMI_ANNUAL":
      next.setMonth(next.getMonth() + 6 * interval);
      break;
    case "ANNUAL":
      next.setFullYear(next.getFullYear() + interval);
      break;
    default:
      next.setMonth(next.getMonth() + interval);
  }
  return next;
}

// ─── Create Preventive Plan ──────────────────────────────────────────────────

export async function createPreventivePlan(data: {
  title: string;
  description?: string;
  category?: string;
  priority?: string;
  unitId?: string;
  recurrenceType: string;
  recurrenceInterval?: number;
  startDate: string;
  endDate?: string;
  estimatedCost?: number;
  estimatedHours?: number;
  assignToId?: string;
}) {
  const session = await requirePermission("preventive_maintenance:write");
  const interval = data.recurrenceInterval ?? 1;
  const startDate = new Date(data.startDate);
  const nextRunDate = computeNextRunDate(data.recurrenceType, interval, startDate);

  const plan = await db.preventiveMaintenancePlan.create({
    data: {
      title: data.title,
      description: data.description,
      category: (data.category as any) ?? "GENERAL",
      priority: (data.priority as any) ?? "MEDIUM",
      unitId: data.unitId || undefined,
      recurrenceType: data.recurrenceType as any,
      recurrenceInterval: interval,
      startDate,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      nextRunDate,
      estimatedCost: data.estimatedCost,
      estimatedHours: data.estimatedHours,
      assignToId: data.assignToId || undefined,
      isActive: true,
      organizationId: session.organizationId,
    },
  });

  revalidatePath("/dashboard/maintenance/preventive");
  return JSON.parse(JSON.stringify(plan));
}

// ─── Get Preventive Plans ────────────────────────────────────────────────────

export async function getPreventivePlans(filters?: {
  isActive?: boolean;
  category?: string;
  unitId?: string;
}) {
  const session = await requirePermission("preventive_maintenance:read");

  const where: any = { organizationId: session.organizationId };
  if (filters?.isActive !== undefined) where.isActive = filters.isActive;
  if (filters?.category) where.category = filters.category;
  if (filters?.unitId) where.unitId = filters.unitId;

  const plans = await db.preventiveMaintenancePlan.findMany({
    where,
    include: {
      unit: { select: { id: true, number: true } },
      _count: { select: { workOrders: true } },
    },
    orderBy: { nextRunDate: "asc" },
  });
  return JSON.parse(JSON.stringify(plans));
}

// ─── Update Preventive Plan ─────────────────────────────────────────────────

export async function updatePreventivePlan(
  planId: string,
  data: {
    title?: string;
    description?: string;
    category?: string;
    priority?: string;
    unitId?: string | null;
    recurrenceType?: string;
    recurrenceInterval?: number;
    startDate?: string;
    endDate?: string | null;
    estimatedCost?: number | null;
    estimatedHours?: number | null;
    assignToId?: string | null;
  }
) {
  const session = await requirePermission("preventive_maintenance:write");

  const plan = await db.preventiveMaintenancePlan.findFirst({
    where: { id: planId, organizationId: session.organizationId },
  });
  if (!plan) throw new Error("The selected plan was not found. Please refresh and try again.");

  const updateData: any = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.unitId !== undefined) updateData.unitId = data.unitId || null;
  if (data.assignToId !== undefined) updateData.assignToId = data.assignToId || null;
  if (data.estimatedCost !== undefined) updateData.estimatedCost = data.estimatedCost;
  if (data.estimatedHours !== undefined) updateData.estimatedHours = data.estimatedHours;
  if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null;

  if (data.recurrenceType !== undefined || data.recurrenceInterval !== undefined || data.startDate !== undefined) {
    const recType = data.recurrenceType ?? plan.recurrenceType;
    const recInterval = data.recurrenceInterval ?? plan.recurrenceInterval;
    const start = data.startDate ? new Date(data.startDate) : plan.startDate;
    updateData.recurrenceType = recType;
    updateData.recurrenceInterval = recInterval;
    updateData.startDate = start;
    updateData.nextRunDate = computeNextRunDate(recType, recInterval, start);
  }

  const updated = await db.preventiveMaintenancePlan.update({
    where: { id: planId },
    data: updateData,
  });

  revalidatePath("/dashboard/maintenance/preventive");
  return JSON.parse(JSON.stringify(updated));
}

// ─── Toggle Preventive Plan ─────────────────────────────────────────────────

export async function togglePreventivePlan(planId: string) {
  const session = await requirePermission("preventive_maintenance:write");

  const plan = await db.preventiveMaintenancePlan.findFirst({
    where: { id: planId, organizationId: session.organizationId },
  });
  if (!plan) throw new Error("The selected plan was not found. Please refresh and try again.");

  const updated = await db.preventiveMaintenancePlan.update({
    where: { id: planId },
    data: { isActive: !plan.isActive },
  });

  revalidatePath("/dashboard/maintenance/preventive");
  return JSON.parse(JSON.stringify(updated));
}

// ─── Delete Preventive Plan ─────────────────────────────────────────────────

export async function deletePreventivePlan(planId: string) {
  const session = await requirePermission("preventive_maintenance:delete");

  const plan = await db.preventiveMaintenancePlan.findFirst({
    where: { id: planId, organizationId: session.organizationId },
  });
  if (!plan) throw new Error("The selected plan was not found. Please refresh and try again.");

  await db.preventiveMaintenancePlan.update({
    where: { id: planId },
    data: { isActive: false },
  });

  revalidatePath("/dashboard/maintenance/preventive");
}

// ─── Generate Work Orders from Plans ─────────────────────────────────────────

export async function generateWorkOrdersFromPlans() {
  const session = await requirePermission("preventive_maintenance:write");
  const now = new Date();

  const duePlans = await db.preventiveMaintenancePlan.findMany({
    where: {
      organizationId: session.organizationId,
      isActive: true,
      nextRunDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
  });

  const SLA_HOURS: Record<string, number> = {
    URGENT: 2,
    HIGH: 24,
    MEDIUM: 72,
    LOW: 168,
  };

  let created = 0;
  for (const plan of duePlans) {
    const priority = plan.priority;
    const ms = (SLA_HOURS[priority] ?? 72) * 60 * 60 * 1000;
    const dueDate = new Date(now.getTime() + ms);

    await db.maintenanceRequest.create({
      data: {
        title: `[وقائي] ${plan.title}`,
        description: plan.description ?? undefined,
        category: plan.category as any,
        priority: priority as any,
        unitId: plan.unitId!,
        assignedToId: plan.assignToId ?? undefined,
        status: plan.assignToId ? ("ASSIGNED" as any) : "OPEN",
        dueDate,
        estimatedCost: plan.estimatedCost,
        isPreventive: true,
        preventivePlanId: plan.id,
        organizationId: session.organizationId,
      },
    });

    const nextRun = computeNextRunDate(
      plan.recurrenceType,
      plan.recurrenceInterval,
      now
    );
    await db.preventiveMaintenancePlan.update({
      where: { id: plan.id },
      data: { nextRunDate: nextRun },
    });

    created++;
  }

  revalidatePath("/dashboard/maintenance/tickets");
  revalidatePath("/dashboard/maintenance/preventive");
  return { created, total: duePlans.length };
}

