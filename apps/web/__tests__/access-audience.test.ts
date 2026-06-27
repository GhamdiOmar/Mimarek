import { describe, it, expect, beforeEach, vi } from "vitest";
import { setSession, tenantAdmin, auth, signIn, signOut, currentUserRow } from "./helpers/session-mock";

/**
 * §8 ACCESS-MODEL AUDIENCE REJECTION — runtime regression lock.
 *
 * The product's headline B2B invariant: the two user universes (System / Tenant) never share
 * surfaces. The subtle, dangerous part is that `SYSTEM_ADMIN` is seeded with ALL_PERMISSIONS — so
 * a *permission* check NEVER separates the tiers (§8.4). Only the AUDIENCE branch in
 * `requirePermission` does. Before this test that branch was verified only by static
 * permission-array membership, so a regression dropping `isSystemRole`/the audience check would
 * pass every test. This runs the REAL guard against mismatched sessions and asserts it throws.
 *
 * Wired like tenant-isolation.test.ts: mock `../auth` so the real requirePermission runs against a
 * session we set; no DB needed (the guard throws before any query).
 */

// `@repo/db`'s barrel constructs the Prisma client and throws without DATABASE_URL — replace it
// with the real enums + an inert `db` (the guards check session/permissions in memory and never
// query before they throw, so `db` is unused here). Mirrors tenant-isolation.test.ts.
vi.mock("@repo/db", async () => {
  const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
  // getSessionOrThrow re-reads the user for SEC-003 revocation — return the row
  // mirroring the session under test. The guards still throw on audience/permission
  // mismatch (the assertions below), this just lets the DB recheck pass.
  return { ...prisma, db: { user: { findUnique: async () => currentUserRow() } } };
});
vi.mock("../auth", () => ({ auth, signIn, signOut, handlers: {} }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {}, unstable_cache: (fn: unknown) => fn }));
vi.mock("next/headers", () => ({ headers: async () => new Map(), cookies: async () => new Map() }));

import { requirePermission, requireTenantPermission } from "../lib/auth-helpers";

function systemAdmin(): { id: string; email: string; name: string | null; role: string; organizationId: string | null } {
  return { id: "sys_1", email: "system@mimarek.sa", name: "Platform Admin", role: "SYSTEM_ADMIN", organizationId: null };
}

const ORG = "org_test";

beforeEach(() => setSession(null));

describe("§8 audience — a SYSTEM user is rejected from TENANT-scoped actions (despite holding all permissions)", () => {
  // crm:read / payments:read / zatca:config are TENANT_SCOPED. SYSTEM_ADMIN HAS the permission
  // (ALL_PERMISSIONS) — so this only throws if the AUDIENCE branch fires. This is the regression lock.
  for (const perm of ["crm:read", "payments:read", "zatca:config"] as const) {
    it(`requirePermission("${perm}") throws for SYSTEM_ADMIN`, async () => {
      setSession(systemAdmin());
      await expect(requirePermission(perm)).rejects.toThrow(/tenant-scoped|platform users may not/i);
    });
  }

  it("requireTenantPermission rejects a system user (no org context)", async () => {
    setSession(systemAdmin());
    await expect(requireTenantPermission("payments:read")).rejects.toThrow();
  });
});

describe("§8 audience — a TENANT user is rejected from SYSTEM-only actions", () => {
  for (const perm of ["zatca:admin"] as const) {
    it(`requirePermission("${perm}") throws for a tenant ADMIN`, async () => {
      setSession(tenantAdmin(ORG));
      await expect(requirePermission(perm)).rejects.toThrow();
    });
  }
});

describe("§8 audience — positive controls (the matching tier succeeds)", () => {
  it("a tenant ADMIN passes a tenant-scoped permission", async () => {
    setSession(tenantAdmin(ORG));
    const session = await requirePermission("payments:read");
    expect(session.organizationId).toBe(ORG);
  });

  it("a SYSTEM_ADMIN passes a system-only permission", async () => {
    setSession(systemAdmin());
    const session = await requirePermission("zatca:admin");
    expect(session.role).toBe("SYSTEM_ADMIN");
  });
});

describe("§8 — an unauthenticated call is rejected", () => {
  it("requirePermission throws with no session", async () => {
    setSession(null);
    await expect(requirePermission("payments:read")).rejects.toThrow();
  });
});
