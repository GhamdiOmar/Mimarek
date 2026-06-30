import { describe, it, expect } from "vitest";
import {
  mergePlanAndAddOns,
  buildAddOnGrants,
  resolveEntitlement,
  type OrgEntitlementData,
  type AddOnGrant,
} from "../lib/entitlements/evaluator";
import { FEATURE_KEYS, GRANTABLE_FEATURE_KEYS } from "../lib/entitlements/keys";

// P4 add-ons: precedence is override > add-on > plan > deny. BOOLEAN add-ons
// flip a plan `false` to granted; LIMIT add-ons are ADDITIVE (plan + Σ value×qty)
// by default, or OVERRIDE (replace). These lock the merge math.

const additive = (value: string, quantity = 1): AddOnGrant => ({ type: "LIMIT", value, quantity, limitMode: "ADDITIVE" });
const override = (value: string): AddOnGrant => ({ type: "LIMIT", value, quantity: 1, limitMode: "OVERRIDE" });
const boolAddon = (value: string): AddOnGrant => ({ type: "BOOLEAN", value, quantity: 1, limitMode: "ADDITIVE" });

describe("mergePlanAndAddOns — BOOLEAN", () => {
  it("plan false + add-on true → granted via add-on", () => {
    expect(mergePlanAndAddOns({ type: "BOOLEAN", value: "false" }, [boolAddon("true")])).toEqual({
      type: "BOOLEAN", value: "true", source: "addon",
    });
  });
  it("plan true + no add-on → granted via plan", () => {
    expect(mergePlanAndAddOns({ type: "BOOLEAN", value: "true" }, [])).toEqual({
      type: "BOOLEAN", value: "true", source: "plan",
    });
  });
  it("plan false + add-on false → not granted (plan)", () => {
    expect(mergePlanAndAddOns({ type: "BOOLEAN", value: "false" }, [boolAddon("false")])).toEqual({
      type: "BOOLEAN", value: "false", source: "plan",
    });
  });
  it("no plan + add-on true → granted via add-on (feature absent from plan)", () => {
    expect(mergePlanAndAddOns(undefined, [boolAddon("true")])).toEqual({
      type: "BOOLEAN", value: "true", source: "addon",
    });
  });
});

describe("mergePlanAndAddOns — LIMIT additive", () => {
  it("plan 50 + add-on 10×qty2 → 70 via add-on", () => {
    expect(mergePlanAndAddOns({ type: "LIMIT", value: "50" }, [additive("10", 2)])).toEqual({
      type: "LIMIT", value: "70", source: "addon",
    });
  });
  it("plan 50 + no add-on → 50 via plan", () => {
    expect(mergePlanAndAddOns({ type: "LIMIT", value: "50" }, [])).toEqual({
      type: "LIMIT", value: "50", source: "plan",
    });
  });
  it("multiple additive add-ons stack: 50 + 10 + 5 → 65", () => {
    expect(mergePlanAndAddOns({ type: "LIMIT", value: "50" }, [additive("10"), additive("5")])).toEqual({
      type: "LIMIT", value: "65", source: "addon",
    });
  });
  it("no plan base + additive 10 → 10 via add-on", () => {
    expect(mergePlanAndAddOns(undefined, [additive("10")])).toEqual({
      type: "LIMIT", value: "10", source: "addon",
    });
  });
  it("plan unlimited stays unlimited regardless of add-ons", () => {
    expect(mergePlanAndAddOns({ type: "LIMIT", value: "unlimited" }, [additive("10")])).toEqual({
      type: "LIMIT", value: "unlimited", source: "plan",
    });
  });
  it("additive 'unlimited' add-on lifts a finite plan to unlimited", () => {
    expect(mergePlanAndAddOns({ type: "LIMIT", value: "50" }, [additive("unlimited")])).toEqual({
      type: "LIMIT", value: "unlimited", source: "addon",
    });
  });
});

describe("mergePlanAndAddOns — LIMIT override", () => {
  it("override add-on replaces the plan value", () => {
    expect(mergePlanAndAddOns({ type: "LIMIT", value: "50" }, [override("200")])).toEqual({
      type: "LIMIT", value: "200", source: "addon",
    });
  });
  it("override 'unlimited' wins", () => {
    expect(mergePlanAndAddOns({ type: "LIMIT", value: "50" }, [override("unlimited")])).toEqual({
      type: "LIMIT", value: "unlimited", source: "addon",
    });
  });
});

describe("mergePlanAndAddOns — neither grants", () => {
  it("no plan and no add-on → null (deny)", () => {
    expect(mergePlanAndAddOns(undefined, [])).toBeNull();
  });
});

describe("buildAddOnGrants", () => {
  // `in` checks (not `??`) so an explicit null is preserved, not defaulted.
  const row = (over: Partial<{ quantity: number; grantsFeatureKey: string | null; grantsType: string | null; grantsValue: string | null; limitMode: string; isActive: boolean }>) => ({
    quantity: over.quantity ?? 1,
    addOn: {
      grantsFeatureKey: "grantsFeatureKey" in over ? over.grantsFeatureKey! : "units.max",
      grantsType: "grantsType" in over ? over.grantsType! : "LIMIT",
      grantsValue: "grantsValue" in over ? over.grantsValue! : "10",
      limitMode: over.limitMode ?? "ADDITIVE",
      isActive: over.isActive ?? true,
    },
  });

  it("groups grants by featureKey", () => {
    const map = buildAddOnGrants([row({}), row({ grantsValue: "5" })]);
    expect(map["units.max"]).toHaveLength(2);
  });
  it("skips inactive add-ons", () => {
    expect(buildAddOnGrants([row({ isActive: false })])).toEqual({});
  });
  it("skips add-ons with no grant feature key", () => {
    expect(buildAddOnGrants([row({ grantsFeatureKey: null })])).toEqual({});
  });
  it("clamps quantity to at least 1 and maps OVERRIDE", () => {
    const map = buildAddOnGrants([row({ quantity: 0, limitMode: "OVERRIDE" })]);
    expect(map["units.max"]![0]).toMatchObject({ quantity: 1, limitMode: "OVERRIDE" });
  });
});

describe("GRANTABLE_FEATURE_KEYS — admin add-on grant options", () => {
  it("is a subset of FEATURE_KEYS (can never drift — built from FEATURE_KEYS.*)", () => {
    const all = new Set<string>(Object.values(FEATURE_KEYS));
    for (const k of GRANTABLE_FEATURE_KEYS) expect(all.has(k)).toBe(true);
  });
  it("has no duplicates", () => {
    expect(new Set(GRANTABLE_FEATURE_KEYS).size).toBe(GRANTABLE_FEATURE_KEYS.length);
  });
});

describe("resolveEntitlement — end-to-end with add-ons", () => {
  const base: OrgEntitlementData = {
    planSlug: "starter",
    planEntitlements: {
      "units.max": { type: "LIMIT", value: "50" },
      "marketplace.publish.access": { type: "BOOLEAN", value: "false" },
    },
    overrides: {},
    addOns: {
      "units.max": [additive("10", 2)],
      "marketplace.publish.access": [boolAddon("true")],
    },
    subscriptionStatus: "ACTIVE",
  };

  it("additive add-on raises the limit: 65/70 is still allowed", () => {
    const r = resolveEntitlement(base, "units.max", 65);
    expect(r.granted).toBe(true);
    expect(r.limit).toBe(70);
    expect(r.remaining).toBe(5);
  });

  it("add-on unlocks a plan-disabled boolean feature", () => {
    expect(resolveEntitlement(base, "marketplace.publish.access").granted).toBe(true);
  });

  it("override still beats both plan and add-on", () => {
    const withOverride: OrgEntitlementData = {
      ...base,
      overrides: { "units.max": { type: "LIMIT", value: "5", expiresAt: null } },
    };
    expect(resolveEntitlement(withOverride, "units.max", 10).granted).toBe(false);
  });

  it("no subscription denies everything even with add-ons", () => {
    expect(resolveEntitlement({ ...base, subscriptionStatus: null }, "units.max", 0).granted).toBe(false);
  });
});
