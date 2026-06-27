import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeStubDb, type Row, type StubDb } from "./helpers/prisma-stub";
import { setSession, auth, signIn, signOut, type MockUser } from "./helpers/session-mock";

// ─────────────────────────────────────────────────────────────────────────────
// SEC-017 (tenant-dashboard audience gate) + pagination-clamp regression locks.
//
//   SEC-017 — tenant dashboard actions used to guard on
//     requirePermission("dashboard:read"). `dashboard:read` is NOT in
//     TENANT_SCOPED_PERMISSIONS (it is shared — platform staff use it for their
//     own account surface), so requirePermission did NOT reject a system user.
//     The fix swaps every tenant dashboard action to
//     requireTenantPermission("dashboard:read"), which adds the org-context gate
//     (system users have organizationId=null → rejected).
//
//   Pagination clamp — getAuditLogs (and the admin ticket list) now clamp
//     pageSize to Math.min(100, Math.max(1, …)) so a caller can't request an
//     unbounded page.
//
// Wired like hardening-wave-a.test.ts: a stub db that honours the where-clause +
// the REAL guards from lib/auth-helpers running against a session we set.
// ─────────────────────────────────────────────────────────────────────────────

const ORG = "org_a";

let seed: Record<string, Row[]>;

const { dbHolder, dbProxy } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test stub holder
  const dbHolder: { stub: any } = { stub: undefined };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test stub proxy
  const dbProxy = new Proxy({} as any, { get: (_t, model) => dbHolder.stub?.[model] });
  return { dbHolder, dbProxy };
});

vi.mock("@repo/db", async () => {
  const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
  return { ...prisma, db: dbProxy };
});
vi.mock("../auth", () => ({ auth, signIn, signOut, handlers: {} }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- unstable_cache passthrough
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {}, unstable_cache: (fn: any) => fn }));
vi.mock("next/headers", () => ({ headers: async () => new Map(), cookies: async () => new Map() }));

import { getDashboardStats } from "../app/actions/dashboard";
import { getAuditLogs } from "../app/actions/audit";

function user(id: string, over: Partial<Row> = {}): Row {
  return { id, role: "ADMIN", organizationId: ORG, name: "U", email: `${id}@t.test`, isActive: true, tokenVersion: 0, password: "x", ...over };
}
function asSession(id: string, over: Partial<MockUser> = {}): MockUser {
  return { id, email: `${id}@t.test`, name: "U", role: "ADMIN", organizationId: ORG, ...over };
}

function freshSeed(): Record<string, Row[]> {
  return {
    user: [
      user("u_admin"),
      user("u_sys", { role: "SYSTEM_ADMIN", organizationId: null }),
    ],
    // getDashboardStats fans out across these models; empty arrays are fine —
    // the stub's count/groupBy/aggregate just return 0 / [] for an empty model.
    unit: [],
    lease: [],
    rentInstallment: [],
    customer: [],
    maintenanceRequest: [],
    auditLog: Array.from({ length: 150 }, (_, i) => ({
      id: `log_${i}`,
      organizationId: ORG,
      action: "READ",
      resource: "unit",
      resourceId: `r_${i}`,
      userId: "u_admin",
      createdAt: new Date(2026, 0, 1 + i),
    })),
  };
}

// The shared prisma-stub findMany ignores `take`/`skip` (it returns every match)
// and has no groupBy/aggregate. Augment the delegates this suite needs:
//   • auditLog.findMany honours `take` (+ skip) so the clamp is observable on the
//     returned slice — exactly the assertion the spec calls for (seed 150 → ≤100).
//   • the dashboard models get groupBy/aggregate that return empty/zero results
//     so getDashboardStats runs to completion for the positive control.
function makeSeededDb(s: Record<string, Row[]>): StubDb {
  const stub = makeStubDb(s) as StubDb;

  const auditRows = s.auditLog!;
  const baseFindMany = stub.auditLog.findMany;
  stub.auditLog.findMany = async (args: { where?: unknown; skip?: number; take?: number } = {}) => {
    const all = (await baseFindMany(args as never)) as Row[];
    const start = args.skip ?? 0;
    const end = args.take !== undefined ? start + args.take : undefined;
    return all.slice(start, end);
  };
  // keep a reference so an unused-var lint doesn't trip
  void auditRows;

  for (const model of ["unit", "lease", "rentInstallment", "customer", "maintenanceRequest"]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test stub: add missing aggregate ops
    const d = stub[model] as any;
    d.groupBy = async () => [];
    d.aggregate = async () => ({ _sum: { amount: null } });
  }
  return stub;
}

beforeEach(() => {
  seed = freshSeed();
  dbHolder.stub = makeSeededDb(seed);
  setSession(asSession("u_admin"));
});

describe("SEC-017 — tenant dashboard actions reject system users", () => {
  it("rejects a SYSTEM_ADMIN session (organizationId=null) on getDashboardStats", async () => {
    setSession(asSession("u_sys", { role: "SYSTEM_ADMIN", organizationId: null }));
    await expect(getDashboardStats()).rejects.toThrow(/forbidden|organization/i);
  });

  it("allows a tenant ADMIN (positive control)", async () => {
    setSession(asSession("u_admin"));
    const stats = await getDashboardStats();
    expect(stats).toBeTruthy();
    expect(stats.totalUnits).toBe(0);
  });
});

describe("getAuditLogs — clamps an oversized pageSize to 100", () => {
  it("clamps pageSize=9999 → 100 (returned slice ≤ 100, with 150 rows seeded)", async () => {
    const res = await getAuditLogs({ pageSize: 9999 });
    expect(res.pageSize).toBe(100);
    expect(res.logs.length).toBeLessThanOrEqual(100);
    expect(res.logs.length).toBe(100); // 150 seeded, clamped page of 100
    expect(res.total).toBe(150);
  });

  it("clamps a non-positive pageSize up to 1", async () => {
    const res = await getAuditLogs({ pageSize: 0 });
    expect(res.pageSize).toBe(1);
    expect(res.logs.length).toBe(1);
  });

  it("passes a normal pageSize through unchanged (positive control)", async () => {
    const res = await getAuditLogs({ pageSize: 25 });
    expect(res.pageSize).toBe(25);
    expect(res.logs.length).toBe(25);
  });
});
