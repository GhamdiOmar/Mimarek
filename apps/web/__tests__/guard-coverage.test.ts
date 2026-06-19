import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import type * as TS from "typescript";

// ─────────────────────────────────────────────────────────────────────────────
// QA-SEC-01 — deterministic guard-coverage gate for "use server" actions.
//
// Every exported `async` function in a `"use server"` file under `app/actions/**`
// is a network-reachable POST RPC: anyone who can reach the app can invoke it
// with attacker-controlled arguments. Each MUST either:
//   (a) contain a call to one of the recognised authorization guard helpers
//       (requirePermission / requireTenantPermission / requireSystem /
//       requireTenant / getTenantSessionOrThrow / getSessionOrThrow /
//       getSessionWithPermissions / getTenantPageAccess), OR
//   (b) be explicitly listed in GUARD_EXEMPT below, with a reason.
//
// This mirrors the `mimaric/require-action-guard` ESLint rule but runs as a
// deterministic test so a NEW unguarded action fails CI even if lint warnings
// are tolerated. The value is the failure when someone adds an unguarded action;
// GUARD_EXEMPT is built from the CURRENT reality so the suite is green today.
//
// Detection is AST-based (TypeScript compiler API) and only inspects each
// exported function's OWN body — guards reached indirectly (via a private helper
// or a nested builder) are intentionally treated as "not found here" and must be
// exempted with a reason, keeping the check simple and the exemptions auditable.
// ─────────────────────────────────────────────────────────────────────────────

const require = createRequire(import.meta.url);
const ts = require("typescript") as typeof TS;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ACTIONS_ROOT = path.join(HERE, "..", "app", "actions");

const GUARD_HELPERS = new Set([
  "requirePermission",
  "requireTenantPermission",
  "requireSystem",
  "requireTenant",
  "getTenantSessionOrThrow",
  "getSessionOrThrow",
  "getSessionWithPermissions",
  "getTenantPageAccess",
]);

/**
 * Allow-list of exported "use server" actions that legitimately do NOT call a
 * recognised guard helper in their own body. Keyed `"<relativePath>#<fnName>"`
 * (path relative to app/actions/, POSIX separators). EVERY entry has an audited
 * reason. To add one, document WHY it is safe to be unguarded (public-by-design,
 * token-bearer, cron-only, or guarded indirectly via a helper this scan can't see).
 */
const GUARD_EXEMPT: Record<string, string> = {
  // ── Public-by-design auth surface (must be reachable pre-login) ────────────
  "auth.ts#loginAction":
    "Public sign-in. Credentials verified inside signIn(); deliberately gated by NextAuth + rate-limit, not a session guard (a session can't exist yet).",
  "auth.ts#registerUser":
    "Public self-service signup — creates the org+user. Protected by password-policy validation + per-IP/per-email rate limiting, not a session guard.",
  "auth.ts#confirmEmailVerificationAction":
    "Public pre-auth email-verification — the single-use SHA-256-hashed token IS the credential (consumed atomically, 24h TTL); activates the account on POST only, so no session can exist yet.",
  "auth.ts#resendVerificationAction":
    "Public pre-auth resend — rate-limited per email + per IP and anti-enumeration (identical generic response in every branch). No session exists before activation.",
  "password.ts#requestPasswordReset":
    "Public 'forgot password' entry point — rate-limited, always returns success to prevent account enumeration. No session exists yet.",
  "password.ts#resetPassword":
    "Public reset completion — the single-use, time-boxed reset token IS the credential (validated before write); no session exists yet.",
  "invitations.ts#acceptInvitation":
    "Public invite acceptance — the single-use invitation token IS the credential (validated + re-checked in-tx); creates the user, so no prior session.",
  "invitations.ts#getInvitationByToken":
    "Public invite-preview for the acceptance page — token-bearer read of name/role/org only; returns {valid:false} for any bad/used/expired token.",

  // ── Public marketing / config reads (rendered on unauthenticated pages) ────
  "billing.ts#getPlans":
    "Public pricing list — thin wrapper over the server-only cached DAL (getPublicPlans). Plans are public marketing data shown on the unauthenticated pricing page.",
  "billing.ts#getPlanBySlug":
    "Public single-plan read by slug — same public pricing data as getPlans; consumed by the unauthenticated checkout/pricing flow.",
  "seo-config.ts#getSeoConfigPublic":
    "Public SEO config read used by root layout.tsx + robots.ts (which run for anonymous visitors). Returns null on any error. The write path (upsertSeoConfig) is billing:admin-gated.",

  // ── Pure/static helpers — read no per-tenant data, mutate nothing ──────────
  "maintenance.ts#getValidTransitions":
    "Pure function over a static VALID_TRANSITIONS map — no DB access, no per-tenant data, no mutation. Exposing the maintenance status state-machine reveals nothing sensitive.",

  // ── Best-effort audit write (fail-open by contract) ────────────────────────
  "consent.ts#recordConsent":
    "PDPL cookie-consent audit write. Append-only, fire-and-forget, fail-open by design; attaches session?.user?.id when present but must work for anonymous banner clicks. Writes only consent metadata.",

  // ── Guarded INDIRECTLY (this scan only inspects the fn's own body) ─────────
  "journey.ts#getJourneySummary":
    "Guarded indirectly — delegates to private buildContractJourney/buildReservationJourney/buildCustomerJourney/buildUnitJourney/buildMaintenanceJourney, each of which calls requirePermission(...) with the correct read scope before any query.",
  "portal.ts#getTenantPortalSummary":
    "Guarded indirectly — calls the private getPortalIdentity(), which runs auth(), enforces role==='USER' (throws Forbidden otherwise), and binds to the tenant's own customer profile + organizationId.",
  "portal.ts#createTenantMaintenanceRequest":
    "Guarded indirectly — calls the private getPortalIdentity() (auth() + role==='USER' check + org binding) before creating a request scoped to the tenant's own active lease/unit.",
  // NOTE: autoExpireReservations was moved to lib/server/reservation-expiry.ts
  // (QA-SEC-01) — it is no longer an exported "use server" action, so it needs
  // no exemption here.
};

interface ActionFn {
  /** "<relativePath>#<fnName>" */
  key: string;
  file: string;
  name: string;
  guarded: boolean;
}

function walk(dir: string): string[] {
  let out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out = out.concat(walk(p));
    else if (entry.isFile() && p.endsWith(".ts") && !p.endsWith(".test.ts")) out.push(p);
  }
  return out;
}

/** True iff the file's first statement is a `"use server"` string directive. */
function firstDirectiveIsUseServer(sf: TS.SourceFile): boolean {
  const first = sf.statements[0];
  if (!first) return false;
  if (ts.isExpressionStatement(first) && ts.isStringLiteralLike(first.expression)) {
    return first.expression.text === "use server";
  }
  return false;
}

/** Walk a node's body for a CallExpression to any guard helper (bare or member). */
function bodyHasGuardCall(node: TS.FunctionLikeDeclarationBase): boolean {
  let found = false;
  const visit = (n: TS.Node): void => {
    if (found) return;
    if (ts.isCallExpression(n)) {
      const callee = n.expression;
      if (ts.isIdentifier(callee) && GUARD_HELPERS.has(callee.text)) {
        found = true;
        return;
      }
      if (
        ts.isPropertyAccessExpression(callee) &&
        ts.isIdentifier(callee.name) &&
        GUARD_HELPERS.has(callee.name.text)
      ) {
        found = true;
        return;
      }
    }
    if (!found) ts.forEachChild(n, visit);
  };
  if (node.body) visit(node.body);
  return found;
}

function isAsync(node: TS.Node): boolean {
  const mods = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return (mods ?? []).some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
}

/** Collect every exported async function in every "use server" action file. */
function collectActionFns(): ActionFn[] {
  const fns: ActionFn[] = [];
  for (const file of walk(ACTIONS_ROOT)) {
    // eslint-disable-next-line no-irregular-whitespace -- intentional: the U+FEFF in this regex strips a leading BOM from each scanned source before ts.createSourceFile parses it
    const src = fs.readFileSync(file, "utf8").replace(/^﻿/, "");
    const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    if (!firstDirectiveIsUseServer(sf)) continue;

    const rel = path.relative(ACTIONS_ROOT, file).split(path.sep).join("/");
    const push = (fnNode: TS.FunctionLikeDeclarationBase, name: string) => {
      if (!isAsync(fnNode)) return;
      fns.push({ key: `${rel}#${name}`, file: rel, name, guarded: bodyHasGuardCall(fnNode) });
    };

    const isExported = (decl: TS.Declaration): boolean =>
      (ts.getCombinedModifierFlags(decl) & ts.ModifierFlags.Export) !== 0;

    for (const stmt of sf.statements) {
      if (ts.isFunctionDeclaration(stmt) && stmt.name && isExported(stmt)) {
        push(stmt, stmt.name.text);
      } else if (ts.isVariableStatement(stmt)) {
        if (!isExported(stmt.declarationList.declarations[0]!)) continue;
        for (const decl of stmt.declarationList.declarations) {
          if (
            decl.initializer &&
            (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer)) &&
            ts.isIdentifier(decl.name)
          ) {
            push(decl.initializer, decl.name.text);
          }
        }
      }
    }
  }
  return fns;
}

describe("QA-SEC-01 guard coverage for app/actions/** \"use server\" actions", () => {
  const fns = collectActionFns();

  it("discovers a non-trivial set of exported server actions", () => {
    // Sanity: if this collapses to ~0 the scanner is broken (e.g. path moved),
    // which would silently make the gate pass for everything.
    expect(fns.length).toBeGreaterThan(100);
  });

  it("every exported server action is guarded or explicitly GUARD_EXEMPT", () => {
    const offenders = fns
      .filter((f) => !f.guarded && !(f.key in GUARD_EXEMPT))
      .map((f) => f.key);

    expect(
      offenders,
      offenders.length
        ? `\nUnguarded exported "use server" action(s) with no GUARD_EXEMPT entry:\n` +
            offenders.map((k) => `  • ${k}`).join("\n") +
            `\n\nEvery exported async fn in a "use server" file is a network-reachable POST RPC.\n` +
            `Add a guard helper call (requirePermission / getSessionOrThrow / …) to the body, or — ` +
            `for a genuinely-public/cron/indirectly-guarded action — add a "${"<file>.ts#<fn>"}" entry ` +
            `to GUARD_EXEMPT in this file with a documented reason (QA-SEC-01).`
        : undefined,
    ).toEqual([]);
  });

  it("GUARD_EXEMPT has no stale entries (every exemption still matches a real unguarded action)", () => {
    const liveUnguarded = new Set(fns.filter((f) => !f.guarded).map((f) => f.key));
    const stale = Object.keys(GUARD_EXEMPT).filter((k) => !liveUnguarded.has(k));

    expect(
      stale,
      stale.length
        ? `\nStale GUARD_EXEMPT entries — these actions are now guarded (or were renamed/removed). ` +
            `Remove them so the exemption list stays honest:\n` +
            stale.map((k) => `  • ${k}`).join("\n")
        : undefined,
    ).toEqual([]);
  });

  it("every GUARD_EXEMPT entry carries a non-trivial reason", () => {
    const thin = Object.entries(GUARD_EXEMPT)
      .filter(([, reason]) => !reason || reason.trim().length < 20)
      .map(([k]) => k);
    expect(thin, `GUARD_EXEMPT entries missing a real reason: ${thin.join(", ")}`).toEqual([]);
  });
});
