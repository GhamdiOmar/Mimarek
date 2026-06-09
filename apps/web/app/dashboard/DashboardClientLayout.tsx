"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { SimpleSessionProvider, useSession } from "../../components/SimpleSessionProvider";
import { LanguageProvider, useLanguage } from "../../components/LanguageProvider";
import { AppTopbar } from "../../components/shell/AppTopbar";
import { MobileTopbar } from "../../components/shell/MobileTopbar";
import { CircleMenu } from "../../components/shell/CircleMenu";
import { CommandPalette } from "../../components/CommandPalette";
import { isSystemRole } from "../../lib/permissions";
import { navItems } from "../../components/shell/nav-items";

function DashboardContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { lang } = useLanguage();
  const [navOpen, setNavOpen] = React.useState(false);

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

  // Close the radial menu on route change (the overlay also closes on link click).
  React.useEffect(() => { setNavOpen(false); }, [pathname]);

  return (
    <div className="flex min-h-screen bg-background" dir={lang === "ar" ? "rtl" : "ltr"}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:start-4 focus:z-[2000] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
      >
        {lang === "ar" ? "تخطّي إلى المحتوى" : "Skip to content"}
      </a>
      <CommandPalette />
      <CircleMenu open={navOpen} onOpenChange={setNavOpen} userRole={userRole} />
      <main className="flex flex-1 flex-col min-w-0">
        <div className="hidden md:block">
          <AppTopbar />
        </div>
        <div className="md:hidden">
          <MobileTopbar onMenuClick={() => setNavOpen(true)} />
        </div>
        <div
          id="main-content"
          className="p-4 sm:p-6 lg:p-8 flex-1 overflow-y-auto overflow-x-hidden pb-[calc(4.5rem+env(safe-area-inset-bottom)+1rem)]"
        >
          <div className="max-w-[1440px] mx-auto w-full">
            {children}
          </div>
        </div>
      </main>
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
