import { describe, it, expect } from "vitest";
import { newPriceFor } from "../lib/payment/scheduled-plan-change-price";

// P5: the renewal price a scheduled change writes into priceAtRenewal, cycle-aware.
// PRICE_ONLY reads newPriceMonthly/Annual (unchanged if absent for the cycle);
// PLAN_MIGRATION reads the target plan's price.

// newPriceFor only touches change.changeType / .targetPlan / .newPrice*, so a
// minimal structural object cast through unknown is sufficient.
const change = (o: Record<string, unknown>) => o as unknown as Parameters<typeof newPriceFor>[0];

describe("newPriceFor", () => {
  it("PRICE_ONLY MONTHLY → new monthly price", () => {
    expect(newPriceFor(change({ changeType: "PRICE_ONLY", newPriceMonthly: 600, newPriceAnnual: 6000, targetPlan: null }), "MONTHLY", 499)).toBe(600);
  });
  it("PRICE_ONLY ANNUAL → new annual price", () => {
    expect(newPriceFor(change({ changeType: "PRICE_ONLY", newPriceMonthly: 600, newPriceAnnual: 6000, targetPlan: null }), "ANNUAL", 4790)).toBe(6000);
  });
  it("PRICE_ONLY with no value for the cycle → unchanged current price", () => {
    expect(newPriceFor(change({ changeType: "PRICE_ONLY", newPriceMonthly: 600, newPriceAnnual: null, targetPlan: null }), "ANNUAL", 4790)).toBe(4790);
  });
  it("PLAN_MIGRATION MONTHLY → target plan monthly price", () => {
    expect(newPriceFor(change({ changeType: "PLAN_MIGRATION", targetPlan: { priceMonthly: 1499, priceAnnual: 14390 } }), "MONTHLY", 499)).toBe(1499);
  });
  it("PLAN_MIGRATION ANNUAL → target plan annual price", () => {
    expect(newPriceFor(change({ changeType: "PLAN_MIGRATION", targetPlan: { priceMonthly: 1499, priceAnnual: 14390 } }), "ANNUAL", 4790)).toBe(14390);
  });
});
