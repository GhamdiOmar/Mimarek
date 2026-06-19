"use server";

import { db, UserRole, RequestStatus } from "@repo/db";
import { revalidatePath } from "next/cache";
import { ROUTES } from "../../lib/routes";
import { requirePermission, getSessionOrThrow } from "../../lib/auth-helpers";
import { logAuditEvent } from "../../lib/audit";
import { createNotification, notifyAdmins } from "../../lib/create-notification";
import { isSystemRole } from "../../lib/permissions";

/** Roles that non-system users are allowed to request via self-service. */
const REQUESTABLE_ROLES = [
  "USER", "TECHNICIAN", "AGENT", "MANAGER", "ADMIN",
];

export async function createPermissionRequest(data: {
  requestedRole: string;
  reason: string;
}) {
  const session = await requirePermission("help:create_ticket");

  // Guard: reject system-level roles and unknown roles
  if (isSystemRole(data.requestedRole)) {
    return { error: "Cannot request system-level roles" };
  }
  if (!REQUESTABLE_ROLES.includes(data.requestedRole)) {
    return { error: "Invalid role requested" };
  }

  const request = await db.permissionRequest.create({
    data: {
      userId: session.userId,
      // `requestedRole` stays a `string` param (validated against REQUESTABLE_ROLES
      // above); cast to the enum only at the write site — value unchanged.
      requestedRole: data.requestedRole as UserRole,
      reason: data.reason,
      status: "PENDING",
      organizationId: session.organizationId,
    },
  });

  // Notify admins
  await notifyAdmins({
    type: "PERMISSION_REQUEST",
    title: "طلب صلاحيات جديد",
    titleEn: "New Permission Request",
    message: `${session.name ?? session.email} طلب ترقية إلى ${data.requestedRole}`,
    messageEn: `${session.name ?? session.email} requested upgrade to ${data.requestedRole}`,
    link: "/dashboard/help",
    organizationId: session.organizationId,
  });

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "CREATE",
    resource: "PermissionRequest",
    resourceId: request.id,
    metadata: { requestedRole: data.requestedRole },
    organizationId: session.organizationId,
  });

  revalidatePath(ROUTES.help);
  return request;
}

export async function getMyPermissionRequests() {
  const session = await requirePermission("help:read");

  return db.permissionRequest.findMany({
    where: { userId: session.userId },
    include: {
      reviewer: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPendingPermissionRequests() {
  const session = await requirePermission("help:manage_permissions");

  return db.permissionRequest.findMany({
    where: {
      organizationId: session.organizationId,
      status: "PENDING",
    },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function getAllPermissionRequests(status?: string) {
  const session = await requirePermission("help:manage_permissions");

  return db.permissionRequest.findMany({
    where: {
      organizationId: session.organizationId,
      // `status` stays a `string` param; cast to the enum only here (value unchanged).
      ...(status ? { status: status as RequestStatus } : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      reviewer: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function reviewPermissionRequest(
  requestId: string,
  decision: "APPROVED" | "DECLINED",
  note?: string
) {
  const session = await requirePermission("help:manage_permissions");

  const request = await db.permissionRequest.findFirst({
    where: { id: requestId, organizationId: session.organizationId, status: "PENDING" },
  });
  if (!request) throw new Error("This request was not found or has already been reviewed. Please refresh the page.");

  // Update the request
  const updated = await db.permissionRequest.update({
    where: { id: requestId },
    data: {
      status: decision,
      reviewedBy: session.userId,
      reviewNote: note ?? null,
    },
  });

  // If approved and role requested, update user's role
  if (decision === "APPROVED" && request.requestedRole) {
    // Guard: non-system users cannot approve upgrades to system roles
    if (isSystemRole(request.requestedRole) && !isSystemRole(session.role)) {
      throw new Error("System-level role upgrades cannot be approved through this process. Please contact a system administrator.");
    }
    await db.user.update({
      where: { id: request.userId },
      data: { role: request.requestedRole },
    });
  }

  // Notify the requesting user
  const statusAr = decision === "APPROVED" ? "تمت الموافقة" : "تم الرفض";
  const statusEn = decision === "APPROVED" ? "Approved" : "Declined";
  await createNotification({
    userId: request.userId,
    type: "PERMISSION_RESPONSE",
    title: `طلب الصلاحيات: ${statusAr}`,
    titleEn: `Permission Request: ${statusEn}`,
    message: note ?? (decision === "APPROVED" ? "تمت الموافقة على طلبك" : "تم رفض طلبك"),
    messageEn: note ?? (decision === "APPROVED" ? "Your request has been approved" : "Your request has been declined"),
    link: "/dashboard/help",
    organizationId: session.organizationId,
  });

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "UPDATE",
    resource: "PermissionRequest",
    resourceId: requestId,
    metadata: { decision, requestedRole: request.requestedRole, note },
    organizationId: session.organizationId,
  });

  revalidatePath(ROUTES.help);
  return updated;
}
