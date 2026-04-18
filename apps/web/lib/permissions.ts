// ─── Permission Types (v3.0) ──────────────────────────────────────────────────

export type Permission =
  // Dashboard
  | "dashboard:read"

  // CRM (Customers / Leads)
  | "crm:read"
  | "crm:write"
  | "crm:delete"
  | "crm:export"

  // Customers (keep for backward compat with existing action guards)
  | "customers:read"
  | "customers:read_pii"
  | "customers:write"
  | "customers:delete"
  | "customers:export"

  // Properties (Units)
  | "properties:read"
  | "properties:write"
  | "properties:delete"

  // Deals (Reservations)
  | "deals:read"
  | "deals:write"
  | "deals:delete"

  // Contracts
  | "contracts:read"
  | "contracts:write"
  | "contracts:delete"

  // Leases
  | "leases:read"
  | "leases:write"
  | "leases:delete"

  // Payments
  | "payments:read"
  | "payments:write"

  // Maintenance
  | "maintenance:read"
  | "maintenance:write"
  | "maintenance:delete"

  // Preventive Maintenance
  | "preventive_maintenance:read"
  | "preventive_maintenance:write"

  // Documents
  | "documents:read"
  | "documents:write"
  | "documents:delete"

  // Organization & Team
  | "organization:read"
  | "organization:write"
  | "team:read"
  | "team:write"
  | "team:delete"

  // Reports
  | "reports:read"
  | "reports:export"

  // Audit
  | "audit:read"

  // Notifications
  | "notifications:read"

  // Billing
  | "billing:read"
  | "billing:write"
  | "billing:admin"

  // Help
  | "help:read"
  | "help:create_ticket"
  | "help:manage_tickets"
  | "help:manage_permissions"

  // ── Legacy v2 permission aliases (kept for backward compat with existing action guards) ──
  | "units:read"
  | "units:write"
  | "units:delete"
  | "reservations:read"
  | "reservations:write"
  | "preventive_maintenance:delete"
  | "finance:read"
  | "finance:write"
  | "pricing:read"
  | "launch:read";

// ─── All permissions list (used by SYSTEM_ADMIN) ──────────────────────────────

const ALL_PERMISSIONS: Permission[] = [
  "dashboard:read",
  "crm:read", "crm:write", "crm:delete", "crm:export",
  "customers:read", "customers:read_pii", "customers:write", "customers:delete", "customers:export",
  "properties:read", "properties:write", "properties:delete",
  "deals:read", "deals:write", "deals:delete",
  "contracts:read", "contracts:write", "contracts:delete",
  "leases:read", "leases:write", "leases:delete",
  "payments:read", "payments:write",
  "maintenance:read", "maintenance:write", "maintenance:delete",
  "preventive_maintenance:read", "preventive_maintenance:write",
  "documents:read", "documents:write", "documents:delete",
  "organization:read", "organization:write",
  "team:read", "team:write", "team:delete",
  "reports:read", "reports:export",
  "audit:read",
  "notifications:read",
  "billing:read", "billing:write", "billing:admin",
  "help:read", "help:create_ticket", "help:manage_tickets", "help:manage_permissions",
  // Legacy v2 aliases
  "units:read", "units:write", "units:delete",
  "reservations:read", "reservations:write",
  "preventive_maintenance:delete",
  "finance:read", "finance:write",
  "pricing:read", "launch:read",
];

// ─── System Permissions (Mimaric platform staff only) ────────────────────────

export const SYSTEM_ONLY_PERMISSIONS: Permission[] = [
  "billing:admin",
  "help:manage_tickets",
];

/**
 * Tenant-scoped permissions — actions gated by these MUST reject platform users
 * (SYSTEM_ADMIN / SYSTEM_SUPPORT) even though their role grants the permission.
 *
 * This is Layer 3 of the audience-separation rule (CLAUDE.md § 8.3). Permission
 * alone NEVER gates audience, because system roles are deliberately seeded with
 * ALL_PERMISSIONS for support-tool access. Anything touching tenant customer
 * data must check audience here.
 *
 * Not listed (shared across audiences): dashboard:read, notifications:read,
 * help:read, help:create_ticket — platform staff legitimately use these for
 * their own account surfaces.
 */
export const TENANT_SCOPED_PERMISSIONS: Permission[] = [
  "crm:read", "crm:write", "crm:delete", "crm:export",
  "customers:read", "customers:read_pii", "customers:write", "customers:delete", "customers:export",
  "properties:read", "properties:write", "properties:delete",
  "deals:read", "deals:write", "deals:delete",
  "contracts:read", "contracts:write", "contracts:delete",
  "leases:read", "leases:write", "leases:delete",
  "payments:read", "payments:write",
  "maintenance:read", "maintenance:write", "maintenance:delete",
  "preventive_maintenance:read", "preventive_maintenance:write", "preventive_maintenance:delete",
  "documents:read", "documents:write", "documents:delete",
  "organization:read", "organization:write",
  "team:read", "team:write", "team:delete",
  "reports:read", "reports:export",
  "audit:read",
  "billing:read", "billing:write",
  "help:manage_permissions",
  // Legacy v2 aliases
  "units:read", "units:write", "units:delete",
  "reservations:read", "reservations:write",
  "finance:read", "finance:write",
  "pricing:read", "launch:read",
];

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  // ── System tier (Mimaric platform team) ──────────────────────────────────
  SYSTEM_ADMIN: ALL_PERMISSIONS,

  SYSTEM_SUPPORT: [
    "dashboard:read",
    "crm:read", "crm:write", "crm:delete", "crm:export",
    "customers:read", "customers:read_pii", "customers:write", "customers:delete", "customers:export",
    "properties:read", "properties:write", "properties:delete",
    "deals:read", "deals:write", "deals:delete",
    "contracts:read", "contracts:write", "contracts:delete",
    "leases:read", "leases:write", "leases:delete",
    "payments:read", "payments:write",
    "maintenance:read", "maintenance:write", "maintenance:delete",
    "preventive_maintenance:read", "preventive_maintenance:write",
    "documents:read", "documents:write", "documents:delete",
    "organization:read", "organization:write",
    "team:read", "team:write", "team:delete",
    "reports:read", "reports:export",
    "audit:read",
    "notifications:read",
    "billing:read",
    "help:read", "help:create_ticket", "help:manage_tickets",
  ],

  // ── Customer tier ────────────────────────────────────────────────────────
  ADMIN: ALL_PERMISSIONS.filter((p) => !SYSTEM_ONLY_PERMISSIONS.includes(p)),

  MANAGER: [
    "dashboard:read",
    "crm:read", "crm:write", "crm:export",
    "customers:read", "customers:write", "customers:export", "customers:read_pii",
    "properties:read", "properties:write",
    "deals:read", "deals:write",
    "contracts:read", "contracts:write",
    "leases:read", "leases:write",
    "payments:read", "payments:write",
    "maintenance:read", "maintenance:write",
    "preventive_maintenance:read", "preventive_maintenance:write",
    "documents:read", "documents:write",
    "organization:read",
    "team:read",
    "reports:read", "reports:export",
    "notifications:read",
    "billing:read",
    "help:read", "help:create_ticket",
  ],

  AGENT: [
    "dashboard:read",
    "crm:read", "crm:write",
    "customers:read", "customers:write",
    "properties:read",
    "deals:read", "deals:write",
    "contracts:read", "contracts:write",
    "leases:read",
    "payments:read", "payments:write",
    "maintenance:read",
    "documents:read", "documents:write",
    "notifications:read",
    "help:read", "help:create_ticket",
  ],

  TECHNICIAN: [
    "dashboard:read",
    "properties:read",
    "maintenance:read", "maintenance:write",
    "preventive_maintenance:read",
    "documents:read",
    "notifications:read",
    "help:read", "help:create_ticket",
  ],

  USER: [
    "dashboard:read",
    "notifications:read",
    "help:read", "help:create_ticket",
  ],
};

// ─── Role classification helpers ───────────────────────────────────────────

/** Roles that belong to the Mimaric platform team — never assignable by customers */
export const SYSTEM_ROLES: string[] = ["SYSTEM_ADMIN", "SYSTEM_SUPPORT"];

/** Roles that customers can assign to their team members */
export const CUSTOMER_ASSIGNABLE_ROLES: string[] = [
  "ADMIN", "MANAGER", "AGENT", "TECHNICIAN", "USER",
];

/** Check if a role is a system (Mimaric platform) role */
export function isSystemRole(role: string): boolean {
  return SYSTEM_ROLES.includes(role);
}

// ─── Permission check functions ────────────────────────────────────────────

export function hasPermission(role: string, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.includes(permission);
}

export function getPermissions(role: string): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
