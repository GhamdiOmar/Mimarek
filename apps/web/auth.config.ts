import type { NextAuthConfig } from "next-auth";
import { audienceForPath } from "./lib/route-guards";

/**
 * Edge-compatible auth config — no Node.js-only imports (bcrypt, prisma adapter).
 * Used by middleware.ts for route protection.
 * Full auth with DB + bcrypt lives in auth.ts.
 */
export const authConfig = {
  pages: {
    signIn: "/auth/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith("/dashboard");
      const isOnboarding = nextUrl.pathname === "/dashboard/onboarding";
      const isBillingPage = nextUrl.pathname.startsWith("/dashboard/billing");

      if (isOnDashboard) {
        if (!isLoggedIn) return false; // Redirect to login

        const role = (auth?.user as any)?.role;

        // CX-018 — Tenants (USER role) live in the self-service portal, never the
        // tenant dashboard. The role holds `dashboard:read`, so without this edge
        // redirect a Tenant could reach the PropertyOwner Dashboard/Leasing/Finance
        // pages by typing the URL directly (login routes them to /portal, but
        // nothing blocked manual navigation). Redirect BEFORE the onboarding check
        // so a Tenant is never bounced to /dashboard/onboarding — org onboarding is
        // a PropertyOwner flow, not a Tenant one.
        if (role === "USER") {
          return Response.redirect(new URL("/portal", nextUrl));
        }

        // Redirect un-onboarded users to onboarding wizard
        const onboardingDone = (auth?.user as any)?.onboardingCompleted !== false;
        if (!onboardingDone && !isOnboarding) {
          return Response.redirect(new URL("/dashboard/onboarding", nextUrl));
        }

        // Layer 2 audience gate (CLAUDE.md § 8.3) — system users may only visit
        // platform + shared surfaces. Every tenant route calls tenant-scoped
        // server actions that Layer 3 rejects for system roles; if we let the
        // page render it would throw a 500. Redirect before that.
        //
        // F4: the route→audience map is now ROUTE_GUARDS (lib/route-guards.ts) —
        // a single edge-safe source of truth shared with nav-items.ts and the
        // page guards. `audienceForPath` does longest-prefix matching so nested
        // routes (/dashboard/admin/coupons, /dashboard/notifications/x, dynamic
        // [id] segments) resolve correctly. The `/dashboard` key (audience
        // "tenant") is a prefix of every /dashboard/** path, so any unmapped
        // path under /dashboard falls through to "tenant" — exactly the old
        // "everything else under /dashboard = tenant" semantics. The old
        // hardcoded allowlist (admin* = platform; more/profile, notifications* = shared)
        // is reproduced by the corresponding ROUTE_GUARDS entries.
        const isSystemRole = role === "SYSTEM_ADMIN" || role === "SYSTEM_SUPPORT";
        if (isSystemRole) {
          const audience = audienceForPath(nextUrl.pathname);
          // System users are allowed on "platform" and "shared" surfaces only.
          // Anything resolving to "tenant" (or, defensively, no match) → redirect.
          if (audience !== "platform" && audience !== "shared") {
            return Response.redirect(new URL("/dashboard/admin", nextUrl));
          }
        }

        // Subscription enforcement — redirect expired/unpaid to billing page
        const subscriptionStatus = (auth?.user as any)?.subscriptionStatus;

        // System roles bypass subscription checks (Mimaric platform staff)
        if (!isSystemRole && subscriptionStatus) {
          // CANCELED or UNPAID → redirect to billing (except billing page itself)
          if (["CANCELED", "UNPAID"].includes(subscriptionStatus) && !isBillingPage) {
            return Response.redirect(new URL("/dashboard/billing", nextUrl));
          }
        }

        return true;
      }

      return true;
    },
    async jwt({ token, user, trigger, session }: any) {
      if (user) {
        token.role = (user as any).role;
        token.organizationId = (user as any).organizationId;
        token.onboardingCompleted = (user as any).onboardingCompleted ?? true;
        token.accountType = (user as any).accountType ?? null;
        token.subscriptionStatus = (user as any).subscriptionStatus ?? null;
      }
      // Backward compatibility — map deprecated roles (remove after full migration)
      if (token.role === "SUPER_ADMIN") token.role = "COMPANY_ADMIN";
      if (token.role === "DEV_ADMIN") token.role = "SYSTEM_SUPPORT";

      // Only allow onboardingCompleted to be updated from client-side session.update().
      // Role, organizationId, and subscriptionStatus must NOT be settable from the
      // client to prevent privilege escalation. They are set at login time only.
      if (trigger === "update" && session) {
        if (typeof session.onboardingCompleted === "boolean") {
          token.onboardingCompleted = session.onboardingCompleted;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
        (session.user as any).role = (token.role as string) ?? "USER";
        (session.user as any).organizationId = (token.organizationId as string | null) ?? null;
        (session.user as any).onboardingCompleted = token.onboardingCompleted ?? true;
        (session.user as any).accountType = token.accountType ?? null;
        (session.user as any).subscriptionStatus = token.subscriptionStatus ?? null;
      }
      return session;
    },
  },
  providers: [], // Providers added in full auth.ts
} satisfies NextAuthConfig;
