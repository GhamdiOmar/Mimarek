import type { BillingCycle, Prisma, SubscriptionStatus } from "@repo/db";
import { mrrForCycle } from "./mrr";

/**
 * Pure ARR-waterfall event helpers (no DB / server imports → unit-testable in
 * isolation, like `./subscription-transitions`). `getArrWaterfall` reconciles
 * |starting + Σ mrrDeltaSar − ending| ≤ 1 SAR, where the endpoints count
 * status=ACTIVE subscriptions only. So a STATUS transition moves ARR exactly
 * when it crosses the ACTIVE boundary; a plan/price change WHILE active emits
 * its own EXPANSION/CONTRACTION elsewhere.
 */

/** Ex-VAT MRR for a subscription — its stored snapshot, else derived from its renewal price. */
export function subscriptionMrr(sub: {
  mrrSar: Prisma.Decimal | number | null;
  priceAtRenewal: Prisma.Decimal | number | null;
  billingCycle: BillingCycle;
}): number {
  return sub.mrrSar != null
    ? Number(sub.mrrSar)
    : mrrForCycle(Number(sub.priceAtRenewal ?? 0), sub.billingCycle);
}

/**
 * Derive the ARR-waterfall event for a STATUS transition from whether it crosses
 * the ACTIVE boundary:
 *   leaving ACTIVE   → CHURN        (−mrr)
 *   entering ACTIVE  → NEW (from a trial) | REACTIVATION (otherwise)  (+mrr)
 *   neither          → uncategorised — non-active↔non-active moves no ARR.
 * Crossing-only ⇒ no double-count: e.g. PAST_DUE→CANCELED books nothing (the −mrr
 * was already booked on ACTIVE→PAST_DUE).
 */
export function boundaryMrrEvent(
  fromStatus: SubscriptionStatus,
  toStatus: SubscriptionStatus,
  mrr: number,
): { eventCategory?: string; mrrDeltaSar?: number } {
  const wasActive = fromStatus === "ACTIVE";
  const nowActive = toStatus === "ACTIVE";
  if (wasActive && !nowActive) return { eventCategory: "CHURN", mrrDeltaSar: -mrr };
  if (!wasActive && nowActive)
    return { eventCategory: fromStatus === "TRIALING" ? "NEW" : "REACTIVATION", mrrDeltaSar: mrr };
  return {};
}
