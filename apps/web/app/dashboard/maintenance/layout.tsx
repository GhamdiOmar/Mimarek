"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gauge, Wrench, CalendarCheck } from "lucide-react";
import { useLanguage } from "../../../components/LanguageProvider";
import { cn } from "@repo/ui/lib/utils";

interface SubNavItem {
  href: string;
  label: { ar: string; en: string };
  icon: React.ComponentType<{ className?: string }>;
  matchPrefix: string;
}

const SUB_NAV: SubNavItem[] = [
  {
    href: "/dashboard/maintenance",
    matchPrefix: "/dashboard/maintenance",
    label: { ar: "نظرة عامة", en: "Overview" },
    icon: Gauge,
  },
  {
    href: "/dashboard/maintenance/tickets",
    matchPrefix: "/dashboard/maintenance/tickets",
    label: { ar: "التذاكر", en: "Tickets" },
    icon: Wrench,
  },
  {
    href: "/dashboard/maintenance/preventive",
    matchPrefix: "/dashboard/maintenance/preventive",
    label: { ar: "الصيانة الوقائية", en: "Preventive" },
    icon: CalendarCheck,
  },
];

function isActive(pathname: string, item: SubNavItem): boolean {
  if (item.matchPrefix === "/dashboard/maintenance") {
    // Overview is the default — active for the root AND any /maintenance/[id] detail.
    return (
      !pathname.startsWith("/dashboard/maintenance/tickets") &&
      !pathname.startsWith("/dashboard/maintenance/preventive") &&
      pathname.startsWith("/dashboard/maintenance")
    );
  }
  return pathname.startsWith(item.matchPrefix);
}

export default function MaintenanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { lang } = useLanguage();
  const pathname = usePathname() ?? "";

  return (
    <div>
      <nav
        aria-label={lang === "ar" ? "تبويبات الصيانة" : "Maintenance sections"}
        className="sticky top-0 z-[20] -mx-4 mb-4 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:-mx-6 md:px-6"
      >
        <div className="flex items-center gap-1 overflow-x-auto">
          {SUB_NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label[lang]}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      {children}
    </div>
  );
}
