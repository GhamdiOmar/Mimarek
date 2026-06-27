"use server";

import { db, UserRole } from "@repo/db";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { ROUTES } from "../../lib/routes";
import { requirePermission } from "../../lib/auth-helpers";
import { logAuditEvent } from "../../lib/audit";
import { isSystemRole } from "../../lib/permissions";

// SEC-001: the Server Action payload is runtime-validated against a strict
// allowlist. The compile-time `{ role?, name? }` type does NOT strip extra keys
// at runtime, so a direct invocation could previously pass organizationId /
// password / emailVerified straight into db.user.update (cross-tenant mass-
// assignment). zod drops everything not named here.
const UpdateTeamMemberSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  role: z.nativeEnum(UserRole).optional(),
});

export async function getTeamMembers() {
  const session = await requirePermission("team:read");

  return db.user.findMany({
    where: { organizationId: session.organizationId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function updateTeamMember(userId: string, data: { role?: UserRole; name?: string }) {
  const session = await requirePermission("team:write");

  const parsed = UpdateTeamMemberSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Invalid input: " + parsed.error.issues.map((i) => i.message).join(", "));
  }
  const updates = parsed.data;

  // Guard: non-system users cannot assign system roles.
  if (updates.role && isSystemRole(updates.role) && !isSystemRole(session.role)) {
    throw new Error("You don't have permission to assign system-level roles. Please contact a system administrator.");
  }

  // Guard: a caller cannot change their own role (avoids self-lockout / self-
  // escalation confusion — another administrator must do it).
  if (userId === session.userId && updates.role && updates.role !== session.role) {
    throw new Error("You cannot change your own role. Please ask another administrator to do this.");
  }

  const roleChanged = updates.role !== undefined;

  // Org-scoped, allowlisted update. The organizationId in the WHERE clause means a
  // caller can never move a user into another org (the old id-only update with a
  // raw `data` spread was the SEC-001 cross-tenant mass-assignment). A role change
  // bumps tokenVersion so the affected user re-authenticates immediately (SEC-003).
  const result = await db.user.updateMany({
    where: { id: userId, organizationId: session.organizationId },
    data: {
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.role !== undefined ? { role: updates.role } : {}),
      ...(roleChanged ? { tokenVersion: { increment: 1 } } : {}),
    },
  });
  if (result.count !== 1) {
    throw new Error("Team member not found. Please verify they belong to your organization.");
  }

  const updated = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true },
  });

  logAuditEvent({ userId: session.userId, userEmail: session.email, userRole: session.role, action: "UPDATE", resource: "User", resourceId: userId, metadata: { fields: Object.keys(updates) }, organizationId: session.organizationId });

  revalidatePath(ROUTES.settingsTeam);
  return updated;
}

// QA-M2: dedicated, explicit deactivate/activate path. Kept SEPARATE from
// updateTeamMember so `isActive` can never be smuggled through the generic
// update allowlist (mass-assignment) — the only writable column here is the
// validated boolean, and deactivation bumps tokenVersion so the affected user's
// existing JWT is revoked on their next action (SEC-003, same as a role change).
const SetActiveSchema = z.object({ isActive: z.boolean() });

export async function setTeamMemberActive(userId: string, isActive: boolean) {
  const session = await requirePermission("team:write");

  const parsed = SetActiveSchema.safeParse({ isActive });
  if (!parsed.success) {
    throw new Error("Invalid input: " + parsed.error.issues.map((i) => i.message).join(", "));
  }
  const nextActive = parsed.data.isActive;

  // Guard: a caller cannot deactivate their own account (avoids self-lockout —
  // another administrator must do it).
  if (userId === session.userId && !nextActive) {
    throw new Error("You cannot deactivate your own account. Please ask another administrator to do this.");
  }

  // Org-scoped, single-column update. The organizationId in the WHERE clause means
  // a caller can never reach a user in another org. Deactivating bumps tokenVersion
  // so the target's outstanding session is revoked immediately (SEC-003).
  const result = await db.user.updateMany({
    where: { id: userId, organizationId: session.organizationId },
    data: {
      isActive: nextActive,
      ...(nextActive ? {} : { tokenVersion: { increment: 1 } }),
    },
  });
  if (result.count !== 1) {
    throw new Error("Team member not found. Please verify they belong to your organization.");
  }

  logAuditEvent({ userId: session.userId, userEmail: session.email, userRole: session.role, action: "UPDATE", resource: "User", resourceId: userId, metadata: { isActive: nextActive }, organizationId: session.organizationId });

  revalidatePath(ROUTES.settingsTeam);
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

  revalidatePath(ROUTES.settingsTeam);
}
