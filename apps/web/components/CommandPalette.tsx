"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@repo/ui/primitives/dialog";
import {
  Command,
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
  ReceiptText,
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
  Store,
  Tags,
  ShieldAlert,
  HelpCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { useLanguage } from "./LanguageProvider";
import { navItems, sectionLabels } from "./shell/nav-items";
import { useSession } from "./SimpleSessionProvider";
import { usePermissions } from "../hooks/usePermissions";
import { useFederatedSearch } from "../hooks/useFederatedSearch";
import { trackEvent, AnalyticsEvent } from "../lib/analytics";
import { SEARCH_ENTITY_META, SEARCH_ENTITY_ORDER } from "../lib/search-entity-meta";

const navIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutGrid,
  ClipboardList,
  Wallet,
  Users,
  Building2,
  TrendingUp,
  FileText,
  CreditCard,
  ReceiptText,
  Gauge,
  Wrench,
  Receipt,
  ShieldCheck,
  SearchCheck,
  TicketCheck,
  CalendarCheck,
  Settings,
  Store,
  Tags,
  ShieldAlert,
  HelpCircle,
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
    label: { ar: "حجز جديد", en: "New reservation" },
    href: "/dashboard/reservations?new=1",
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

/** Locale-folded substring match — owns nav/quick-action filtering (cmdk filter off). */
function matches(haystack: string, needle: string): boolean {
  if (!needle) return true;
  return haystack.toLocaleLowerCase().includes(needle.toLocaleLowerCase());
}

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const router = useRouter();
  const { t, lang } = useLanguage();
  const { data: session } = useSession();
  const { can } = usePermissions();

  const isPlatform =
    (session?.user as { role?: string })?.role === "SYSTEM_ADMIN" ||
    (session?.user as { role?: string })?.role === "SYSTEM_SUPPORT";

  // Record search runs only for tenant users (§8 — system Cmd-K stays nav-only).
  const { groups, loading, showSpinner, error, isSearching } = useFederatedSearch(
    isPlatform ? "" : query,
    lang,
  );

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

  // Reset the query each time the palette opens/closes.
  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  // Report only the result count to analytics — NEVER the query (it can be PII).
  const resultCount = React.useMemo(
    () => groups.reduce((sum, g) => sum + g.hits.length, 0),
    [groups],
  );
  const prevLoadingRef = React.useRef(false);
  React.useEffect(() => {
    // Fire once per settled search (loading true→false). Count only.
    if (prevLoadingRef.current && !loading && isSearching) {
      trackEvent(AnalyticsEvent.SearchPerformed, { result_count: resultCount });
    }
    prevLoadingRef.current = loading;
  }, [loading, isSearching, resultCount]);

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

  // Self-filtered static items (cmdk filtering is OFF — we own all matching).
  const visibleQuickActions = quickActions.filter((a) => {
    if (a.audience === "tenant" && isPlatform) return false;
    if (a.audience === "platform" && !isPlatform) return false;
    if (a.permission && !can(a.permission as never)) return false;
    return matches(a.label[lang], query);
  });

  const navSections = sections
    .map((section) => ({
      section,
      heading: sectionLabels[section]?.[lang] ?? section,
      items: navItems.filter((item) => {
        if (item.section !== section) return false;
        if (item.audience === "tenant" && isPlatform) return false;
        if (item.audience === "platform" && !isPlatform) return false;
        if (item.permission && !can(item.permission)) return false;
        return matches(item.label[lang], query);
      }),
    }))
    .filter((s) => s.items.length > 0);

  // "Help" entry — Cmd-K residue (CX-015). Tenant-only; matches the query like nav.
  const showHelp =
    !isPlatform && matches(t("المساعدة", "Help"), query);

  const hasRecordGroups = !isPlatform && groups.length > 0;
  const hasStaticItems =
    visibleQuickActions.length > 0 || navSections.length > 0 || showHelp;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0">
        <DialogTitle className="sr-only">
          {t("البحث في الأوامر والسجلات", "Command and record search")}
        </DialogTitle>
        <Command
          shouldFilter={false}
          loop
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[data-cmdk-input-wrapper]_svg]:h-5 [&_[data-cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
        >
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={
              t("ابحث عن سجل أو صفحة أو إجراء…", "Search records, pages or actions…")
            }
          />

          {/* Result-count announcement for assistive tech. */}
          <span className="sr-only" role="status" aria-live="polite">
            {isSearching
              ? t(`${resultCount} نتيجة`, `${resultCount} results`)
              : ""}
          </span>

          <CommandList>
            {/* Spinner only after a stall. */}
            {isSearching && showSpinner && (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t("جارٍ البحث…", "Searching…")}</span>
              </div>
            )}

            {/* Inline friendly error — never the raw exception. */}
            {error && (
              <div
                role="alert"
                className="px-3 py-4 text-sm text-destructive text-center"
              >
                {t("تعذّر إجراء البحث. حاول مرة أخرى.", "We couldn't run the search. Please try again.")}
              </div>
            )}

            <CommandEmpty>
              {isSearching
                ? lang === "ar"
                  ? `لا توجد نتائج لـ "${query.trim()}".`
                  : `No results for "${query.trim()}".`
                : t("لا توجد نتائج.", "No results found.")}
            </CommandEmpty>

            {/* Record groups first, fixed order (tenant only). */}
            {hasRecordGroups &&
              SEARCH_ENTITY_ORDER.map((type) => {
                const group = groups.find((g) => g.type === type);
                if (!group || group.hits.length === 0) return null;
                const meta = SEARCH_ENTITY_META[type];
                const Icon = meta.icon;
                return (
                  <CommandGroup key={type} heading={meta.label[lang]}>
                    {group.hits.map((hit) => (
                      <CommandItem
                        key={`${hit.type}:${hit.id}`}
                        value={`${hit.type}:${hit.id}`}
                        onSelect={() => go(hit.href)}
                      >
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 min-w-0 truncate">{hit.title}</span>
                        {hit.maskedPii && (
                          <span
                            dir="ltr"
                            className="number-ltr text-xs text-muted-foreground tabular-nums"
                          >
                            {hit.maskedPii}
                          </span>
                        )}
                        {hit.subtitle && !hit.maskedPii && (
                          <span className="text-xs text-muted-foreground truncate">
                            {hit.subtitle}
                          </span>
                        )}
                      </CommandItem>
                    ))}
                    {group.hasMore && (
                      <CommandItem
                        key={`${type}:see-all`}
                        value={`see-all:${type}`}
                        onSelect={() => go(SEARCH_ENTITY_META[type].listHref(query))}
                      >
                        <ArrowRight className="h-4 w-4 text-primary icon-directional" />
                        <span className="text-primary">
                          {t("عرض الكل", "See all")}
                        </span>
                      </CommandItem>
                    )}
                  </CommandGroup>
                );
              })}

            {hasRecordGroups && hasStaticItems && <CommandSeparator />}

            {/* Quick actions. */}
            {visibleQuickActions.length > 0 && (
              <CommandGroup
                heading={t("إجراءات سريعة", "Quick actions")}
              >
                {visibleQuickActions.map((a) => {
                  const Icon = a.icon;
                  return (
                    <CommandItem
                      key={a.id}
                      value={`quick:${a.id}`}
                      onSelect={() => go(a.href)}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{a.label[lang]}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {/* Navigation. */}
            {navSections.map(({ section, heading, items }) => (
              <CommandGroup key={section} heading={heading}>
                {items.map((item) => {
                  const Icon = navIconMap[item.icon] ?? LayoutGrid;
                  return (
                    <CommandItem
                      key={item.href}
                      value={`nav:${item.href}`}
                      onSelect={() => go(item.href)}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label[lang]}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}

            {/* Help (CX-015) — tenant only. */}
            {showHelp && (
              <CommandGroup heading={t("الدعم", "Support")}>
                <CommandItem
                  value="help"
                  onSelect={() => go("/dashboard/help")}
                >
                  <HelpCircle className="h-4 w-4" />
                  <span>{t("المساعدة", "Help")}</span>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
