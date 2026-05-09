"use server";

import { db, type UserRole } from "@repo/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "../../lib/auth-helpers";
import { logAuditEvent } from "../../lib/audit";
import { isSystemRole } from "../../lib/permissions";

export async function getTeamMembers() {
  const session = await requirePermission("team:read");

  return db.user.findMany({
    where: { organizationId: session.organizationId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function updateTeamMember(userId: string, data: { role?: UserRole; name?: string }) {
  const session = await requirePermission("team:write");

  // Guard: non-system users cannot assign system roles
  if (data.role && isSystemRole(data.role) && !isSystemRole(session.role)) {
    throw new Error("You don't have permission to assign system-level roles. Please contact a system administrator.");
  }

  // Verify user belongs to same org
  const user = await db.user.findFirst({
    where: { id: userId, organizationId: session.organizationId },
  });
  if (!user) throw new Error("Team member not found. Please verify they belong to your organization.");

  const updated = await db.user.update({
    where: { id: userId },
    data,
    select: { id: true, name: true, email: true, role: true },
  });

  logAuditEvent({ userId: session.userId, userEmail: session.email, userRole: session.role, action: "UPDATE", resource: "User", resourceId: userId, metadata: { fields: Object.keys(data) }, organizationId: session.organizationId });

  revalidatePath("/dashboard/settings/team");
  return updated;
}

export async function removeTeamMember(userId: string) {
  const session = await requirePermission("team:delete");

  // Can't remove yourself
  if (userId === session.userId) {
    throw new Error("You cannot remove your own account. Please ask another administrator to do this.");
  }

  const user = await db.user.findFirst({
    where: { id: userId, organizationId: session.organizationId },
  });
  if (!user) throw new Error("Team member not found. Please verify they belong to your organization.");

  await db.user.delete({ where: { id: userId } });

  logAuditEvent({ userId: session.userId, userEmail: session.email, userRole: session.role, action: "DELETE", resource: "User", resourceId: userId, organizationId: session.organizationId });

  revalidatePath("/dashboard/settings/team");
}
