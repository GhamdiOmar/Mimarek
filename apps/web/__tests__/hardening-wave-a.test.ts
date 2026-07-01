import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeStubDb, type Row, type StubDb } from "./helpers/prisma-stub";
import { setSession, auth, signIn, signOut, type MockUser } from "./helpers/session-mock";

// ─────────────────────────────────────────────────────────────────────────────
// HARDENING WAVE A — runtime regression locks for the High/Critical fixes:
//   SEC-001 team mass-assignment · SEC-005 customer mass-assignment ·
//   SEC-004 customers:read · SEC-011 cross-org agentId · SEC-007 hidden plans ·
//   SEC-008 coupon re-validation · SEC-003 stale-JWT revocation.
//
// Wired like tenant-isolation.test.ts: a stub db that honours the where-clause +
// the REAL guards from lib/auth-helpers running against a session we set.
// ─────────────────────────────────────────────────────────────────────────────

const ORG = "org_a";
const OTHER = "org_b";

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
// PII crypto + masking are exercised by their own suites — stub here so customer
// reads/writes don't need real keys (and so update/create don't depend on env).
vi.mock("../lib/pii-crypto", () => ({
  encryptCustomerData: (d: Record<string, unknown>) => ({ ...d, nationalIdHash: "h", phoneHash: "h", emailHash: "h" }),
  decryptCustomerData: (c: Record<string, unknown>) => c,
  decryptCustomerList: (l: Record<string, unknown>[]) => l,
  searchHashCandidates: () => [],
  phoneSearchHashCandidates: () => [],
}));
vi.mock("../lib/pii-masking", () => ({ maskCustomerPii: (c: Record<string, unknown>) => c }));

import { getSessionOrThrow } from "../lib/auth-helpers";
import { updateTeamMember } from "../app/actions/team";
import { updateCustomer, createCustomer, getCustomer, getCustomers } from "../app/actions/customers";
import { getPlanBySlug, changePlan } from "../app/actions/billing";
import { applyCoupon, applyCouponByCode } from "../app/actions/coupons";
import { signOutEverywhere } from "../app/actions/sessions";
import { updateOrganization } from "../app/actions/organization";
import { updateContractTemplate } from "../app/actions/contract-templates";
import { upsertSeoConfig } from "../app/actions/seo-config";

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
      user("u_target", { name: "Target" }),
      user("u_tech", { role: "TECHNICIAN" }),
      user("u_foreign", { organizationId: OTHER }),
      user("u_sys", { role: "SYSTEM_ADMIN", organizationId: null }),
    ],
    organization: [{ id: ORG, name: "Org A", appStatus: "ACTIVE" }],
    contractTemplate: [{ id: "tpl_1", organizationId: ORG, name: "Lease", content: "body", version: 1 }],
    systemConfig: [{ id: "system", siteTitle: "Old", marketplaceConveyanceEnabled: false, marketplaceLegalSignoffBy: null }],
    customer: [{ id: "cust_1", organizationId: ORG, name: "Acme", status: "ACTIVE", agentId: null }],
    plan: [
      { id: "plan_pub", slug: "pro", isPublic: true, priceMonthly: 100, priceAnnual: 1000 },
      { id: "plan_hidden", slug: "secret", isPublic: false, priceMonthly: 50, priceAnnual: 500 },
    ],
    subscription: [{ id: "sub_1", organizationId: ORG, status: "ACTIVE", billingCycle: "MONTHLY", planId: "plan_pub" }],
    coupon: [
      { id: "c_inactive", code: "OFF", isActive: false, type: "PERCENTAGE", value: 10, currentUses: 0, maxRedemptions: null, validFrom: new Date(0), validUntil: null, minPurchaseAmount: null, plans: [] },
      { id: "c_expired", code: "OLD", isActive: true, type: "PERCENTAGE", value: 10, currentUses: 0, maxRedemptions: null, validFrom: new Date(0), validUntil: new Date(1), minPurchaseAmount: null, plans: [] },
      { id: "c_wrongplan", code: "X", isActive: true, type: "PERCENTAGE", value: 10, currentUses: 0, maxRedemptions: null, validFrom: new Date(0), validUntil: null, minPurchaseAmount: null, plans: [{ id: "plan_other" }] },
      { id: "c_valid", code: "SAVE", isActive: true, type: "PERCENTAGE", value: 10, currentUses: 0, maxRedemptions: null, validFrom: new Date(0), validUntil: null, minPurchaseAmount: null, plans: [] },
      { id: "c_frac", code: "FLAT", isActive: true, type: "FIXED_AMOUNT", value: 333.33, currentUses: 0, maxRedemptions: null, validFrom: new Date(0), validUntil: null, minPurchaseAmount: null, plans: [] },
    ],
    invoice: [{ id: "inv_1", organizationId: ORG, status: "ISSUED", couponId: null, subtotal: 1000, vatRate: 0.15, billingCycle: "MONTHLY", subscription: { planId: "plan_pub", billingCycle: "MONTHLY" } }],
    couponRedemption: [],
  };
}

beforeEach(() => {
  seed = freshSeed();
  dbHolder.stub = makeStubDb(seed) as StubDb;
  setSession(asSession("u_admin"));
});

describe("SEC-001 — updateTeamMember rejects mass-assignment", () => {
  it("strips a smuggled organizationId — the target is NOT moved cross-org", async () => {
    await updateTeamMember("u_target", { name: "Renamed", organizationId: OTHER } as never);
    expect(seed.user!.find((u) => u.id === "u_target")!.organizationId).toBe(ORG);
    expect(seed.user!.find((u) => u.id === "u_target")!.name).toBe("Renamed");
  });
  it("strips a smuggled password / emailVerified", async () => {
    await updateTeamMember("u_target", { name: "R", password: "pwned", emailVerified: new Date() } as never);
    expect(seed.user!.find((u) => u.id === "u_target")!.password).toBe("x");
  });
  it("rejects a target in another org (org-scoped updateMany)", async () => {
    await expect(updateTeamMember("u_foreign", { name: "Z" })).rejects.toThrow(/not found|organization/i);
  });
});

describe("SEC-005 / SEC-011 — updateCustomer allowlist + agentId org-check", () => {
  it("strips a smuggled organizationId on update", async () => {
    await updateCustomer("cust_1", { name: "New", organizationId: OTHER } as never);
    expect(seed.customer![0]!.organizationId).toBe(ORG);
    expect(seed.customer![0]!.name).toBe("New");
  });
  it("rejects a cross-org agentId on update (SEC-011)", async () => {
    await expect(updateCustomer("cust_1", { agentId: "u_foreign" })).rejects.toThrow(/not part of your organization/i);
  });
  it("rejects a cross-org agentId on create (SEC-011)", async () => {
    await expect(
      createCustomer({ name: "C", phone: "0551234567", agentId: "u_foreign" }),
    ).rejects.toThrow(/not part of your organization/i);
  });
});

describe("SEC-004 — customer reads require customers:read", () => {
  it("getCustomer throws for a role without customers:read (TECHNICIAN)", async () => {
    setSession(asSession("u_tech", { role: "TECHNICIAN" }));
    await expect(getCustomer("cust_1")).rejects.toThrow(/forbidden|permission/i);
  });
  it("getCustomers throws for a role without customers:read (TECHNICIAN)", async () => {
    setSession(asSession("u_tech", { role: "TECHNICIAN" }));
    await expect(getCustomers()).rejects.toThrow(/forbidden|permission/i);
  });
  it("getCustomer succeeds for an ADMIN (positive control)", async () => {
    const c = await getCustomer("cust_1");
    expect(c).not.toBeNull();
  });
});

describe("SEC-007 — hidden (non-public) plans are not selectable", () => {
  it("getPlanBySlug returns null for a hidden plan", async () => {
    expect(await getPlanBySlug("secret")).toBeNull();
  });
  it("getPlanBySlug returns a public plan (positive control)", async () => {
    expect(await getPlanBySlug("pro")).not.toBeNull();
  });
  it("changePlan rejects switching to a hidden plan", async () => {
    await expect(changePlan({ newPlanId: "plan_hidden" })).rejects.toThrow(/not found|not available/i);
  });
});

describe("SEC-008 — applyCoupon re-validates at apply time", () => {
  it("rejects an inactive coupon", async () => {
    await expect(applyCoupon("c_inactive", "inv_1")).rejects.toThrow(/no longer active/i);
  });
  it("rejects an expired coupon", async () => {
    await expect(applyCoupon("c_expired", "inv_1")).rejects.toThrow(/expired/i);
  });
  it("rejects a coupon restricted to a different plan", async () => {
    await expect(applyCoupon("c_wrongplan", "inv_1")).rejects.toThrow(/not valid for the selected plan/i);
  });
});

// ─── Billing-UI wiring — server-side guards behind the new tenant controls ────
// The invoices page gates these in the UI; these lock the SERVER enforcement that
// a direct RPC can't bypass (adversarial H-1/M-1/M-2 + the applyCouponByCode codes).
describe("Billing UI — applyCoupon server guards", () => {
  it("H-1: rejects a SECOND/different coupon on an already-couponed invoice", async () => {
    seed.invoice!.find((i) => i.id === "inv_1")!.couponId = "c_other";
    await expect(applyCoupon("c_valid", "inv_1")).rejects.toThrow(/already been applied to this invoice/i);
  });
  it("M-1: rejects applying a coupon to a settled (PAID) invoice", async () => {
    seed.invoice!.find((i) => i.id === "inv_1")!.status = "PAID";
    await expect(applyCoupon("c_valid", "inv_1")).rejects.toThrow(/can no longer be discounted/i);
  });
  it("M-1: rejects a PARTIALLY_PAID invoice too (allowlist, not blocklist)", async () => {
    seed.invoice!.find((i) => i.id === "inv_1")!.status = "PARTIALLY_PAID";
    await expect(applyCoupon("c_valid", "inv_1")).rejects.toThrow(/can no longer be discounted/i);
  });
  it("M-2: writes round-2 vatAmount + total after a fractional discount", async () => {
    // subtotal 1000, FIXED 333.33 → newSubtotal 666.67, vat 100.0005 → 100.00, total 766.67
    const res = await applyCoupon("c_frac", "inv_1");
    const inv = seed.invoice!.find((i) => i.id === "inv_1")!;
    expect(inv.discountAmount).toBe(333.33);
    expect(inv.vatAmount).toBe(100); // round2(100.0005) — NOT 100.0005
    expect(inv.total).toBe(766.67);
    expect(res.newTotal).toBe(766.67);
  });
  it("positive control: a valid coupon applies to an open, uncouponed invoice", async () => {
    const res = await applyCoupon("c_valid", "inv_1");
    expect(res.discountAmount).toBe(100); // 10% of 1000
    expect(seed.invoice!.find((i) => i.id === "inv_1")!.couponId).toBe("c_valid");
  });
});

describe("Billing UI — applyCouponByCode returns stable reason codes (no thrown message)", () => {
  it("INVALID for an unknown code", async () => {
    expect(await applyCouponByCode("NOPE", "inv_1")).toEqual({ ok: false, reason: "INVALID" });
  });
  it("INVALID for an empty/whitespace code", async () => {
    expect(await applyCouponByCode("   ", "inv_1")).toEqual({ ok: false, reason: "INVALID" });
  });
  it("ALREADY_COUPONED maps through from the typed CouponError", async () => {
    seed.invoice!.find((i) => i.id === "inv_1")!.couponId = "c_other";
    expect(await applyCouponByCode("SAVE", "inv_1")).toEqual({ ok: false, reason: "ALREADY_COUPONED" });
  });
  it("INACTIVE maps through (code path, not message regex)", async () => {
    expect(await applyCouponByCode("OFF", "inv_1")).toEqual({ ok: false, reason: "INACTIVE" });
  });
  it("ok:true on a valid apply-by-code", async () => {
    const res = await applyCouponByCode("SAVE", "inv_1");
    expect(res).toMatchObject({ ok: true, discountAmount: 100 });
  });
});

describe("SEC-003 — stale-JWT / deactivation revocation in getSessionOrThrow", () => {
  it("rejects a session whose tokenVersion is behind the DB (revoked)", async () => {
    seed.user!.find((u) => u.id === "u_admin")!.tokenVersion = 5;
    setSession(asSession("u_admin", { tokenVersion: 4 }));
    await expect(getSessionOrThrow()).rejects.toThrow(/unauthorized/i);
  });
  it("rejects a deactivated user (isActive=false)", async () => {
    seed.user!.find((u) => u.id === "u_admin")!.isActive = false;
    setSession(asSession("u_admin"));
    await expect(getSessionOrThrow()).rejects.toThrow(/unauthorized/i);
  });
  it("rejects a deleted user (row gone)", async () => {
    // Mutate the array in place — the stub delegate holds this same reference.
    seed.user!.splice(seed.user!.findIndex((u) => u.id === "u_admin"), 1);
    setSession(asSession("u_admin"));
    await expect(getSessionOrThrow()).rejects.toThrow(/unauthorized/i);
  });
  it("returns the FRESH role from the DB (demotion takes effect immediately)", async () => {
    seed.user!.find((u) => u.id === "u_admin")!.role = "AGENT";
    setSession(asSession("u_admin", { role: "ADMIN" })); // stale JWT still says ADMIN
    const s = await getSessionOrThrow();
    expect(s.role).toBe("AGENT");
  });
  it("passes when tokenVersion matches and the user is active (positive control)", async () => {
    const s = await getSessionOrThrow();
    expect(s.userId).toBe("u_admin");
    expect(s.organizationId).toBe(ORG);
  });
});

describe("SEC-003 — signOutEverywhere revokes all sessions", () => {
  it("increments the acting user's tokenVersion (invalidates outstanding JWTs)", async () => {
    expect(seed.user!.find((u) => u.id === "u_admin")!.tokenVersion).toBe(0);
    await signOutEverywhere();
    expect(seed.user!.find((u) => u.id === "u_admin")!.tokenVersion).toBe(1);
  });
});

// ─── QA-gate sibling mass-assignment fixes (folded into Wave A) ───────────────
describe("QA H1 — updateOrganization rejects mass-assignment", () => {
  it("strips a non-allowlisted column (appStatus is not written)", async () => {
    await updateOrganization({ name: "Renamed", appStatus: "EXPIRED" } as never);
    const org = seed.organization!.find((o) => o.id === ORG)!;
    expect(org.name).toBe("Renamed");
    expect(org.appStatus).toBe("ACTIVE");
  });
});

describe("QA H2 — updateContractTemplate rejects mass-assignment", () => {
  it("strips smuggled organizationId / version", async () => {
    await updateContractTemplate("tpl_1", { name: "New", organizationId: OTHER, version: 99 } as never);
    const tpl = seed.contractTemplate!.find((t) => t.id === "tpl_1")!;
    expect(tpl.name).toBe("New");
    expect(tpl.organizationId).toBe(ORG);
    expect(tpl.version).toBe(1);
  });
});

describe("QA M1 — upsertSeoConfig cannot touch non-SEO columns", () => {
  it("strips the marketplace kill-switch + legal sign-off keys", async () => {
    setSession(asSession("u_sys", { role: "SYSTEM_ADMIN", organizationId: null }));
    await upsertSeoConfig({
      siteTitle: "New SEO",
      marketplaceConveyanceEnabled: "true",
      marketplaceLegalSignoffBy: "evil",
    } as never);
    const cfg = seed.systemConfig!.find((c) => c.id === "system")!;
    expect(cfg.siteTitle).toBe("New SEO");
    expect(cfg.marketplaceConveyanceEnabled).toBe(false);
    expect(cfg.marketplaceLegalSignoffBy).toBeNull();
  });
});
