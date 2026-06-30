import type { BillingCycle } from "@prisma/client";

/**
 * The price a subscription should renew at under a scheduled change, cycle-aware.
 * Pure (type-only import) so it is unit-testable in isolation — the apply engine
 * in `scheduled-plan-changes.ts` (which carries db/next imports) delegates here.
 *
 * PRICE_ONLY: read `newPriceMonthly`/`newPriceAnnual` (unchanged if absent for
 * this cycle). PLAN_MIGRATION: read the target plan's price for this cycle.
 */
export function newPriceFor(
  change: {
    changeType: string;
    targetPlan: { priceMonthly: unknown; priceAnnual: unknown } | null;
    newPriceMonthly: unknown;
    newPriceAnnual: unknown;
  },
  billingCycle: BillingCycle,
  currentPrice: number,
): number {
  if (change.changeType === "PLAN_MIGRATION" && change.targetPlan) {
    return Number(billingCycle === "ANNUAL" ? change.targetPlan.priceAnnual : change.targetPlan.priceMonthly);
  }
  const p = billingCycle === "ANNUAL" ? change.newPriceAnnual : change.newPriceMonthly;
  return p != null ? Number(p) : currentPrice;
}
