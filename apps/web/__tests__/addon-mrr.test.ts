import { describe, it, expect } from "vitest";
import { subscriptionMrrWithAddOns } from "../lib/payment/mrr";

// Add-on revenue → MRR: Subscription.mrrSar = plan MRR (priceAtRenewal÷cycle) +
// Σ add-on MRR (unitPriceAtPurchase÷cycle × quantity). Keeps mrrSar accurate so
// add-on revenue flows into the MRR snapshots + ARR waterfall.

describe("subscriptionMrrWithAddOns", () => {
  it("no add-ons → plan MRR only (cycle-aware)", () => {
    expect(subscriptionMrrWithAddOns(499, "MONTHLY", [])).toBe(499);
    expect(subscriptionMrrWithAddOns(5988, "ANNUAL", [])).toBe(499); // 5988 / 12
  });

  it("MONTHLY plan + flat add-on adds the add-on's monthly price", () => {
    expect(subscriptionMrrWithAddOns(499, "MONTHLY", [{ unitPriceAtPurchase: 99, quantity: 1 }])).toBe(598);
  });

  it("ANNUAL plan + annual-priced add-on — both divided by 12", () => {
    // plan 5988/yr → 499/mo; add-on 990/yr → 82.5/mo; total 581.5
    expect(subscriptionMrrWithAddOns(5988, "ANNUAL", [{ unitPriceAtPurchase: 990, quantity: 1 }])).toBe(581.5);
  });

  it("quantity multiplies the add-on MRR", () => {
    // plan 499 + 3 × 49 = 646
    expect(subscriptionMrrWithAddOns(499, "MONTHLY", [{ unitPriceAtPurchase: 49, quantity: 3 }])).toBe(646);
  });

  it("multiple add-ons stack", () => {
    expect(
      subscriptionMrrWithAddOns(499, "MONTHLY", [
        { unitPriceAtPurchase: 99, quantity: 1 },
        { unitPriceAtPurchase: 49, quantity: 2 },
      ]),
    ).toBe(499 + 99 + 98);
  });

  it("zero/negative quantity contributes nothing", () => {
    expect(subscriptionMrrWithAddOns(499, "MONTHLY", [{ unitPriceAtPurchase: 99, quantity: 0 }])).toBe(499);
  });
});
