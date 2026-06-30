import type { BillingCycle } from "@repo/db";

/**
 * Ex-VAT monthly recurring revenue for a per-cycle price. Mirrors the inline
 * annualisation the admin subscriptions page uses for its MRR summary
 * (MONTHLY÷1, QUARTERLY÷3, SEMI_ANNUAL÷6, ANNUAL÷12). Rounded to halalas.
 */
export function mrrForCycle(price: number, cycle: BillingCycle): number {
  const months = cycle === "ANNUAL" ? 12 : cycle === "SEMI_ANNUAL" ? 6 : cycle === "QUARTERLY" ? 3 : 1;
  return Math.round((price / months) * 100) / 100;
}

/**
 * Total ex-VAT MRR for a subscription INCLUDING its active add-ons, cycle-aware:
 * plan MRR (from `priceAtRenewal`) + Σ add-on MRR (`unitPriceAtPurchase` × quantity).
 * Keeps `Subscription.mrrSar` accurate when add-ons are purchased/canceled, so add-on
 * revenue flows into the MRR snapshots + ARR waterfall. Pure (unit-tested).
 */
export function subscriptionMrrWithAddOns(
  priceAtRenewal: number,
  cycle: BillingCycle,
  addOns: ReadonlyArray<{ unitPriceAtPurchase: number; quantity: number }>,
): number {
  const planMrr = mrrForCycle(priceAtRenewal, cycle);
  const addOnMrr = addOns.reduce(
    (sum, a) => sum + mrrForCycle(a.unitPriceAtPurchase, cycle) * Math.max(0, a.quantity),
    0,
  );
  return Math.round((planMrr + addOnMrr) * 100) / 100;
}
