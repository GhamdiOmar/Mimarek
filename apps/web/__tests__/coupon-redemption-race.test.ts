import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeStubDb, type Row } from "./helpers/prisma-stub";
import { setSession, tenantAdmin, auth, signIn, signOut } from "./helpers/session-mock";

// ─────────────────────────────────────────────────────────────────────────────
// QA-SEC-02 — coupon atomic-redemption race lock.
//
// `applyCoupon` increments `coupon.currentUses` with a CONDITIONAL `updateMany`
// whose WHERE enforces the `maxRedemptions` cap atomically:
//
//     updateMany({ where: { id, OR: [{maxRedemptions:null},
//                                    {currentUses:{lt:maxRedemptions}}] },
//                  data:  { currentUses: { increment: 1 } } })
//     if (count !== 1) throw "reached max redemptions"
//
// If two callers both read the cap as "under limit" and both increment, a
// maxRedemptions=1 coupon could be redeemed twice. This test fires N parallel
// applyCoupon calls against a maxRedemptions=1 coupon and asserts EXACTLY ONE
// succeeds — the others must hit the cap and throw, and currentUses must land on
// exactly 1 (never N).
//
// Each concurrent caller uses a DISTINCT org + invoice, so the per-org
// "already redeemed" early-exit can never short-circuit the race — the
// conditional updateMany is the SOLE gate under test (which is the point).
//
// Determinism note: the stub's updateMany evaluates its WHERE and applies the
// increment synchronously (no await inside), so N callers serialise exactly as
// Postgres serialises a `UPDATE ... WHERE currentUses < cap`. The outcome is
// fixed: one winner, N-1 cap rejections.
// ─────────────────────────────────────────────────────────────────────────────

let seed: Record<string, Row[]>;

// `dbHolder.stub` is reassigned per-test; `db` is a STABLE proxy forwarding to
// the live stub. Both live in vi.hoisted so they exist before the hoisted
// vi.mock factory runs (a top-level const would hit the TDZ).
const { dbHolder, dbProxy } = vi.hoisted(() => {
  const dbHolder: { stub: any } = { stub: undefined };
  const dbProxy = new Proxy({} as any, { get: (_t, model) => dbHolder.stub?.[model] });
  return { dbHolder, dbProxy };
});
vi.mock("@repo/db", () => ({ db: dbProxy }));

vi.mock("../auth", () => ({ auth, signIn, signOut, handlers: {} }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {}, unstable_cache: (fn: any) => fn }));
vi.mock("next/headers", () => ({ headers: async () => new Map(), cookies: async () => new Map() }));

import { applyCoupon } from "../app/actions/coupons";

const N = 8;

/** N distinct orgs, each with its own invoice; one shared maxRedemptions=1 coupon. */
function freshSeed(maxRedemptions: number | null) {
  const orgs = Array.from({ length: N }, (_, i) => `org_${i}`);
  return {
    orgs,
    seed: {
      coupon: [
        {
          id: "coup_1",
          code: "ONCE",
          isActive: true,
          type: "PERCENTAGE",
          value: 10,
          currentUses: 0,
          maxRedemptions,
          validFrom: new Date(0),
          validUntil: null,
          minPurchaseAmount: null,
        },
      ] as Row[],
      invoice: orgs.map((org, i) => ({
        id: `inv_${i}`,
        organizationId: org,
        subtotal: 1000,
        vatRate: 0.15,
      })) as Row[],
      couponRedemption: [] as Row[],
    },
  };
}

describe("QA-SEC-02 coupon atomic redemption — concurrent applyCoupon vs maxRedemptions", () => {
  it(`fires ${N} parallel applyCoupon against maxRedemptions=1 → exactly one succeeds`, async () => {
    const { orgs, seed: s } = freshSeed(1);
    seed = s;
    dbHolder.stub = makeStubDb(seed);

    // Each parallel caller is a different org redeeming its own invoice. We swap
    // the session immediately before kicking off each call, then await them all
    // together so their transactions interleave on the shared coupon row.
    const calls = orgs.map((org, i) => {
      setSession(tenantAdmin(org));
      return applyCoupon("coup_1", `inv_${i}`);
    });

    const results = await Promise.allSettled(calls);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(N - 1);

    // The cap held: currentUses landed on exactly 1, and exactly one redemption row exists.
    expect(seed.coupon![0]!.currentUses).toBe(1);
    expect(seed.couponRedemption).toHaveLength(1);

    // Every rejection is the cap message (not an unrelated error).
    for (const r of rejected as PromiseRejectedResult[]) {
      expect(String(r.reason?.message ?? r.reason)).toMatch(/maximum redemptions/i);
    }
  });

  it("allows up to maxRedemptions winners (cap=3 of 8) and rejects the rest", async () => {
    const CAP = 3;
    const { orgs, seed: s } = freshSeed(CAP);
    seed = s;
    dbHolder.stub = makeStubDb(seed);

    const calls = orgs.map((org, i) => {
      setSession(tenantAdmin(org));
      return applyCoupon("coup_1", `inv_${i}`);
    });
    const results = await Promise.allSettled(calls);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(CAP);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(N - CAP);
    expect(seed.coupon![0]!.currentUses).toBe(CAP);
    expect(seed.couponRedemption).toHaveLength(CAP);
  });

  it("unlimited coupon (maxRedemptions=null) lets all N succeed", async () => {
    const { orgs, seed: s } = freshSeed(null);
    seed = s;
    dbHolder.stub = makeStubDb(seed);

    const calls = orgs.map((org, i) => {
      setSession(tenantAdmin(org));
      return applyCoupon("coup_1", `inv_${i}`);
    });
    const results = await Promise.allSettled(calls);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(N);
    expect(seed.coupon![0]!.currentUses).toBe(N);
  });
});
