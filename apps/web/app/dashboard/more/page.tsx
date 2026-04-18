"use client";

import * as React from "react";
import { AppBar, DataCard } from "@repo/ui";
import type { LucideIcon } from "lucide-react";
import {
  LayoutGrid, FolderKanban, Building2, Users, TrendingUp, KeyRound,
  MapPin, Compass, Receipt, Wrench, FileText, CreditCard, ShieldCheck,
  Settings, FolderOpen, SearchCheck, TicketCheck, HelpCircle, LogOut,
  Globe, UserCircle,
} from "lucide-react";
import { useLanguage } from "../../../components/LanguageProvider";
import { useSession } from "../../../components/SimpleSessionProvider";
import { hasPermission, isSystemRole } from "../../../lib/permissions";
import { navItems, sectionLabels, type NavItem } from "../../../components/shell/nav-items";

const iconMap: Record<string, LucideIcon> = {
  LayoutGrid, FolderKanban, Building2, Users, TrendingUp, KeyRound,
  MapPin, Compass, Receipt, Wrench, FileText, CreditCard, ShieldCheck,
  Settings, FolderOpen, SearchCheck, TicketCheck,
};

// Tabs already surfaced in BottomNav — exclude from "More" to avoid duplication.
const bottomNavHrefs = new Set<string>([
  "/dashboard",
  "/dashboard/crm",
  "/dashboard/units",
  "/dashboard/maintenance",
]);

export default function MorePage() {
  const { lang, setLang } = useLanguage();
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role ?? "USER";
  const isPlatformUser = isSystemRole(userRole);

  const visibleItems = navItems.filter((item) => {
    if (item.hiddenFromNav) return false;
    if (bottomNavHrefs.has(item.href)) return false;
    if (item.permission && !hasPermission(userRole, item.permission)) return false;
    if (item.audience === "tenant" && isPlatformUser) return false;
    if (item.audience === "platform" && !isPlatformUser) return false;
    return true;
  });

  const sections: Array<NavItem["section"]> = ["core", "operations", "system"];

  return (
    <div className="md:hidden -m-4 sm:-m-6 lg:-m-8 min-h-dvh flex flex-col bg-background">
      <AppBar title={lang === "ar" ? "المزيد" : "More"} lang={lang} />

      <div className="flex-1 px-4 py-4 space-y-6">
        {sections.map((section) => {
          const items = visibleItems.filter((i) => i.section === section);
          if (items.length === 0) return null;
          return (
            <section key={section}>
              <h2 className="px-1 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {sectionLabels[section]?.[lang] ?? section}
              </h2>
              <div className="space-y-2">
                {items.map((item) => {
                  const Icon = iconMap[item.icon] ?? LayoutGrid;
                  return (
                    <DataCard
                      key={item.href}
                      icon={Icon}
                      title={item.label[lang]}
                      href={item.href}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}

        <section>
          <h2 className="px-1 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {lang === "ar" ? "الحساب" : "Account"}
          </h2>
          <div className="space-y-2">
            <DataCard
              icon={UserCircle}
              iconTone="purple"
              title={lang === "ar" ? "الملف الشخصي" : "Profile"}
              subtitle={
                lang === "ar"
                  ? "الاسم والدور والتفضيلات"
                  : "Name, role, and preferences"
              }
              href="/dashboard/more/profile"
            />
            {!isPlatformUser && (
              <DataCard
                icon={HelpCircle}
                title={lang === "ar" ? "المساعدة" : "Help Center"}
                href="/dashboard/help"
              />
            )}
            <DataCard
              icon={Globe}
              title={lang === "ar" ? "English" : "العربية"}
              subtitle={lang === "ar" ? "تبديل اللغة" : "Switch language"}
              onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            />
            <DataCard
              icon={LogOut}
              title={lang === "ar" ? "تسجيل الخروج" : "Sign out"}
              iconTone="red"
              href="/api/auth/signout"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
