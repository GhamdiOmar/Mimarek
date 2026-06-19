"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { SimpleSessionProvider, useSession } from "../../components/SimpleSessionProvider";
import { LanguageProvider, useLanguage, type Lang } from "../../components/LanguageProvider";
import { AppTopbar } from "../../components/shell/AppTopbar";
import { MobileTopbar } from "../../components/shell/MobileTopbar";
import { CircleMenu } from "../../components/shell/CircleMenu";
import { CommandPalette } from "../../components/CommandPalette";
import { isSystemRole } from "../../lib/permissions";
import { navItems } from "../../components/shell/nav-items";
import { identify } from "../../lib/analytics";

/**
 * The dashboard reads a few NextAuth-augmented fields (`id`, `organizationId`)
 * that the lightweight `SimpleSessionProvider` `SessionData["user"]` type only
 * carries via its `[key: string]: unknown` index signature. This narrow,
 * structurally-compatible view names exactly the fields read here so the loose
 * session shape stays loose-but-typed (no precise NextAuth `Session` import that
 * would re-tighten the `SimpleSessionProvider` prop contract).
 */
type DashboardSessionUser = {
  id?: string;
  role?: string;
  organizationId?: string | null;
  name?: string | null;
  email?: string | null;
};

/**
 * Loose-but-typed session prop shape — mirrors `SimpleSessionProvider`'s
 * (non-exported) `SessionData` structurally so it remains assignable to that
 * provider's `session` prop without importing a 6th file.
 */
type DashboardSession = {
  user?: DashboardSessionUser & { [key: string]: unknown };
  expires?: string;
  [key: string]: unknown;
} | null;

function DashboardContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { t, lang } = useLanguage();
  const [navOpen, setNavOpen] = React.useState(false);

  const userRole = session?.user?.role ?? "USER";

  // Tenant-route guard — redirect platform users off tenant-audience routes.
  // Symmetric to /dashboard/admin/layout.tsx which blocks tenant users from admin routes.
  React.useEffect(() => {
    if (!session) return;
    if (!isSystemRole(userRole)) return;
    // /dashboard/admin/** is platform-scoped — allowed.
    if (pathname.startsWith("/dashboard/admin")) return;
    // Shared surfaces (settings + profile section, signout callback) — allowed.
    if (
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

  // Associate the GA4 session with an opaque user + org (CX-004). No-op until
  // analytics consent is granted (window.gtag is undefined before then).
  React.useEffect(() => {
    const u = session?.user as DashboardSessionUser | undefined;
    if (!u?.id) return;
    identify({ userId: u.id, orgId: u.organizationId ?? null, role: u.role });
  }, [session]);

  return (
    <div className="flex min-h-screen bg-background" dir={lang === "ar" ? "rtl" : "ltr"}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:start-4 focus:z-[2000] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
      >
        {t("تخطّي إلى المحتوى", "Skip to content")}
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
  initialLang,
}: {
  children: React.ReactNode;
  session: DashboardSession;
  initialLang?: Lang;
}) {
  return (
    <SimpleSessionProvider session={session}>
      <LanguageProvider initialLang={initialLang}>
        <DashboardContent>{children}</DashboardContent>
      </LanguageProvider>
    </SimpleSessionProvider>
  );
}
