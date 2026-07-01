import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeStubDb, type Row, type StubDb } from "./helpers/prisma-stub";
import { setSession, tenantAdmin, auth, signIn, signOut } from "./helpers/session-mock";

// ─────────────────────────────────────────────────────────────────────────────
// §8 TENANT ORG-ISOLATION — runtime regression lock.
//
// Mimarek is multi-tenant. Every tenant server action MUST scope its DB access
// by `session.organizationId` so org A can never read/mutate org B's rows
// (CLAUDE.md §8). This test runs a representative high-risk set of REAL tenant
// actions with a session whose organizationId differs from the seeded row's
// org, and asserts the action refuses (throws / returns null / NOT_FOUND).
//
// HOW it's wired (so it needs no DB and runs in plain `vitest run`):
//   • `@repo/db` is replaced with an in-memory stub whose findFirst/findMany/
//     delete/update honour `where.organizationId` — exactly the predicate the
//     production action threads in. An action that DROPPED the org filter would
//     find the foreign row and the assertion would flip → that's the regression
//     we're locking.
//   • `apps/web/auth.ts` is replaced so the REAL requirePermission/audience
//     guards run against a session we set per-test.
//   • next/cache + next/headers are stubbed (revalidatePath / headers are no-ops
//     outside a request scope).
// ─────────────────────────────────────────────────────────────────────────────

// Two orgs. The session is bound to ORG_A; every seeded record belongs to ORG_B.
const ORG_A = "org_aaaa";
const ORG_B = "org_bbbb";

// Shared mutable seed — reset in beforeEach.
let seed: Record<string, Row[]>;

// `dbHolder.stub` is reassigned each test; `db` is a STABLE proxy forwarding to
// the live stub. Both live in a vi.hoisted block so they exist before the
// hoisted vi.mock factory runs (avoids the TDZ that a top-level const hits).
const { dbHolder, dbProxy } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test stub: holder boxes the per-test stub db (reassigned each test)
  const dbHolder: { stub: any } = { stub: undefined };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test stub: Proxy forwards arbitrary model keys to the live stub
  const dbProxy = new Proxy({} as any, { get: (_t, model) => dbHolder.stub?.[model] });
  return { dbHolder, dbProxy };
});
// Provide the REAL Prisma enums (UnitStatus, CustomerStatus, …) so module-load
// enum reads work — `units.ts` runs `Object.values(UnitStatus)` at import time, so
// a hand-stubbed/partial enum makes the action crash on load. We pull the enums
// from `@prisma/client` (pure generated value objects) instead of spreading the
// `@repo/db` barrel, because that barrel constructs the Prisma client and THROWS
// without `DATABASE_URL` (unset in the test env). `db` itself is the in-memory stub.
vi.mock("@repo/db", async () => {
  const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
  return { ...prisma, db: dbProxy };
});

vi.mock("../auth", () => ({ auth, signIn, signOut, handlers: {} }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test stub: unstable_cache mock passes through any wrapped fn
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {}, unstable_cache: (fn: any) => fn }));
vi.mock("next/headers", () => ({ headers: async () => new Map(), cookies: async () => new Map() }));

// Import the REAL actions AFTER the mocks above are registered.
import { getCustomer, updateCustomer, deleteCustomer, updateCustomerStatus } from "../app/actions/customers";
import { updateUnit, deleteUnit, massUpdateUnits } from "../app/actions/units";
import { applyCoupon } from "../app/actions/coupons";

function freshSeed(): Record<string, Row[]> {
  return {
    // Every row belongs to ORG_B — the session will be ORG_A.
    customer: [{ id: "cust_1", organizationId: ORG_B, name: "enc", status: "ACTIVE" }],
    unit: [{ id: "unit_1", organizationId: ORG_B, number: "101", status: "AVAILABLE", price: 100 }],
    coupon: [{ id: "coup_1", code: "SAVE", isActive: true, type: "PERCENTAGE", value: 10, currentUses: 0, maxRedemptions: null, validFrom: new Date(0), validUntil: null, minPurchaseAmount: null, plans: [] }],
    invoice: [{ id: "inv_1", organizationId: ORG_B, status: "ISSUED", couponId: null, subtotal: 1000, vatRate: 0.15 }],
    couponRedemption: [],
    reservation: [],
    customerPropertyInterest: [],
    // SEC-003: getSessionOrThrow re-reads the acting user. Seed both org admins so
    // the revocation check (isActive + tokenVersion) passes for whichever session is set.
    user: [
      { id: "user_org_aaaa", role: "ADMIN", organizationId: ORG_A, name: "Test Admin", isActive: true, tokenVersion: 0 },
      { id: "user_org_bbbb", role: "ADMIN", organizationId: ORG_B, name: "Test Admin", isActive: true, tokenVersion: 0 },
    ],
  };
}

beforeEach(() => {
  seed = freshSeed();
  dbHolder.stub = makeStubDb(seed) as StubDb;
  setSession(tenantAdmin(ORG_A)); // bound to ORG_A — a foreigner to every seeded row
});

describe("§8 tenant org-isolation — foreign-org session cannot reach another org's rows", () => {
  it("getCustomer returns null for a customer in another org (no leak)", async () => {
    await expect(getCustomer("cust_1")).resolves.toBeNull();
  });

  it("updateCustomer throws for a customer in another org", async () => {
    await expect(updateCustomer("cust_1", { name: "hacked" })).rejects.toThrow(/not found|don't have access/i);
  });

  it("updateCustomerStatus throws for a customer in another org", async () => {
    await expect(updateCustomerStatus("cust_1", "LOST")).rejects.toThrow(/not found|don't have access/i);
  });

  it("deleteCustomer throws (P2025) for a customer in another org", async () => {
    await expect(deleteCustomer("cust_1")).rejects.toThrow();
    // And the foreign row is still present — nothing was deleted.
    expect(seed.customer).toHaveLength(1);
  });

  it("updateUnit throws for a unit in another org", async () => {
    await expect(updateUnit("unit_1", { price: 1 })).rejects.toThrow(/not found|don't have access/i);
    expect(seed.unit![0]!.price).toBe(100); // unchanged
  });

  it("deleteUnit throws for a unit in another org and leaves it intact", async () => {
    await expect(deleteUnit("unit_1")).rejects.toThrow(/not found|don't have access/i);
    expect(seed.unit).toHaveLength(1);
  });

  it("massUpdateUnits throws when any unit is in another org", async () => {
    await expect(massUpdateUnits([{ id: "unit_1", price: 999 }])).rejects.toThrow(/do not belong|organization/i);
    expect(seed.unit![0]!.price).toBe(100);
  });

  it("applyCoupon throws when the invoice is in another org (cannot redeem against a foreign invoice)", async () => {
    await expect(applyCoupon("coup_1", "inv_1")).rejects.toThrow(/not found|don't have access/i);
    // No redemption recorded, coupon not incremented.
    expect(seed.couponRedemption).toHaveLength(0);
    expect(seed.coupon![0]!.currentUses).toBe(0);
  });

  // Positive control: the SAME actions succeed when the session is bound to the
  // owning org — proving the isolation failures above are caused by the org
  // mismatch, not by the action being broken / the stub rejecting everything.
  describe("positive control — same actions succeed for the OWNING org", () => {
    beforeEach(() => setSession(tenantAdmin(ORG_B)));

    it("getCustomer returns the record for the owning org", async () => {
      const c = await getCustomer("cust_1");
      expect(c).not.toBeNull();
      expect(c.id).toBe("cust_1");
    });

    it("deleteUnit succeeds for the owning org", async () => {
      await expect(deleteUnit("unit_1")).resolves.toBeUndefined();
      expect(seed.unit).toHaveLength(0);
    });

    it("applyCoupon succeeds against an invoice in the owning org", async () => {
      const res = await applyCoupon("coup_1", "inv_1");
      expect(res.discountAmount).toBeGreaterThan(0);
      expect(seed.couponRedemption).toHaveLength(1);
    });
  });
});
