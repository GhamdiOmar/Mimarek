"use client";

import * as React from "react";
import { BottomNav, type BottomNavItem } from "@repo/ui";
import { LayoutGrid, Users, Building2, Wrench, MoreHorizontal } from "lucide-react";
import { useLanguage } from "../LanguageProvider";
import { hasPermission, isSystemRole, type Permission } from "../../lib/permissions";

interface MobileBottomTabsProps {
  userRole: string;
}

export function MobileBottomTabs({ userRole }: MobileBottomTabsProps) {
  const { lang } = useLanguage();
  const isPlatformUser = isSystemRole(userRole);

  const allTabs: (BottomNavItem & { permission?: Permission; tenantOnly?: boolean })[] = [
    {
      key: "home",
      href: isPlatformUser ? "/dashboard/admin" : "/dashboard",
      label: { ar: "الرئيسية", en: "Home" },
      icon: LayoutGrid,
    },
    {
      key: "crm",
      href: "/dashboard/crm",
      label: { ar: "العملاء", en: "CRM" },
      icon: Users,
      permission: "crm:read",
      tenantOnly: true,
    },
    {
      key: "units",
      href: "/dashboard/units",
      label: { ar: "الوحدات", en: "Units" },
      icon: Building2,
      permission: "properties:read",
      tenantOnly: true,
    },
    {
      key: "tasks",
      href: "/dashboard/maintenance",
      label: { ar: "المهام", en: "Tasks" },
      icon: Wrench,
      permission: "maintenance:read",
      tenantOnly: true,
    },
    {
      key: "more",
      href: "/dashboard/more",
      label: { ar: "المزيد", en: "More" },
      icon: MoreHorizontal,
    },
  ];

  const items = allTabs
    .filter((tab) => {
      if (tab.tenantOnly && isPlatformUser) return false;
      if (tab.permission && !hasPermission(userRole, tab.permission)) return false;
      return true;
    })
    .map(({ permission: _p, tenantOnly: _t, ...rest }) => rest);

  if (items.length < 2) return null;

  return <BottomNav items={items} lang={lang} />;
}
