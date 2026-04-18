"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@repo/ui";
import {
  LayoutGrid,
  Users,
  Building2,
  FileText,
  CreditCard,
  Wrench,
  Gauge,
  ShieldCheck,
  Receipt,
  Settings,
  ClipboardList,
  Wallet,
  TrendingUp,
  SearchCheck,
  TicketCheck,
  CalendarCheck,
  UserPlus,
  FilePlus,
  PlusCircle,
  DollarSign,
} from "lucide-react";
import { useLanguage } from "./LanguageProvider";
import { navItems, sectionLabels } from "./shell/nav-items";
import { useSession } from "./SimpleSessionProvider";
import { usePermissions } from "../hooks/usePermissions";

const navIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutGrid,
  ClipboardList,
  Wallet,
  Users,
  Building2,
  TrendingUp,
  FileText,
  CreditCard,
  Gauge,
  Wrench,
  Receipt,
  ShieldCheck,
  SearchCheck,
  TicketCheck,
  CalendarCheck,
  Settings,
};

interface QuickAction {
  id: string;
  label: { ar: string; en: string };
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  audience?: "tenant" | "platform";
}

const quickActions: QuickAction[] = [
  {
    id: "new-customer",
    label: { ar: "عميل جديد", en: "New customer" },
    href: "/dashboard/crm?new=1",
    icon: UserPlus,
    permission: "crm:write",
    audience: "tenant",
  },
  {
    id: "new-deal",
    label: { ar: "صفقة جديدة", en: "New deal" },
    href: "/dashboard/deals?new=1",
    icon: PlusCircle,
    permission: "deals:write",
    audience: "tenant",
  },
  {
    id: "new-contract",
    label: { ar: "عقد جديد", en: "New contract" },
    href: "/dashboard/contracts?new=1",
    icon: FilePlus,
    permission: "contracts:write",
    audience: "tenant",
  },
  {
    id: "new-payment",
    label: { ar: "تسجيل دفعة", en: "Record payment" },
    href: "/dashboard/payments?new=1",
    icon: DollarSign,
    permission: "payments:write",
    audience: "tenant",
  },
  {
    id: "new-ticket",
    label: { ar: "طلب صيانة جديد", en: "New ticket" },
    href: "/dashboard/maintenance/tickets?new=1",
    icon: Wrench,
    permission: "maintenance:write",
    audience: "tenant",
  },
];

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const { lang } = useLanguage();
  const { data: session } = useSession();
  const { can } = usePermissions();

  const isPlatform =
    (session?.user as { role?: string })?.role === "SYSTEM_ADMIN" ||
    (session?.user as { role?: string })?.role === "SYSTEM_SUPPORT";

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = React.useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  const sections: Array<"core" | "operations" | "system"> = [
    "core",
    "operations",
    "system",
  ];

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder={
          lang === "ar"
            ? "ابحث عن صفحة أو إجراء…"
            : "Search pages or actions…"
        }
      />
      <CommandList>
        <CommandEmpty>
          {lang === "ar" ? "لا توجد نتائج." : "No results found."}
        </CommandEmpty>

        {(() => {
          const visibleQuickActions = quickActions.filter((a) => {
            if (a.audience === "tenant" && isPlatform) return false;
            if (a.audience === "platform" && !isPlatform) return false;
            if (a.permission && !can(a.permission as never)) return false;
            return true;
          });
          if (visibleQuickActions.length === 0) return null;
          return (
            <>
              <CommandGroup
                heading={lang === "ar" ? "إجراءات سريعة" : "Quick actions"}
              >
                {visibleQuickActions.map((a) => {
                  const Icon = a.icon;
                  return (
                    <CommandItem key={a.id} onSelect={() => go(a.href)}>
                      <Icon className="h-4 w-4" />
                      <span>{a.label[lang]}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>

              <CommandSeparator />
            </>
          );
        })()}

        {sections.map((section) => {
          const items = navItems.filter((item) => {
            if (item.section !== section) return false;
            if (item.audience === "tenant" && isPlatform) return false;
            if (item.audience === "platform" && !isPlatform) return false;
            if (item.permission && !can(item.permission)) return false;
            return true;
          });
          if (items.length === 0) return null;
          const heading = sectionLabels[section]?.[lang] ?? section;
          return (
            <CommandGroup
              key={section}
              heading={heading}
            >
              {items.map((item) => {
                const Icon = navIconMap[item.icon] ?? LayoutGrid;
                return (
                  <CommandItem
                    key={item.href}
                    onSelect={() => go(item.href)}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label[lang]}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
