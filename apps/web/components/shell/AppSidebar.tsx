"use client";

import * as React from "react";
import {
  LayoutGrid, FolderKanban, Building2, Users, TrendingUp, KeyRound,
  MapPin, Compass, Receipt, Wrench, FileText, CreditCard, ShieldCheck,
  Settings, PanelLeftClose, PanelLeftOpen, HelpCircle, X, FolderOpen,
  SearchCheck, TicketCheck, ClipboardList, Wallet, Gauge,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "../LanguageProvider";
import { hasPermission, isSystemRole } from "../../lib/permissions";
import { MimaricLogo } from "../brand/MimaricLogo";
import { navItems, sectionLabels, type NavItem } from "./nav-items";

const iconMap: Record<string, React.ElementType> = {
  LayoutGrid, FolderKanban, Building2, Users, TrendingUp, KeyRound,
  MapPin, Compass, Receipt, Wrench, FileText, CreditCard, ShieldCheck,
  Settings, FolderOpen, SearchCheck, TicketCheck,
  ClipboardList, Wallet, Gauge,
};

interface AppSidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
  userRole: string;
}

export function AppSidebar({ isCollapsed, setIsCollapsed, mobileOpen, setMobileOpen, userRole }: AppSidebarProps) {
  const pathname = usePathname();
  const { lang } = useLanguage();

  const isPlatformUser = isSystemRole(userRole);

  const filteredItems = navItems.filter((item) => {
    if (item.hiddenFromNav) return false;
    if (item.permission && !hasPermission(userRole, item.permission)) return false;
    if (item.audience === "tenant" && isPlatformUser) return false;
    if (item.audience === "platform" && !isPlatformUser) return false;
    return true;
  });

  const sections = ["core", "operations", "system"] as const;

  const renderNavItem = (item: NavItem) => {
    const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
    const Icon = iconMap[item.icon] || LayoutGrid;
    const showLabel = !isCollapsed || mobileOpen;

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all group relative min-h-[40px]",
          isActive
            ? "text-white bg-primary/15 border-s-2 border-primary ps-[10px] shadow-sm"
            : "text-white/50 hover:text-white/80 hover:bg-white/5"
        )}
        aria-current={isActive ? "page" : undefined}
      >
        <Icon className={cn("h-[18px] w-[18px] min-w-[18px] shrink-0", isActive && "text-white")} strokeWidth={isActive ? 2.2 : 1.8} />
        {showLabel && <span className="truncate">{item.label[lang]}</span>}

        {isCollapsed && !mobileOpen && (
          <div className="absolute end-full me-2 hidden group-hover:block z-[60]">
            <div className="bg-popover text-popover-foreground text-xs py-1.5 px-3 rounded-md shadow-lg whitespace-nowrap border border-border">
              {item.label[lang]}
            </div>
          </div>
        )}
      </Link>
    );
  };

  const showLabel = !isCollapsed || mobileOpen;

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-overlay/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 z-50 flex-col bg-gradient-to-b from-sidebar-bg to-sidebar-deep text-white transition-all duration-300 ease-in-out",
          mobileOpen ? "flex" : "hidden md:flex",
          "md:sticky md:top-0 md:h-screen",
          isCollapsed ? "md:w-[64px]" : "md:w-[240px]",
          mobileOpen
            ? "end-0 w-[min(320px,88vw)] translate-x-0 md:end-auto md:w-auto"
            : "end-0 w-[min(320px,88vw)] md:translate-x-0 md:end-auto md:w-auto"
        )}
        aria-label={lang === "ar" ? "الشريط الجانبي" : "Sidebar"}
      >
        {/* Mobile close */}
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-3 start-3 md:hidden p-2 text-white/60 hover:text-white min-h-[40px] min-w-[40px] flex items-center justify-center"
          aria-label={lang === "ar" ? "إغلاق القائمة" : "Close menu"}
        >
          <X className="h-[18px] w-[18px]" />
        </button>

        {/* Logo */}
        <div className="flex h-14 items-center px-4 border-b border-white/6">
          {isCollapsed && !mobileOpen ? (
            <div className="min-w-[32px] flex justify-center">
              <MimaricLogo width={28} variant="dark" />
            </div>
          ) : (
            <MimaricLogo width={120} variant="dark" className="transition-opacity duration-200" />
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto pt-3 px-2 space-y-5" aria-label={lang === "ar" ? "التنقل الرئيسي" : "Main navigation"}>
          {sections.map((section) => {
            const items = filteredItems.filter((i) => i.section === section);
            if (items.length === 0) return null;
            return (
              <div key={section}>
                {showLabel && (
                  <div className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                    {sectionLabels[section]?.[lang] ?? section}
                  </div>
                )}
                <div className="space-y-0.5">
                  {items.map(renderNavItem)}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/6 p-2 space-y-0.5">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-white/50 hover:bg-white/5 hover:text-white/80 transition-all min-h-[40px]"
            aria-label={lang === "ar" ? "طي القائمة" : "Toggle sidebar"}
          >
            {isCollapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
            {showLabel && <span>{lang === "ar" ? "طي القائمة" : "Collapse"}</span>}
          </button>
          {!isPlatformUser && (
            <Link
              href="/dashboard/help"
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-white/50 hover:bg-white/5 hover:text-white/80 transition-all min-h-[40px]"
            >
              <HelpCircle className="h-[18px] w-[18px]" />
              {showLabel && <span>{lang === "ar" ? "المساعدة" : "Help"}</span>}
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
