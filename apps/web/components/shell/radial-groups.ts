/**
 * radial-groups.ts — taxonomy for the CircleMenu (v4.11 Phase 2).
 *
 * The radial menu is a two-level hub-and-spoke: 6 category hubs, each expanding
 * to ≤8 children. To keep ONE source of truth, groups reference `navItems` by
 * `href` — labels, icons, permissions and `audience` live in nav-items.ts. The
 * resolver re-applies the exact sidebar visibility filter (CLAUDE.md §8.3), so
 * platform vs tenant separation is preserved automatically: a group whose
 * children all filter out simply disappears.
 *
 * `extras` are destinations that legitimately are not nav items (e.g. Help,
 * which the old sidebar rendered as a footer link) — kept minimal and explicit.
 */

import { navItems, type NavItem } from "./nav-items";
import { hasPermission, isSystemRole, type Permission } from "../../lib/permissions";

export interface RadialChild {
  label: { ar: string; en: string };
  icon: string; // Lucide icon name
  href: string;
}

interface RadialExtra extends RadialChild {
  permission?: Permission;
  audience?: "tenant" | "platform";
}

export interface RadialGroupDef {
  id: string;
  label: { ar: string; en: string };
  icon: string; // Lucide icon name for the hub
  /** ordered hrefs, resolved against navItems (single source of truth) */
  items: string[];
  /** destinations not present in navItems (kept explicit and minimal) */
  extras?: RadialExtra[];
}

export interface ResolvedRadialGroup {
  id: string;
  label: { ar: string; en: string };
  icon: string;
  children: RadialChild[];
}

export const radialGroups: RadialGroupDef[] = [
  {
    id: "dashboard",
    label: { ar: "اللوحات", en: "Dashboard" },
    icon: "Gauge",
    items: ["/dashboard", "/dashboard/leasing", "/dashboard/reports"],
  },
  {
    id: "properties",
    label: { ar: "العقارات", en: "Properties" },
    icon: "Building2",
    items: ["/dashboard/units", "/dashboard/marketplace"],
  },
  {
    id: "crm",
    label: { ar: "العملاء والعقود", en: "CRM & Contracts" },
    icon: "Users",
    items: ["/dashboard/crm", "/dashboard/reservations", "/dashboard/contracts"],
  },
  {
    id: "finance",
    label: { ar: "المالية", en: "Finance" },
    icon: "Wallet",
    items: ["/dashboard/finance", "/dashboard/payments", "/dashboard/invoices", "/dashboard/billing"],
  },
  {
    id: "operations",
    label: { ar: "العمليات", en: "Operations" },
    icon: "Wrench",
    items: ["/dashboard/maintenance"],
  },
  {
    id: "system",
    label: { ar: "النظام", en: "System" },
    icon: "Settings",
    items: [
      "/dashboard/admin",
      "/dashboard/admin/seo",
      "/dashboard/admin/email",
      "/dashboard/admin/tickets",
      "/dashboard/admin/marketplace",
      "/dashboard/settings",
    ],
    extras: [
      {
        label: { ar: "المساعدة", en: "Help" },
        icon: "HelpCircle",
        href: "/dashboard/help",
        permission: "help:read",
        audience: "tenant",
      },
    ],
  },
];

function isVisible(
  userRole: string,
  isPlatform: boolean,
  item: { permission?: Permission; audience?: "tenant" | "platform"; hiddenFromNav?: boolean },
): boolean {
  if (item.hiddenFromNav) return false;
  if (item.permission && !hasPermission(userRole, item.permission)) return false;
  if (item.audience === "tenant" && isPlatform) return false;
  if (item.audience === "platform" && !isPlatform) return false;
  return true;
}

/**
 * Resolve the taxonomy for a given role into hubs with visible children.
 * Empty groups are dropped — the same way the sidebar dropped empty sections.
 */
export function resolveRadialGroups(userRole: string): ResolvedRadialGroup[] {
  const isPlatform = isSystemRole(userRole);
  const byHref = new Map<string, NavItem>(navItems.map((i) => [i.href, i]));
  const groups: ResolvedRadialGroup[] = [];

  for (const g of radialGroups) {
    const children: RadialChild[] = [];

    for (const href of g.items) {
      const item = byHref.get(href);
      if (!item || !isVisible(userRole, isPlatform, item)) continue;
      children.push({ label: item.label, icon: item.icon, href: item.href });
    }
    for (const extra of g.extras ?? []) {
      if (!isVisible(userRole, isPlatform, extra)) continue;
      children.push({ label: extra.label, icon: extra.icon, href: extra.href });
    }

    if (children.length === 0) continue;
    groups.push({ id: g.id, label: g.label, icon: g.icon, children });
  }

  return groups;
}
