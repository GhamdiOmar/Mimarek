"use client";

import * as React from "react";
import {
  Search,
  Bell,
  Globe,
  User,
  Settings,
  ShieldCheck,
  HelpCircle,
  LogOut,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Popover, PopoverTrigger, PopoverContent, DirectionalIcon, Button, IconButton } from "@repo/ui";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut as nextAuthSignOut } from "next-auth/react";
import { ThemeToggle } from "../ThemeToggle";
import { useSession } from "../SimpleSessionProvider";
import { useLanguage } from "../LanguageProvider";
import { getUnreadCount, getMyNotifications, markAsRead, markAllAsRead } from "../../app/actions/notifications";
import { getOrgName } from "../../app/actions/organization";
import { isSystemRole } from "../../lib/permissions";
import { useFederatedSearch } from "../../hooks/useFederatedSearch";
import { trackEvent, AnalyticsEvent } from "../../lib/analytics";
import { SEARCH_ENTITY_META, SEARCH_ENTITY_ORDER } from "../../lib/search-entity-meta";
import { breadcrumbLabels, roleLabels } from "./nav-items";

import {
  type NotifCategory,
  categorizeNotification,
  NOTIF_CATEGORIES,
} from "./notification-categories";

export function AppTopbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { lang, setLang } = useLanguage();

  const [unreadCount, setUnreadCount] = React.useState(0);
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [showNotifs, setShowNotifs] = React.useState(false);
  const [notifCategory, setNotifCategory] = React.useState<NotifCategory>("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [showSearch, setShowSearch] = React.useState(false);
  const [orgName, setOrgName] = React.useState("");

  const { groups, loading, showSpinner, error, isSearching } = useFederatedSearch(searchQuery, lang);
  const resultCount = React.useMemo(
    () => groups.reduce((sum, g) => sum + g.hits.length, 0),
    [groups],
  );
  const hasResults = groups.length > 0;

  const userName = session?.user?.name ?? (lang === "ar" ? "مستخدم" : "User");
  const userRole = (session?.user as any)?.role ?? "USER";
  const roleLabel = roleLabels[userRole] ?? { ar: "مستخدم", en: "User" };

  React.useEffect(() => {
    getUnreadCount().then(setUnreadCount).catch(() => {});
  }, [pathname]);

  React.useEffect(() => {
    // System users have no organization — skip the tenant-scoped lookup
    // (no tenant action in a platform context, §8; avoids a 500/round-trip — CX-001).
    if (isSystemRole(userRole)) return;
    getOrgName().then((org) => {
      if (org) setOrgName(org.nameArabic || org.nameEnglish || org.name);
    }).catch(() => {});
  }, [userRole]);

  function handleSearchInput(value: string) {
    setSearchQuery(value);
    setShowSearch(Boolean(value.trim()));
  }

  // Report only the result count to analytics — NEVER the query (it can be PII).
  const prevLoadingRef = React.useRef(false);
  React.useEffect(() => {
    // Fire once per settled search (loading true→false). Count only.
    if (prevLoadingRef.current && !loading && isSearching) {
      trackEvent(AnalyticsEvent.SearchPerformed, { result_count: resultCount });
    }
    prevLoadingRef.current = loading;
  }, [loading, isSearching, resultCount]);

  async function handleMarkAllRead() {
    await markAllAsRead();
    setUnreadCount(0);
    setNotifications((n) => n.map((x) => ({ ...x, read: true })));
  }

  async function handleNotifClick(notif: any) {
    if (!notif.read) {
      await markAsRead(notif.id);
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifications((n) => n.map((x) => x.id === notif.id ? { ...x, read: true } : x));
    }
    setShowNotifs(false);
    if (notif.link) router.push(notif.link);
  }

  // Breadcrumbs
  const segments = pathname.replace("/dashboard", "").split("/").filter(Boolean);
  const crumbs = [{ label: lang === "ar" ? "لوحة التحكم" : "Dashboard", href: "/dashboard" }];
  let path = "/dashboard";
  segments.forEach((seg) => {
    path += `/${seg}`;
    crumbs.push({ label: breadcrumbLabels[seg]?.[lang] || seg, href: path });
  });
  if (crumbs.length === 1) crumbs.push({ label: lang === "ar" ? "نظرة عامة" : "Overview", href: "/dashboard" });

  const visibleNotifs =
    notifCategory === "all"
      ? notifications
      : notifications.filter((n) => categorizeNotification(n.type) === notifCategory);

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-border bg-card/90 backdrop-blur-md px-4 sm:px-6">
      <div className="flex items-center gap-3">
        {/* Breadcrumbs */}
        <nav className="hidden sm:flex items-center text-xs text-muted-foreground font-medium" aria-label="Breadcrumb">
          {crumbs.map((crumb, i) => (
            <React.Fragment key={`${crumb.href}-${i}`}>
              {i > 0 && <span className="mx-1.5 text-border">/</span>}
              {i === crumbs.length - 1 ? (
                <span className="text-foreground font-semibold" aria-current="page">{crumb.label}</span>
              ) : (
                <Link href={crumb.href} className="hover:text-foreground transition-colors">{crumb.label}</Link>
              )}
            </React.Fragment>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Search */}
        <div className="hidden md:flex relative w-56 xl:w-72">
          <Search className="h-4 w-4 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchInput(e.target.value)}
            onFocus={() => setShowSearch(Boolean(searchQuery.trim()))}
            onBlur={() => setTimeout(() => setShowSearch(false), 200)}
            placeholder={lang === "ar" ? "بحث..." : "Search..."}
            aria-label={lang === "ar" ? "بحث" : "Search"}
            className="w-full bg-muted/40 border border-transparent rounded-md py-2 ps-9 pe-3 text-sm focus:bg-background focus:border-border focus:ring-2 focus:ring-ring/20 transition-all outline-none placeholder:text-muted-foreground"
          />
          {/* Result-count announcement for assistive tech. */}
          <span className="sr-only" role="status" aria-live="polite">
            {isSearching ? (lang === "ar" ? `${resultCount} نتيجة` : `${resultCount} results`) : ""}
          </span>
          {showSearch && isSearching && (
            <div className="absolute top-full mt-1 w-full bg-card rounded-lg shadow-md border border-border z-50 max-h-80 overflow-y-auto">
              {showSpinner && (
                <div className="flex items-center justify-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{lang === "ar" ? "جارٍ البحث…" : "Searching…"}</span>
                </div>
              )}
              {error && !showSpinner && (
                <div role="alert" className="px-3 py-4 text-sm text-destructive text-center">
                  {lang === "ar" ? "تعذّر إجراء البحث. حاول مرة أخرى." : "We couldn't run the search. Please try again."}
                </div>
              )}
              {!showSpinner && !error && SEARCH_ENTITY_ORDER.map((type) => {
                const group = groups.find((g) => g.type === type);
                if (!group || group.hits.length === 0) return null;
                const meta = SEARCH_ENTITY_META[type];
                const Icon = meta.icon;
                return (
                  <div key={type}>
                    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted/30">{meta.label[lang]}</div>
                    {group.hits.map((hit) => (
                      <Link
                        key={`${hit.type}:${hit.id}`}
                        href={hit.href}
                        className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted/30 transition-colors"
                        onClick={() => { setShowSearch(false); setSearchQuery(""); }}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="flex-1 min-w-0 truncate">{hit.title}</span>
                        {hit.maskedPii ? (
                          <span dir="ltr" className="number-ltr text-xs text-muted-foreground tabular-nums">{hit.maskedPii}</span>
                        ) : hit.subtitle ? (
                          <span className="text-xs text-muted-foreground truncate">{hit.subtitle}</span>
                        ) : null}
                      </Link>
                    ))}
                    {group.hasMore && (
                      <Link
                        href={SEARCH_ENTITY_META[type].listHref(searchQuery)}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-primary hover:bg-muted/30 transition-colors"
                        onClick={() => { setShowSearch(false); setSearchQuery(""); }}
                      >
                        <ArrowRight className="h-3.5 w-3.5 icon-directional" />
                        <span>{lang === "ar" ? "عرض الكل" : "See all"}</span>
                      </Link>
                    )}
                  </div>
                );
              })}
              {!showSpinner && !error && !hasResults && (
                <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                  {lang === "ar" ? `لا توجد نتائج لـ "${searchQuery.trim()}"` : `No results for "${searchQuery.trim()}"`}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Notifications */}
        <Popover open={showNotifs} onOpenChange={async (open) => {
          if (open) {
            const notifs = await getMyNotifications(10);
            setNotifications(notifs);
          }
          setShowNotifs(open);
        }}>
          <PopoverTrigger asChild>
            <span className="relative inline-flex">
              <IconButton
                icon={Bell}
                aria-label={lang === "ar" ? "الإشعارات" : "Notifications"}
                variant="ghost"
              />
              {unreadCount > 0 && (
                <span className="pointer-events-none absolute top-1 end-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground ring-2 ring-card">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </span>
          </PopoverTrigger>
          <PopoverContent align="start" sideOffset={8} className="w-[calc(100vw-2rem)] sm:w-96 p-0 max-h-[480px] overflow-hidden rounded-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
              <span className="text-sm font-bold text-foreground">{lang === "ar" ? "الإشعارات" : "Notifications"}</span>
              {unreadCount > 0 && (
                <Button onClick={handleMarkAllRead} variant="link" size="sm">
                  {lang === "ar" ? "تحديد الكل كمقروء" : "Mark all read"}
                </Button>
              )}
            </div>
            {/* Category filter pills (§6.6.6 pill standard) */}
            <div className="flex items-center gap-1.5 overflow-x-auto px-3 py-2 border-b border-border">
              {NOTIF_CATEGORIES.map((cat) => {
                const active = notifCategory === cat.key;
                return (
                  <Button
                    key={cat.key}
                    onClick={() => setNotifCategory(cat.key)}
                    variant={active ? "primary" : "subtle"}
                    size="sm"
                    aria-pressed={active}
                    className="rounded-full shrink-0"
                  >
                    {cat.label[lang]}
                  </Button>
                );
              })}
            </div>
            {/* Notification list */}
            <div className="overflow-y-auto max-h-[420px]">
              {visibleNotifs.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <Bell className="h-6 w-6 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {notifCategory === "all"
                      ? lang === "ar" ? "لا توجد إشعارات" : "No notifications"
                      : lang === "ar" ? "لا توجد إشعارات في هذه الفئة" : "No notifications in this category"}
                  </p>
                </div>
              ) : (
                visibleNotifs.map((n) => (
                  <Button
                    key={n.id}
                    onClick={() => handleNotifClick(n)}
                    variant="ghost"
                    className={cn(
                      "w-full justify-start text-start px-4 py-3.5 h-auto rounded-none hover:bg-muted/20 transition-colors border-b border-border/50 last:border-0",
                      !n.read && "bg-primary/5 border-s-2 border-s-primary"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "mt-0.5 h-2 w-2 rounded-full shrink-0",
                        !n.read ? "bg-primary" : "bg-muted-foreground/20"
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground leading-snug">
                          {lang === "ar" ? n.title : (n.titleEn || n.title)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                          {lang === "ar" ? n.message : (n.messageEn || n.message)}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] text-muted-foreground/50 tabular-nums">
                            {new Date(n.createdAt).toLocaleDateString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                          {n.user && (
                            <span className="text-[10px] text-muted-foreground/50">
                              {n.user}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>

        <ThemeToggle />

        {/* Language */}
        <Button
          onClick={() => setLang(lang === "ar" ? "en" : "ar")}
          variant="ghost"
          size="sm"
          aria-label={lang === "ar" ? "Switch to English" : "تغيير للعربية"}
          className="gap-1.5 px-2.5"
        >
          <Globe className="h-4 w-4" />
          <span className="text-xs font-medium hidden sm:inline">{lang === "ar" ? "EN" : "ع"}</span>
        </Button>

        <div className="h-6 w-px bg-border mx-0.5" />

        {/* User */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="group p-1.5 h-auto w-auto" aria-label={lang === "ar" ? "الملف الشخصي" : "Profile"}>
              <div className="h-8 w-8 rounded-full bg-muted border border-border flex items-center justify-center overflow-hidden transition-all group-hover:border-primary/40">
                <User className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" sideOffset={8} className="w-64 p-0">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold text-foreground truncate">{userName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{roleLabel[lang]}</p>
              {orgName && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{orgName}</p>}
              {session?.user?.email && (
                <p className="text-[11px] text-muted-foreground mt-1.5 truncate" dir="ltr">{session.user.email}</p>
              )}
            </div>
            <div className="py-1">
              {[
                { href: "/dashboard/settings", icon: Settings, label: { ar: "الإعدادات", en: "Settings" } },
                { href: "/dashboard/settings/security", icon: ShieldCheck, label: { ar: "الأمان", en: "Security" } },
                { href: "/dashboard/help", icon: HelpCircle, label: { ar: "المساعدة", en: "Help" } },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-2.5 px-4 py-2 text-sm text-foreground hover:bg-muted/40 transition-colors"
                >
                  <link.icon className="h-4 w-4 text-muted-foreground" />
                  <span>{link.label[lang]}</span>
                </Link>
              ))}
            </div>
            <div className="border-t border-border py-1">
              <Button
                onClick={() => nextAuthSignOut({ callbackUrl: "/auth/login" })}
                variant="ghost"
                className="w-full justify-start gap-2.5 px-4 py-2 h-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <DirectionalIcon icon={LogOut} className="h-4 w-4" />
                <span>{lang === "ar" ? "تسجيل الخروج" : "Sign Out"}</span>
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}
