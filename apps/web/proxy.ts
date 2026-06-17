// ─── Edge proxy (Next.js 16 middleware) — auth delegation + F2 hardening ──────
//
// Next.js 16 renamed `middleware.ts` → `proxy.ts`. This is the repo's single edge
// entry. It (1) redirects the bare root to the Arabic locale, (2) delegates auth
// (login / onboarding / audience / subscription redirects) to the NextAuth
// `authorized` callback, and (3) adds the F2 defense-in-depth layer:
//   - slams the CVE-2025-29927 `x-middleware-subrequest` spoof door, and
//   - returns a TRUE 403 for non-navigation requests (API/fetch/direct hits) when
//     a tenant role lacks the route's permission — instead of the in-shell 200
//     soft-deny only. Top-level HTML navigations still fall through so the page
//     renders the friendly 200 AccessDenied state (preserves UX).
//
// EDGE-SAFETY (hard): imports ONLY next/server, next-auth, ./auth.config,
// ./lib/route-guards, ./lib/permissions. NEVER auth.ts / lib/auth-helpers /
// @repo/db / lib/audit / lib/rate-limit / next/headers (all Node-only).
import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authConfig } from "./auth.config";
import { routeGuardForPath } from "./lib/route-guards";
import { hasPermission, isSystemRole } from "./lib/permissions";
import type { Permission } from "./lib/permissions";

const { auth } = NextAuth(authConfig);

const FORBIDDEN = () => new NextResponse("Forbidden", { status: 403 });

type AuthHandler = (
  req: NextRequest,
) => Promise<NextResponse | Response | undefined | null | void>;

// auth()-wrapped handler: the NextAuth `authorized` callback runs first (applying
// its login/onboarding/audience/subscription redirects); this callback only runs
// for requests `authorized` lets through, and adds the F2 permission-403.
const authHandler = auth((req): NextResponse | void => {
  const role = req.auth?.user?.role as string | undefined;
  // Unauthenticated → authorized already handled the login redirect. System roles:
  // audience separation is owned by authorized's redirects; never 403 them.
  if (!role || isSystemRole(role)) return;

  const guard = routeGuardForPath(req.nextUrl.pathname);
  const required: Permission = guard?.permission ?? "dashboard:read";
  if (hasPermission(role, required)) return;

  // Tenant role lacks the permission. Top-level HTML navigation (or a speculative
  // router PREFETCH of one) → let it through so the page renders the in-shell 200
  // AccessDenied / the authorized redirect runs (soft UX, no console noise; the
  // server-side guards still protect the data either way). Everything else
  // (fetch/XHR/server-action POST/direct curl) → a true 403.
  const isHtmlNavigation =
    req.headers.get("sec-fetch-mode") === "navigate" &&
    (req.headers.get("accept") ?? "").includes("text/html");
  const isPrefetch =
    req.headers.has("next-router-prefetch") ||
    req.headers.has("purpose") ||
    (req.headers.get("sec-purpose") ?? "").includes("prefetch");
  if (isHtmlNavigation || isPrefetch) return;
  return FORBIDDEN();
}) as unknown as AuthHandler;

export async function proxy(
  req: NextRequest,
): Promise<NextResponse | Response | undefined | null | void> {
  // (a) CVE-2025-29927 (GHSA-f82v-jwr5-mffw) defense-in-depth — reject the spoofed
  // internal header unconditionally; no legitimate external request ever sets it.
  if (req.headers.has("x-middleware-subrequest")) {
    return FORBIDDEN();
  }

  // (b) Bare root → default (Arabic) locale — before any auth/403 logic.
  if (req.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/ar", req.url));
  }

  // (c) Delegate dashboard auth + the F2 permission-403 to the auth-wrapped handler.
  return authHandler(req);
}

export const config = {
  matcher: ["/", "/dashboard/:path*"],
};
