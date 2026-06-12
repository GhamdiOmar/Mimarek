import { describe, it, expect } from "vitest";
import {
  resolveEntitlement,
  evaluateEntitlement,
  type OrgEntitlementData,
} from "./evaluator";

function makeData(overrides: Partial<OrgEntitlementData> = {}): OrgEntitlementData {
  return {
    planSlug: "pro",
    planEntitlements: {},
    overrides: {},
    subscriptionStatus: "ACTIVE",
    ...overrides,
  };
}

describe("resolveEntitlement — dispatch", () => {
  it("denies everything when there is no subscriptionStatus", () => {
    const data = makeData({
      subscriptionStatus: null,
      planSlug: null,
      planEntitlements: { "cmms.access": { type: "BOOLEAN", value: "true" } },
    });
    const result = resolveEntitlement(data, "cmms.access");
    expect(result).toEqual({
      granted: false,
      reason: "No active subscription",
      upgradeRequired: true,
      featureKey: "cmms.access",
    });
  });

  it("override beats plan when the same key exists in both", () => {
    const data = makeData({
      planEntitlements: { "cmms.access": { type: "BOOLEAN", value: "true" } },
      overrides: { "cmms.access": { type: "BOOLEAN", value: "false", expiresAt: null } },
    });
    const result = resolveEntitlement(data, "cmms.access");
    expect(result.granted).toBe(false);
    expect(result.reason).toBe("Feature disabled on current override");
    expect(result.upgradeRequired).toBe(true);
  });

  it("evaluates the plan entitlement when the key is only in the plan", () => {
    const data = makeData({
      planEntitlements: { "reports.export": { type: "BOOLEAN", value: "false" } },
    });
    const result = resolveEntitlement(data, "reports.export");
    expect(result.granted).toBe(false);
    expect(result.reason).toBe("Feature disabled on current plan");
  });

  it("denies with 'Feature not included in current plan' when key is in neither", () => {
    const data = makeData();
    const result = resolveEntitlement(data, "gis.access");
    expect(result).toEqual({
      granted: false,
      reason: "Feature not included in current plan",
      upgradeRequired: true,
      featureKey: "gis.access",
    });
  });

  it("expired override (filtered out by the DB → absent key) falls through to plan", () => {
    // The DB query excludes expired overrides, so an expired override never
    // appears in data.overrides — simulate that absence here.
    const data = makeData({
      planEntitlements: { "api.access": { type: "BOOLEAN", value: "true" } },
      overrides: {}, // expired override already filtered out upstream
    });
    const result = resolveEntitlement(data, "api.access");
    expect(result.granted).toBe(true);
    expect(result.reason).toBeUndefined();
  });
});

describe("evaluateEntitlement — BOOLEAN", () => {
  it("grants when value is 'true'", () => {
    const result = evaluateEntitlement("cmms.access", "BOOLEAN", "true", undefined, "plan");
    expect(result).toEqual({
      granted: true,
      reason: undefined,
      upgradeRequired: false,
      featureKey: "cmms.access",
    });
  });

  it("denies with upgradeRequired when value is 'false'", () => {
    const result = evaluateEntitlement("cmms.access", "BOOLEAN", "false", undefined, "plan");
    expect(result.granted).toBe(false);
    expect(result.upgradeRequired).toBe(true);
    expect(result.reason).toBe("Feature disabled on current plan");
  });
});

describe("evaluateEntitlement — LIMIT", () => {
  it("grants with remaining when usage < limit", () => {
    const result = evaluateEntitlement("units.max", "LIMIT", "5", 3, "plan");
    expect(result).toEqual({
      granted: true,
      limit: 5,
      currentUsage: 3,
      remaining: 2,
      reason: undefined,
      upgradeRequired: false,
      featureKey: "units.max",
    });
  });

  it("denies with 'Limit reached (5/5)' when usage === limit", () => {
    const result = evaluateEntitlement("units.max", "LIMIT", "5", 5, "plan");
    expect(result.granted).toBe(false);
    expect(result.reason).toBe("Limit reached (5/5)");
    expect(result.upgradeRequired).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("denies when usage > limit", () => {
    const result = evaluateEntitlement("units.max", "LIMIT", "5", 7, "plan");
    expect(result.granted).toBe(false);
    expect(result.reason).toBe("Limit reached (7/5)");
    expect(result.remaining).toBe(0);
  });

  it("grants with limit Infinity when value is 'unlimited'", () => {
    const result = evaluateEntitlement("units.max", "LIMIT", "unlimited", 9999, "plan");
    expect(result).toEqual({
      granted: true,
      limit: Infinity,
      currentUsage: 9999,
      featureKey: "units.max",
    });
  });

  it("denies with 'Invalid limit configuration' when value is not a number", () => {
    const result = evaluateEntitlement("units.max", "LIMIT", "abc", 1, "plan");
    expect(result).toEqual({
      granted: false,
      reason: "Invalid limit configuration",
      featureKey: "units.max",
    });
  });

  it("treats undefined currentUsage as 0", () => {
    const result = evaluateEntitlement("units.max", "LIMIT", "5", undefined, "plan");
    expect(result.granted).toBe(true);
    expect(result.currentUsage).toBe(0);
    expect(result.remaining).toBe(5);
  });
});

describe("evaluateEntitlement — METERED and unknown types", () => {
  it("METERED always grants", () => {
    const result = evaluateEntitlement("api.calls", "METERED", "whatever", 123456, "plan");
    expect(result).toEqual({ granted: true, featureKey: "api.calls" });
  });

  it("unknown type denies with 'Unknown entitlement type: X'", () => {
    const result = evaluateEntitlement("x.y", "TIERED", "gold", undefined, "plan");
    expect(result).toEqual({
      granted: false,
      reason: "Unknown entitlement type: TIERED",
      featureKey: "x.y",
    });
  });
});
