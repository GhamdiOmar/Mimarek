"use client";

import * as React from "react";
import { Menu, Search, Bell, Globe, User, Settings, ShieldCheck, HelpCircle, LogOut } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Popover, PopoverTrigger, PopoverContent, DirectionalIcon } from "@repo/ui";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut as nextAuthSignOut } from "next-auth/react";
import { ThemeToggle } from "../ThemeToggle";
import { useSession } from "../SimpleSessionProvider";
import { useLanguage } from "../LanguageProvider";
import { getUnreadCount, getMyNotifications, markAsRead, markAllAsRead } from "../../app/actions/notifications";
import { globalSearch } from "../../app/actions/search";
import { getOrgName } from "../../app/actions/organization";
import { breadcrumbLabels, roleLabels } from "./nav-items";

export function AppTopbar({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { lang, setLang } = useLanguage();

  const [unreadCount, setUnreadCount] = React.useState(0);
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [showNotifs, setShowNotifs] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<any>(null);
  const [showSearch, setShowSearch] = React.useState(false);
  const searchTimeout = React.useRef<any>(null);
  const [orgName, setOrgName] = React.useState("");

  const userName = session?.user?.name ?? (lang === "ar" ? "مستخدم" : "User");
  const userRole = (session?.user as any)?.role ?? "USER";
  const roleLabel = roleLabels[userRole] ?? { ar: "مستخدم", en: "User" };

  React.useEffect(() => {
    getUnreadCount().then(setUnreadCount).catch(() => {});
  }, [pathname]);

  React.useEffect(() => {
    getOrgName().then((org) => {
      if (org) setOrgName(org.nameArabic || org.nameEnglish || org.name);
    }).catch(() => {});
  }, []);

  function handleSearchInput(value: string) {
    setSearchQuery(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!value.trim()) { setSearchResults(null); setShowSearch(false); return; }
    searchTimeout.current = setTimeout(async () => {
      try {
        const results = await globalSearch(value.trim());
        setSearchResults(results);
        setShowSearch(true);
      } catch { setSearchResults(null); }
    }, 300);
  }

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

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-border bg-card/90 backdrop-blur-md px-4 sm:px-6">
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={lang === "ar" ? "فتح القائمة" : "Open menu"}
        >
          <Menu className="h-5 w-5" />
        </button>
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
            onFocus={() => searchResults && setShowSearch(true)}
            onBlur={() => setTimeout(() => setShowSearch(false), 200)}
            placeholder={lang === "ar" ? "بحث..." : "Search..."}
            className="w-full bg-muted/40 border border-transparent rounded-md py-2 ps-9 pe-3 text-sm focus:bg-background focus:border-border focus:ring-2 focus:ring-ring/20 transition-all outline-none placeholder:text-muted-foreground"
          />
          {showSearch && searchResults && (
            <div className="absolute top-full mt-1 w-full bg-card rounded-lg shadow-md border border-border z-50 max-h-80 overflow-y-auto">
              {[
                { key: "customers", label: lang === "ar" ? "العملاء" : "Customers", prefix: "/dashboard/sales/customers" },
                { key: "projects", label: lang === "ar" ? "المشاريع" : "Projects", prefix: "/dashboard/projects" },
                { key: "units", label: lang === "ar" ? "الوحدات" : "Units", prefix: "/dashboard/units" },
                { key: "contracts", label: lang === "ar" ? "العقود" : "Contracts", prefix: "/dashboard/sales/contracts" },
              ].map(({ key, label, prefix }) => {
                const items = searchResults[key] ?? [];
                if (!items.length) return null;
                return (
                  <div key={key}>
                    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted/30">{label}</div>
                    {items.map((item: any) => (
                      <Link
                        key={item.id}
                        href={`${prefix}/${item.id}`}
                        className="block px-3 py-2 text-sm text-foreground hover:bg-muted/30 transition-colors"
                        onClick={() => { setShowSearch(false); setSearchQuery(""); }}
                      >
                        {item.name || item.unitNumber || item.number || item.id}
                      </Link>
                    ))}
                  </div>
                );
              })}
              {Object.values(searchResults).every((arr: any) => !arr?.length) && (
                <div className="px-3 py-4 text-sm text-muted-foreground text-center">{lang === "ar" ? "لا توجد نتائج" : "No results"}</div>
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
            <button
              className="relative p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/40"
              aria-label={lang === "ar" ? "الإشعارات" : "Notifications"}
            >
              <Bell className="h-[18px] w-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute top-1 end-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground ring-2 ring-card">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" sideOffset={8} className="w-[calc(100vw-2rem)] sm:w-96 p-0 max-h-[480px] overflow-hidden rounded-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
              <span className="text-sm font-bold text-foreground">{lang === "ar" ? "الإشعارات" : "Notifications"}</span>
              {unreadCount > 0 && (
                <button onClick={handleMarkAllRead} className="text-xs font-medium text-primary hover:underline">
                  {lang === "ar" ? "تحديد الكل كمقروء" : "Mark all read"}
                </button>
              )}
            </div>
            {/* Notification list */}
            <div className="overflow-y-auto max-h-[420px]">
              {notifications.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <Bell className="h-6 w-6 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">{lang === "ar" ? "لا توجد إشعارات" : "No notifications"}</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleNotifClick(n)}
                    className={cn(
                      "w-full text-start px-4 py-3.5 hover:bg-muted/20 transition-colors border-b border-border/50 last:border-0 group",
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
                            {new Date(n.createdAt).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                          {n.user && (
                            <span className="text-[10px] text-muted-foreground/50">
                              {n.user}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>

        <ThemeToggle />

        {/* Language */}
        <button
          onClick={() => setLang(lang === "ar" ? "en" : "ar")}
          className="flex items-center gap-1.5 px-2.5 py-2 text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-md transition-all"
          aria-label={lang === "ar" ? "Switch to English" : "تغيير للعربية"}
        >
          <Globe className="h-4 w-4" />
          <span className="text-xs font-medium hidden sm:inline">{lang === "ar" ? "EN" : "ع"}</span>
        </button>

        <div className="h-6 w-px bg-border mx-0.5" />

        {/* User */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-2.5 group p-1.5" aria-label={lang === "ar" ? "الملف الشخصي" : "Profile"}>
              <div className="h-8 w-8 rounded-full bg-muted border border-border flex items-center justify-center overflow-hidden transition-all group-hover:border-primary/40">
                <User className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
            </button>
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
              <button
                onClick={() => nextAuthSignOut({ callbackUrl: "/auth/login" })}
                className="flex items-center gap-2.5 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors w-full"
              >
                <DirectionalIcon icon={LogOut} className="h-4 w-4" />
                <span>{lang === "ar" ? "تسجيل الخروج" : "Sign Out"}</span>
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}
