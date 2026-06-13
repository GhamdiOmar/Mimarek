"use server";

import { db } from "@repo/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "../../lib/auth-helpers";
import { logAuditEvent } from "../../lib/audit";

const CreateMaintenanceRequestSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  priority: z.enum(["URGENT", "HIGH", "MEDIUM", "LOW"]).optional(),
  unitId: z.string().cuid(),
  assignedToId: z.string().cuid().optional(),
  scheduledDate: z.string().optional(),
  estimatedCost: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});

// ─── SLA Due Date Computation ─────────────────────────────────────────────────

function computeDueDate(priority: string, from: Date = new Date()): Date {
  const hours: Record<string, number> = {
    URGENT: 2,
    HIGH: 24,
    MEDIUM: 72,
    LOW: 168,
  };
  const ms = (hours[priority] ?? 72) * 60 * 60 * 1000;
  return new Date(from.getTime() + ms);
}

// ─── Status Transition Validator ──────────────────────────────────────────────

const VALID_TRANSITIONS: Record<string, string[]> = {
  OPEN: ["ASSIGNED", "IN_PROGRESS", "CLOSED"],
  ASSIGNED: ["IN_PROGRESS", "ON_HOLD", "OPEN"],
  IN_PROGRESS: ["ON_HOLD", "RESOLVED"],
  ON_HOLD: ["IN_PROGRESS", "CLOSED"],
  RESOLVED: ["CLOSED", "IN_PROGRESS"],
  CLOSED: ["OPEN"],
};

export async function getValidTransitions(from: string): Promise<string[]> {
  return VALID_TRANSITIONS[from] ?? [];
}

// ─── Create Maintenance Request ───────────────────────────────────────────────

export async function createMaintenanceRequest(data: {
  title: string;
  description?: string;
  category?: string;
  priority?: string;
  unitId: string;
  assignedToId?: string;
  scheduledDate?: string;
  estimatedCost?: number;
  notes?: string;
}) {
  const parsed = CreateMaintenanceRequestSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Invalid input: " + parsed.error.issues.map(i => i.message).join(", "));
  }

  const session = await requirePermission("maintenance:write");
  const priority = parsed.data.priority ?? "MEDIUM";

  // Validate referenced records belong to the same org before creating
  const unit = await db.unit.findFirst({
    where: { id: parsed.data.unitId, organizationId: session.organizationId },
    select: { id: true, transferredToOrgId: true },
  });
  if (!unit) {
    throw new Error("Unit not found or you don't have access. Please verify the unit exists in your organization.");
  }

  // Marketplace guard: a unit transferred to a buyer org via the marketplace
  // can no longer receive seller-side maintenance (ownership moved).
  if (unit.transferredToOrgId) {
    logAuditEvent({
      userId: session.userId,
      userEmail: session.email,
      userRole: session.role,
      action: "MAINTENANCE_BLOCKED_NOT_OWNER",
      resource: "Unit",
      resourceId: parsed.data.unitId,
      organizationId: session.organizationId,
    });
    throw new Error(
      "This unit was transferred to another organization via the marketplace and can no longer receive maintenance requests from your organization.",
    );
  }

  if (parsed.data.assignedToId) {
    const assignee = await db.user.findFirst({
      where: { id: parsed.data.assignedToId, organizationId: session.organizationId },
      select: { id: true },
    });
    if (!assignee) {
      throw new Error("Assigned user not found or does not belong to your organization.");
    }
  }


  const request = await db.maintenanceRequest.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      category: (parsed.data.category as any) ?? "GENERAL",
      priority: priority as any,
      unitId: parsed.data.unitId,
      assignedToId: parsed.data.assignedToId || undefined,
      status: parsed.data.assignedToId ? ("ASSIGNED" as any) : "OPEN",
      scheduledDate: parsed.data.scheduledDate ? new Date(parsed.data.scheduledDate) : undefined,
      dueDate: computeDueDate(priority),
      estimatedCost: parsed.data.estimatedCost,
      notes: parsed.data.notes,
      organizationId: session.organizationId,
    },
  });

  revalidatePath("/dashboard/maintenance/tickets");
  return JSON.parse(JSON.stringify(request));
}

// ─── Get Maintenance Requests (List) ──────────────────────────────────────────

export async function getMaintenanceRequests(filters?: {
  status?: string;
  priority?: string;
  category?: string;
  unitId?: string;
  search?: string;
  overdue?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const session = await requirePermission("maintenance:read");

  const where: any = { organizationId: session.organizationId };
  if (filters?.status) where.status = filters.status;
  if (filters?.priority) where.priority = filters.priority;
  if (filters?.category) where.category = filters.category;
  if (filters?.unitId) where.unitId = filters.unitId;
  if (filters?.search) {
    where.title = { contains: filters.search, mode: "insensitive" };
  }
  if (filters?.overdue) {
    where.dueDate = { lt: new Date() };
    where.status = { notIn: ["RESOLVED", "CLOSED"] };
  }

  const page = Math.max(1, filters?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters?.pageSize ?? 50));
  const skip = (page - 1) * pageSize;

  const results = await db.maintenanceRequest.findMany({
    where,
    include: {
      unit: true,
      assignedTo: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    skip,
    take: pageSize,
  });
  return JSON.parse(JSON.stringify(results));
}

// ─── Get Single Maintenance Request ───────────────────────────────────────────

export async function getMaintenanceRequest(id: string) {
  const session = await requirePermission("maintenance:read");

  const request = await db.maintenanceRequest.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      unit: true,
      assignedTo: { select: { id: true, name: true, email: true } },
      preventivePlan: true,
    },
  });
  if (!request) throw new Error("Request not found or you don't have access. Please refresh the page and try again.");
  return JSON.parse(JSON.stringify(request));
}

// ─── Update Maintenance Request ───────────────────────────────────────────────

export async function updateMaintenanceRequest(
  requestId: string,
  data: {
    title?: string;
    description?: string;
    category?: string;
    priority?: string;
    status?: string;
    assignedToId?: string | null;
    scheduledDate?: string | null;
    estimatedCost?: number | null;
    actualCost?: number | null;
    laborHours?: number | null;
    notes?: string | null;
  }
) {
  const session = await requirePermission("maintenance:write");

  const request = await db.maintenanceRequest.findFirst({
    where: { id: requestId, organizationId: session.organizationId },
  });
  if (!request) throw new Error("Request not found or you don't have access. Please refresh the page and try again.");

  // Validate status transition
  if (data.status && data.status !== request.status) {
    if (!(await getValidTransitions(request.status)).includes(data.status)) {
      throw new Error("This status change is not allowed from the current maintenance request status. Please check the allowed workflow transitions.");
    }
  }

  // BOLA guard: a reassignment must target a user inside the caller's org.
  // Mirrors the create-path guard above; without it, updateMaintenanceRequest
  // would write an arbitrary cross-org assignedToId (OWASP API1:2023).
  if (data.assignedToId) {
    const assignee = await db.user.findFirst({
      where: { id: data.assignedToId, organizationId: session.organizationId },
      select: { id: true },
    });
    if (!assignee) {
      throw new Error("Assigned user not found or does not belong to your organization.");
    }
  }

  const updateData: any = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.priority !== undefined) {
    updateData.priority = data.priority;
    if (!["RESOLVED", "CLOSED"].includes(request.status)) {
      updateData.dueDate = computeDueDate(data.priority, request.createdAt);
    }
  }
  if (data.status !== undefined) {
    updateData.status = data.status;
    if (data.status === "RESOLVED") {
      updateData.completedAt = new Date();
      updateData.resolvedAt = new Date();
    }
  }
  if (data.assignedToId !== undefined) {
    updateData.assignedToId = data.assignedToId || null;
    if (data.assignedToId && request.status === "OPEN" && !data.status) {
      updateData.status = "ASSIGNED";
    }
  }
  if (data.scheduledDate !== undefined) {
    updateData.scheduledDate = data.scheduledDate ? new Date(data.scheduledDate) : null;
  }
  if (data.estimatedCost !== undefined) updateData.estimatedCost = data.estimatedCost;
  if (data.actualCost !== undefined) updateData.actualCost = data.actualCost;
  if (data.laborHours !== undefined) updateData.laborHours = data.laborHours;
  if (data.notes !== undefined) updateData.notes = data.notes;

  const updated = await db.maintenanceRequest.update({
    where: { id: requestId },
    data: updateData,
  });

  revalidatePath("/dashboard/maintenance/tickets");
  revalidatePath(`/dashboard/maintenance/${requestId}`);
  return JSON.parse(JSON.stringify(updated));
}

// ─── Delete Maintenance Request ───────────────────────────────────────────────

export async function deleteMaintenanceRequest(requestId: string) {
  const session = await requirePermission("maintenance:delete");

  const request = await db.maintenanceRequest.findFirst({
    where: { id: requestId, organizationId: session.organizationId },
  });
  if (!request) throw new Error("Request not found or you don't have access. Please refresh the page and try again.");

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "DELETE",
    resource: "MaintenanceRequest",
    resourceId: requestId,
    metadata: { title: request.title },
    organizationId: session.organizationId,
  });

  await db.maintenanceRequest.delete({ where: { id: requestId } });
  revalidatePath("/dashboard/maintenance/tickets");
}

// ─── Get Assignable Users ─────────────────────────────────────────────────────

export async function getAssignableUsers() {
  const session = await requirePermission("maintenance:write");

  const users = await db.user.findMany({
    where: {
      organizationId: session.organizationId,
      role: { in: ["TECHNICIAN", "MANAGER", "ADMIN"] as any },
    },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
  return users;
}

// ─── Get Maintenance Stats ────────────────────────────────────────────────────

export async function getMaintenanceStats() {
  const session = await requirePermission("maintenance:read");
  const orgId = session.organizationId;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [open, assigned, inProgress, onHold, overdue, completedThisMonth] = await Promise.all([
    db.maintenanceRequest.count({ where: { organizationId: orgId, status: "OPEN" } }),
    db.maintenanceRequest.count({ where: { organizationId: orgId, status: "ASSIGNED" as any } }),
    db.maintenanceRequest.count({ where: { organizationId: orgId, status: "IN_PROGRESS" } }),
    db.maintenanceRequest.count({ where: { organizationId: orgId, status: "ON_HOLD" as any } }),
    db.maintenanceRequest.count({
      where: {
        organizationId: orgId,
        dueDate: { lt: now },
        status: { notIn: ["RESOLVED", "CLOSED"] },
      },
    }),
    db.maintenanceRequest.count({
      where: {
        organizationId: orgId,
        status: { in: ["RESOLVED", "CLOSED"] },
        completedAt: { gte: startOfMonth },
      },
    }),
  ]);

  return { open, assigned, inProgress, onHold, overdue, completedThisMonth };
}

// ─── Get Maintenance for Unit ─────────────────────────────────────────────────

export async function getMaintenanceForUnit(unitId: string) {
  const session = await requirePermission("maintenance:read");

  const results = await db.maintenanceRequest.findMany({
    where: { unitId, organizationId: session.organizationId },
    include: {
      assignedTo: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return JSON.parse(JSON.stringify(results));
}

// ─── Get Units for Maintenance Selectors ──────────────────────────────────────

export async function getUnitsForMaintenance() {
  const session = await requirePermission("maintenance:read");

  const units = await db.unit.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { number: "asc" },
  });
  return JSON.parse(JSON.stringify(units));
}
