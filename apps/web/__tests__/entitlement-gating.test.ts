import { describe, it, expect, vi } from "vitest";
import { makeStubDb, type Row, type StubDb } from "./helpers/prisma-stub";
import { setSession, auth, signIn, signOut, type MockUser } from "./helpers/session-mock";

// ─────────────────────────────────────────────────────────────────────────────
// P1 ENTITLEMENT GATING — runtime regression locks for the per-module
// requireEntitlement / checkLimit guards added to the create server-actions.
//
// Wired like hardening-wave-a.test.ts: a stub db + the REAL entitlement engine
// (lib/entitlements → entitlements/evaluator) running against a seeded
// subscription whose plan carries the entitlement rows. The stub ignores
// `include`, but returns the seeded row verbatim — so seeding the subscription
// with a nested `plan.entitlements` array is exactly what _fetchOrgEntitlements
// reads. `unstable_cache` is stubbed to a passthrough so the cache is a no-op.
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
vi.mock("../lib/pii-crypto", () => ({
  encryptCustomerData: (d: Record<string, unknown>) => ({ ...d, nationalIdHash: "h", phoneHash: "h", emailHash: "h" }),
  decryptCustomerData: (c: Record<string, unknown>) => c,
  decryptCustomerList: (l: Record<string, unknown>[]) => l,
  searchHashCandidates: () => [],
  phoneSearchHashCandidates: () => [],
}));
vi.mock("../lib/pii-masking", () => ({ maskCustomerPii: (c: Record<string, unknown>) => c }));

import { createContractTemplate } from "../app/actions/contract-templates";
import { createCustomer } from "../app/actions/customers";

type Ent = { featureKey: string; type: "BOOLEAN" | "LIMIT"; value: string };

function admin(): Row {
  return { id: "u_admin", role: "ADMIN", organizationId: ORG, name: "U", email: "a@t.test", isActive: true, tokenVersion: 0, password: "x" };
}
function asSession(): MockUser {
  return { id: "u_admin", email: "a@t.test", name: "U", role: "ADMIN", organizationId: ORG };
}
// A subscription row carrying its plan's entitlements inline (the shape
// _fetchOrgEntitlements reads via `include: { plan: { include: { entitlements }}}`).
function subWith(entitlements: Ent[]): Row {
  return {
    id: "sub_1", organizationId: ORG, status: "ACTIVE", billingCycle: "MONTHLY",
    planId: "plan_1", createdAt: new Date(),
    plan: { id: "plan_1", slug: "test", entitlements },
  };
}
function baseSeed(entitlements: Ent[], extra: Partial<Record<string, Row[]>> = {}): Record<string, Row[]> {
  return {
    user: [admin()],
    organization: [{ id: ORG, name: "Org A" }],
    subscription: [subWith(entitlements)],
    entitlementOverride: [],
    subscriptionAddOn: [],
    contractTemplate: [],
    customer: [],
    ...extra,
  };
}
function install(s: Record<string, Row[]>) {
  seed = s;
  dbHolder.stub = makeStubDb(seed) as StubDb;
  setSession(asSession());
}

describe("P1 — BOOLEAN module-flag gates", () => {
  it("denies a create when the flag is false (custom.templates.access)", async () => {
    install(baseSeed([{ featureKey: "custom.templates.access", type: "BOOLEAN", value: "false" }]));
    await expect(
      createContractTemplate({ name: "Lease", type: "LEASE", content: "x" }),
    ).rejects.toThrow(/not available|disabled|plan/i);
  });

  it("allows the create when the flag is true (positive control)", async () => {
    install(baseSeed([{ featureKey: "custom.templates.access", type: "BOOLEAN", value: "true" }]));
    const tpl = await createContractTemplate({ name: "Lease", type: "LEASE", content: "x" });
    expect(tpl).toBeTruthy();
    expect(seed.contractTemplate!.length).toBe(1);
  });

  it("denies when there is NO active subscription", async () => {
    install(baseSeed([], { subscription: [] }));
    await expect(
      createContractTemplate({ name: "Lease", type: "LEASE", content: "x" }),
    ).rejects.toThrow(/subscription|not available|plan/i);
  });
});

describe("P1 — absolute-count limit gates", () => {
  it("denies createCustomer at the customers.max cap", async () => {
    install(baseSeed(
      [
        { featureKey: "crm.access", type: "BOOLEAN", value: "true" },
        { featureKey: "customers.max", type: "LIMIT", value: "1" },
      ],
      { customer: [{ id: "cust_1", organizationId: ORG, name: "Existing", status: "ACTIVE", agentId: null }] },
    ));
    await expect(
      createCustomer({ name: "New", phone: "0551234567" }),
    ).rejects.toThrow(/limit/i);
  });

  it("denies createCustomer when the CRM module flag is false", async () => {
    install(baseSeed([
      { featureKey: "crm.access", type: "BOOLEAN", value: "false" },
      { featureKey: "customers.max", type: "LIMIT", value: "unlimited" },
    ]));
    await expect(
      createCustomer({ name: "New", phone: "0551234567" }),
    ).rejects.toThrow(/not available|disabled|plan/i);
  });
});
