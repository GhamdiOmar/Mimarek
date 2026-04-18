"use server";

import { redirect } from "next/navigation";
import { auth } from "../auth";
import { db } from "@repo/db";
import {
  hasPermission,
  isSystemRole,
  SYSTEM_ONLY_PERMISSIONS,
  TENANT_SCOPED_PERMISSIONS,
  type Permission,
} from "./permissions";

export type AuthSession = {
  userId: string;
  email: string;
  name: string | null;
  role: string;
  organizationId: string;
};

/**
 * Get the authenticated session or throw an error.
 * Use this in all server actions to enforce auth + get org context.
 */
export async function getSessionOrThrow(): Promise<AuthSession> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  // If session already has organizationId (from JWT), use it directly
  if (session.user.organizationId && session.user.role) {
    return {
      userId: session.user.id,
      email: session.user.email!,
      name: session.user.name ?? null,
      role: session.user.role,
      organizationId: session.user.organizationId,
    };
  }

  // Fallback: fetch from DB (shouldn't happen if JWT callbacks are working)
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { organizationId: true, role: true, name: true },
  });

  if (!user?.organizationId) {
    throw new Error("User has no organization");
  }

  return {
    userId: session.user.id,
    email: session.user.email!,
    name: user.name ?? session.user.name ?? null,
    role: user.role,
    organizationId: user.organizationId,
  };
}

/**
 * Get session and require a specific permission, or throw Forbidden.
 *
 * Also enforces audience separation (CLAUDE.md § 8.3 — Layer 3):
 * - Tenant-scoped permissions reject system roles (SYSTEM_ADMIN / SYSTEM_SUPPORT),
 *   even though those roles are seeded with the permission for support tooling.
 * - System-only permissions reject tenant roles. Tenant roles already lack the
 *   permission, so this is defense-in-depth against permission-matrix drift.
 */
export async function requirePermission(permission: Permission): Promise<AuthSession> {
  const session = await getSessionOrThrow();
  if (!hasPermission(session.role, permission)) {
    throw new Error(`Forbidden: missing permission '${permission}'`);
  }

  const isSystem = isSystemRole(session.role);
  if (TENANT_SCOPED_PERMISSIONS.includes(permission) && isSystem) {
    throw new Error(
      `Forbidden: '${permission}' is tenant-scoped — platform users may not invoke this action`,
    );
  }
  if (SYSTEM_ONLY_PERMISSIONS.includes(permission) && !isSystem) {
    throw new Error(
      `Forbidden: '${permission}' is platform-only — tenant users may not invoke this action`,
    );
  }

  return session;
}

/**
 * Get session with a convenience `can()` method for checking permissions inline.
 */
export async function getSessionWithPermissions(): Promise<AuthSession & { can: (p: Permission) => boolean }> {
  const session = await getSessionOrThrow();
  return {
    ...session,
    can: (p: Permission) => hasPermission(session.role, p),
  };
}

// ─── Route Guards (CLAUDE.md § 8.3 — Layer 2) ─────────────────────────────
// Audience-based gates for server layouts / pages. These complement Layer 2
// middleware in `auth.config.ts` (defense-in-depth) and Layer 3 server-action
// guards in `requirePermission` above. Unlike `requirePermission`, these do NOT
// throw — they redirect, because they guard whole routes rather than actions.

/**
 * Gate a route segment to platform (system) staff only.
 * - Redirects to `/auth/login` if unauthenticated.
 * - Redirects to `/dashboard` if the user is a tenant user.
 * - Returns the session for the caller to use.
 *
 * Per CLAUDE.md § 8: system users have `organizationId: null` and role in
 * SYSTEM_* set (SYSTEM_ADMIN / SYSTEM_SUPPORT).
 */
export async function requireSystem() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  if (!isSystemRole(session.user.role ?? "")) redirect("/dashboard");
  return session;
}

/**
 * Gate a route segment to tenant (customer) users only.
 * - Redirects to `/auth/login` if unauthenticated.
 * - Redirects to `/dashboard/admin` if the user is a system user.
 * - Redirects to `/auth/login` if the tenant user has no `organizationId`.
 * - Returns the session for the caller to use.
 */
export async function requireTenant() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  if (isSystemRole(session.user.role ?? "")) redirect("/dashboard/admin");
  if (!session.user.organizationId) redirect("/auth/login");
  return session;
}
