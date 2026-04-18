"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { SimpleSessionProvider, useSession } from "../../components/SimpleSessionProvider";
import { LanguageProvider, useLanguage } from "../../components/LanguageProvider";
import { AppSidebar } from "../../components/shell/AppSidebar";
import { AppTopbar } from "../../components/shell/AppTopbar";
import { MobileTopbar } from "../../components/shell/MobileTopbar";
import { MobileBottomTabs } from "../../components/shell/MobileBottomTabs";
import { CommandPalette } from "../../components/CommandPalette";
import { isSystemRole } from "../../lib/permissions";
import { navItems } from "../../components/shell/nav-items";

function DashboardContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { lang } = useLanguage();
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const userRole = (session?.user as any)?.role ?? "USER";

  // Tenant-route guard — redirect platform users off tenant-audience routes.
  // Symmetric to /dashboard/admin/layout.tsx which blocks tenant users from admin routes.
  React.useEffect(() => {
    if (!session) return;
    if (!isSystemRole(userRole)) return;
    // /dashboard/admin/** is platform-scoped — allowed.
    if (pathname.startsWith("/dashboard/admin")) return;
    // Shared surfaces (profile, more, signout callback) — allowed.
    if (
      pathname === "/dashboard/more" ||
      pathname.startsWith("/dashboard/more/") ||
      pathname.startsWith("/dashboard/settings") ||
      pathname.startsWith("/dashboard/billing")
    ) {
      return;
    }
    // /dashboard itself and every tenant-audience nav route → push platform users to admin.
    const isTenantPath =
      pathname === "/dashboard" ||
      navItems.some(
        (i) =>
          i.audience === "tenant" &&
          (pathname === i.href || pathname.startsWith(i.href + "/")),
      );
    if (isTenantPath) router.replace("/dashboard/admin");
  }, [pathname, session, userRole, router]);

  // Close mobile drawer on route change
  React.useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Close on Escape
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && mobileOpen) setMobileOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  return (
    <div className="flex min-h-screen bg-background" dir={lang === "ar" ? "rtl" : "ltr"}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:start-4 focus:z-[2000] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
      >
        {lang === "ar" ? "تخطّي إلى المحتوى" : "Skip to content"}
      </a>
      <CommandPalette />
      <AppSidebar
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        userRole={userRole}
      />
      <main className="flex flex-1 flex-col transition-all duration-300 min-w-0">
        <div className="hidden md:block">
          <AppTopbar onMenuClick={() => setMobileOpen(true)} />
        </div>
        <div className="md:hidden">
          <MobileTopbar onMenuClick={() => setMobileOpen(true)} />
        </div>
        <div
          id="main-content"
          className="p-4 sm:p-6 lg:p-8 flex-1 overflow-y-auto overflow-x-hidden pb-[calc(3.5rem+env(safe-area-inset-bottom)+1rem)] md:pb-8"
        >
          <div className="max-w-[1440px] mx-auto w-full">
            {children}
          </div>
        </div>
      </main>
      <div className="md:hidden fixed inset-x-0 bottom-0 z-40">
        <MobileBottomTabs userRole={userRole} />
      </div>
    </div>
  );
}

export default function DashboardClientLayout({
  children,
  session,
}: {
  children: React.ReactNode;
  session: any;
}) {
  return (
    <SimpleSessionProvider session={session}>
      <LanguageProvider>
        <DashboardContent>{children}</DashboardContent>
      </LanguageProvider>
    </SimpleSessionProvider>
  );
}
