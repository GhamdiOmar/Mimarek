import type { BillingCycle } from "@repo/db";

/**
 * Ex-VAT monthly recurring revenue for a per-cycle price. Mirrors the inline
 * annualization the admin subscriptions page uses for its MRR summary
 * (MONTHLY÷1, QUARTERLY÷3, SEMI_ANNUAL÷6, ANNUAL÷12). Rounded to halalas.
 */
export function mrrForCycle(price: number, cycle: BillingCycle): number {
  const months = cycle === "ANNUAL" ? 12 : cycle === "SEMI_ANNUAL" ? 6 : cycle === "QUARTERLY" ? 3 : 1;
  return Math.round((price / months) * 100) / 100;
}
