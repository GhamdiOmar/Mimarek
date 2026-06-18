"use server";

import { db } from "@repo/db";
import { revalidatePath } from "next/cache";
import { ROUTES } from "../../lib/routes";
import { requirePermission, getSessionOrThrow } from "../../lib/auth-helpers";
import { logAuditEvent } from "../../lib/audit";
import { createNotification } from "../../lib/create-notification";

export async function getPendingJoinRequests() {
  const session = await requirePermission("help:manage_permissions");

  return db.joinRequest.findMany({
    where: {
      targetOrgId: session.organizationId,
      status: "PENDING_JOIN",
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function reviewJoinRequest(
  requestId: string,
  decision: "APPROVED_JOIN" | "DECLINED_JOIN",
  note?: string
) {
  const session = await requirePermission("help:manage_permissions");

  const request = await db.joinRequest.findFirst({
    where: {
      id: requestId,
      targetOrgId: session.organizationId,
      status: "PENDING_JOIN",
    },
    include: {
      targetOrg: { select: { name: true, nameEnglish: true } },
    },
  });

  if (!request) {
    throw new Error("This request was not found or has already been reviewed. Please refresh the page.");
  }

  // Update the join request
  await db.joinRequest.update({
    where: { id: requestId },
    data: {
      status: decision,
      reviewedById: session.userId,
      reviewNote: note ?? null,
      reviewedAt: new Date(),
    },
  });

  const orgNameAr = request.targetOrg.name ?? "المنظمة";
  const orgNameEn = request.targetOrg.nameEnglish ?? "the organization";

  if (decision === "APPROVED_JOIN") {
    // Add user to the organization
    await db.user.update({
      where: { id: request.userId },
      data: {
        organizationId: request.targetOrgId,
        role: "USER",
        invitedVia: "join_request",
      },
    });

    // Notify user of approval
    await createNotification({
      userId: request.userId,
      type: "JOIN_REQUEST_RESPONSE",
      title: `تمت الموافقة على طلب الانضمام إلى ${orgNameAr}`,
      titleEn: `Your request to join ${orgNameEn} has been approved`,
      message: note ?? "تمت الموافقة على طلبك للانضمام. مرحباً بك!",
      messageEn: note ?? "Your join request has been approved. Welcome!",
      link: "/dashboard",
      organizationId: request.targetOrgId,
    });
  } else {
    // Notify user of decline
    await createNotification({
      userId: request.userId,
      type: "JOIN_REQUEST_RESPONSE",
      title: `تم رفض طلب الانضمام إلى ${orgNameAr}`,
      titleEn: `Your request to join ${orgNameEn} has been declined`,
      message: note ?? "تم رفض طلبك للانضمام.",
      messageEn: note ?? "Your join request has been declined.",
      link: "/dashboard/help",
      organizationId: request.targetOrgId,
    });
  }

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "UPDATE",
    resource: "JoinRequest",
    resourceId: requestId,
    metadata: { decision, note },
    organizationId: session.organizationId,
  });

  revalidatePath(ROUTES.help);
  return { success: true };
}

export async function cancelJoinRequest(requestId: string) {
  const session = await getSessionOrThrow();

  const request = await db.joinRequest.findFirst({
    where: {
      id: requestId,
      userId: session.userId,
      status: "PENDING_JOIN",
    },
  });

  if (!request) {
    throw new Error("This request was not found or has already been processed. Please refresh the page.");
  }

  await db.joinRequest.update({
    where: { id: requestId },
    data: { status: "CANCELLED_JOIN" },
  });

  revalidatePath(ROUTES.help);
  return { success: true };
}

export async function getJoinRequestStats() {
  const session = await requirePermission("help:manage_permissions");

  const pendingCount = await db.joinRequest.count({
    where: {
      targetOrgId: session.organizationId,
      status: "PENDING_JOIN",
    },
  });

  return { pendingCount };
}
