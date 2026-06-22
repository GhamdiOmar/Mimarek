// ─── Route Guards — single source of truth for route → permission/audience ───
//
// F4 (architecture-required-fixes-2026-06-12 §F4 / v4.18.0). Before this file,
// the fact "route X requires permission P and audience A" lived in THREE
// unconnected places that could drift:
//   1. components/shell/nav-items.ts  — drives sidebar/More/Cmd-K RENDERING.
//   2. auth.config.ts `authorized`    — the edge audience gate (no middleware.ts).
//   3. each page's inline guard        — getTenantPageAccess / requireSystem /
//                                         requirePermission in lib/auth-helpers.ts.
//
// This map is the union of all three. nav-items.ts, auth.config.ts and
// getTenantPageAccess() now read from here.
//
// ⚠️ EDGE-SAFETY CONTRACT (same discipline as lib/permissions.ts):
//   PURE DATA. No `server-only`, no `next/headers`, no `@repo/db`, no Node APIs.
//   This module is imported by auth.config.ts which runs at the EDGE. The ONLY
//   import permitted is the `Permission` *type* from ./permissions (type-only,
//   erased at compile time). Keep it that way.
//
// `audience` values:
//   "tenant"   — customer-org users only. System (platform) users are redirected
//                to /dashboard/admin when they hit one of these.
//   "platform" — Mimarek platform staff only (SYSTEM_ADMIN / SYSTEM_SUPPORT).
//   "shared"   — visible to both audiences (e.g. /dashboard/more/profile, notifications).
//                System users are NOT redirected away from these.

import type { Permission } from "./permissions";

export interface RouteGuard {
  permission: Permission;
  audience: "tenant" | "platform" | "shared";
}

/**
 * Route → { permission, audience }. Keyed by route path.
 *
 * The `permission` is the route's ENFORCEMENT permission — the one the page-level
 * guard (or data layer) actually checks. Where the old nav-items.ts permission
 * disagreed with the page guard, the page guard wins (it is the real gate); each
 * such disagreement is documented in the F4 PR notes. nav-items.ts derives its
 * rendering permission/audience from this map via `routeGuardFor()`.
 */
export const ROUTE_GUARDS: Record<string, RouteGuard> = {
  // ── Core (tenant) ──────────────────────────────────────────────────────────
  "/dashboard": { permission: "dashboard:read", audience: "tenant" },
  "/dashboard/leasing": { permission: "dashboard:read", audience: "tenant" },
  "/dashboard/finance": { permission: "dashboard:read", audience: "tenant" },
  "/dashboard/crm": { permission: "crm:read", audience: "tenant" },
  // NOTE (disagreement, resolved to page guard): nav-items previously advertised
  // /dashboard/units with `properties:read`, but the page guard and the units
  // data layer both enforce `units:read`. Page guard wins.
  "/dashboard/units": { permission: "units:read", audience: "tenant" },
  "/dashboard/reservations": { permission: "deals:read", audience: "tenant" },
  "/dashboard/contracts": { permission: "contracts:read", audience: "tenant" },
  "/dashboard/marketplace": { permission: "marketplace:read", audience: "tenant" },
  "/dashboard/marketplace/my-listings": { permission: "marketplace:manage_own", audience: "tenant" },

  // ── Operations (tenant) ────────────────────────────────────────────────────
  "/dashboard/payments": { permission: "payments:read", audience: "tenant" },
  "/dashboard/maintenance": { permission: "maintenance:read", audience: "tenant" },
  "/dashboard/maintenance/tickets": { permission: "maintenance:read", audience: "tenant" },
  "/dashboard/maintenance/preventive": { permission: "maintenance:read", audience: "tenant" },
  "/dashboard/reports": { permission: "reports:read", audience: "tenant" },
  "/dashboard/documents": { permission: "documents:read", audience: "tenant" },

  // ── System tier ────────────────────────────────────────────────────────────
  "/dashboard/billing": { permission: "billing:read", audience: "tenant" },
  // NOTE (disagreement, resolved): nav-items.ts:44 (Settings) had NO audience
  // (audit finding A8) — it rendered to BOTH audiences but the edge gate
  // redirected system users away. The enforcement intent is tenant-only, so it
  // resolves to `audience: "tenant"` here. Nav visibility for system users is
  // preserved by DashboardClientLayout/auth.config redirecting them off it
  // regardless; for tenant users the Settings item still shows (organization:read).
  "/dashboard/settings": { permission: "organization:read", audience: "tenant" },
  // Help — tenant audience (system staff use /dashboard/admin/tickets instead).
  // Already surfaced in the radial nav (radial-groups.ts "system" extras) + the
  // profile menu; this entry completes the F4 SSOT and makes the edge audience
  // gate explicit (it previously relied on the no-match → tenant default). CX-015.
  "/dashboard/help": { permission: "help:read", audience: "tenant" },

  // ── Platform (system staff only) ───────────────────────────────────────────
  "/dashboard/admin": { permission: "billing:admin", audience: "platform" },
  "/dashboard/admin/seo": { permission: "billing:admin", audience: "platform" },
  "/dashboard/admin/email": { permission: "billing:admin", audience: "platform" },
  "/dashboard/admin/tickets": { permission: "billing:admin", audience: "platform" },
  "/dashboard/admin/marketplace": { permission: "marketplace:moderate", audience: "platform" },
  "/dashboard/admin/data-retention": { permission: "billing:admin", audience: "platform" },
  "/dashboard/admin/zatca": { permission: "zatca:admin", audience: "platform" },
  // /dashboard/admin/coupons + /dashboard/admin/subscriptions are not in nav but
  // are platform surfaces (CLAUDE.md §8.2). The longest-prefix audience match on
  // "/dashboard/admin" covers them for the edge gate; listed here for clarity is
  // unnecessary because the prefix match handles every /dashboard/admin/** path.

  // ── Shared (both audiences — system users NOT redirected away) ─────────────
  // These are not rendered as nav items; they exist so auth.config.ts's
  // audience lookup keeps system users on them.
  // /dashboard/more was fully decommissioned (E2) — the profile surface moved into
  // /dashboard/settings#profile. No /dashboard/more route remains.
  "/dashboard/notifications": { permission: "notifications:read", audience: "shared" },
};

/**
 * Look up the guard for an EXACT route key. Returns undefined if absent.
 * Used by nav-items.ts (which keys by the item's own `href`).
 */
export function routeGuardFor(href: string): RouteGuard | undefined {
  return ROUTE_GUARDS[href];
}

/**
 * Resolve the FULL guard ({ permission, audience }) for an arbitrary pathname
 * using LONGEST-PREFIX match.
 *
 * Needed by the edge gate (auth.config.ts) and the F2 middleware (middleware.ts)
 * for nested/dynamic routes that are not exact keys — e.g.
 * `/dashboard/admin/coupons`, `/dashboard/crm/123`,
 * `/dashboard/notifications/settings`. The most specific matching key wins.
 *
 * Match rule: a key K matches pathname P if P === K or P starts with K + "/".
 * Returns the matched `RouteGuard`, or `undefined` if no key matches (the caller
 * decides the default — auth.config.ts treats "no match" under /dashboard as
 * tenant; middleware.ts defaults the permission to `dashboard:read`).
 *
 * EDGE-SAFE: pure data scan, no Node imports — see the file-header contract.
 */
export function routeGuardForPath(pathname: string): RouteGuard | undefined {
  let bestKey: string | undefined;
  for (const key of Object.keys(ROUTE_GUARDS)) {
    if (pathname === key || pathname.startsWith(key + "/")) {
      if (bestKey === undefined || key.length > bestKey.length) {
        bestKey = key;
      }
    }
  }
  return bestKey ? ROUTE_GUARDS[bestKey]! : undefined;
}

/**
 * Resolve the audience for an arbitrary pathname using LONGEST-PREFIX match.
 *
 * Thin wrapper over {@link routeGuardForPath} — kept as a named export because
 * auth.config.ts only needs the audience. Returns the matched guard's audience,
 * or `undefined` if no key matches.
 */
export function audienceForPath(pathname: string): RouteGuard["audience"] | undefined {
  return routeGuardForPath(pathname)?.audience;
}
