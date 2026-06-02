/**
 * Back-fill analytics v1 — Subscription cohort + MRR denormalisation +
 * SubscriptionEvent categorisation.
 *
 * Run with:
 *   pnpm tsx scripts/backfill-analytics-v1.ts
 *
 * Idempotent — re-running will recompute everything, last write wins.
 *
 * HONEST CAVEAT: Plan.priceMonthly is mutable. For historical price
 * changes the derived mrrDeltaSar reflects CURRENT price, not event-time
 * price. This is acceptable for v1; truth-at-event-time defers until a
 * Plan price-history table exists (out of scope).
 */

import { db } from "@repo/db";
import type { Subscription, SubscriptionEvent, Plan, BillingCycle, SubscriptionStatus } from "@prisma/client";

type EventCat =
  | "NEW"
  | "EXPANSION"
  | "CONTRACTION"
  | "CHURN"
  | "REACTIVATION"
  | "TRIAL_STARTED"
  | "TRIAL_CONVERTED"
  | "REFUND_ADJUSTMENT";

/** Compute monthly recurring revenue (ex-VAT) for a plan + billing cycle, in SAR. */
function computeMrrSar(plan: Plan, cycle: BillingCycle): number {
  const monthly = Number(plan.priceMonthly ?? 0);
  const annual = Number(plan.priceAnnual ?? 0);
  switch (cycle) {
    case "MONTHLY":
      return monthly;
    case "QUARTERLY":
      return monthly; // Quarterly billing, monthly recognition stays at monthly rate
    case "SEMI_ANNUAL":
      return annual > 0 ? annual / 12 : monthly;
    case "ANNUAL":
      return annual > 0 ? annual / 12 : monthly;
    default:
      return monthly;
  }
}

function monthKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Classify a single SubscriptionEvent transition. Returns null when the
 * event represents no ARR change worth tracking (e.g. trial that never
 * paid, manual status corrections).
 */
function classifyEvent(
  fromStatus: SubscriptionStatus | null,
  toStatus: SubscriptionStatus,
  mrrAtEvent: number,
  prevMrr: number,
): { category: EventCat; mrrDeltaSar: number } | null {
  // Trial starts
  if (fromStatus == null && toStatus === "TRIALING") {
    return { category: "TRIAL_STARTED", mrrDeltaSar: 0 };
  }

  // Trial -> Active (first paid conversion)
  if (fromStatus === "TRIALING" && toStatus === "ACTIVE") {
    return { category: "TRIAL_CONVERTED", mrrDeltaSar: mrrAtEvent };
  }

  // Direct NEW signup (no trial)
  if (fromStatus == null && toStatus === "ACTIVE") {
    return { category: "NEW", mrrDeltaSar: mrrAtEvent };
  }

  // Trial -> Canceled (lost without converting)
  if (fromStatus === "TRIALING" && (toStatus === "CANCELED" || toStatus === "UNPAID")) {
    return null;
  }

  // Reactivation
  if ((fromStatus === "CANCELED" || fromStatus === "UNPAID") && toStatus === "ACTIVE") {
    return { category: "REACTIVATION", mrrDeltaSar: mrrAtEvent };
  }

  // Churn
  if (
    (fromStatus === "ACTIVE" || fromStatus === "PAST_DUE" || fromStatus === "PAUSED") &&
    (toStatus === "CANCELED" || toStatus === "UNPAID")
  ) {
    return { category: "CHURN", mrrDeltaSar: -prevMrr };
  }

  // Expansion / Contraction — same status, MRR moved
  if (fromStatus === "ACTIVE" && toStatus === "ACTIVE") {
    const delta = mrrAtEvent - prevMrr;
    if (delta > 0) return { category: "EXPANSION", mrrDeltaSar: delta };
    if (delta < 0) return { category: "CONTRACTION", mrrDeltaSar: delta };
    return null; // no MRR change
  }

  return null;
}

async function main() {
  const startedAt = Date.now();
  console.log("[backfill-analytics-v1] starting");

  const subs = await db.subscription.findMany({
    include: { plan: true, events: { orderBy: { createdAt: "asc" } } },
  });
  console.log(`[backfill-analytics-v1] loaded ${subs.length} subscriptions`);

  let subsUpdated = 0;
  let eventsUpdated = 0;
  let mrrComputedNonZero = 0;

  for (const sub of subs as Array<Subscription & { plan: Plan; events: SubscriptionEvent[] }>) {
    const mrrSar = computeMrrSar(sub.plan, sub.billingCycle);
    if (mrrSar > 0) mrrComputedNonZero++;

    // Cohort months
    const firstTrialing = sub.events.find((e) => e.toStatus === "TRIALING");
    const firstActive = sub.events.find((e) => e.toStatus === "ACTIVE");
    const acquiredMonth = firstTrialing
      ? monthKey(firstTrialing.createdAt)
      : firstActive
        ? monthKey(firstActive.createdAt)
        : monthKey(sub.createdAt);
    const activatedMonth = firstActive ? monthKey(firstActive.createdAt) : null;

    await db.subscription.update({
      where: { id: sub.id },
      data: { mrrSar, acquiredMonth, activatedMonth },
    });
    subsUpdated++;

    // Walk events in chronological order, deriving category + delta
    let prevMrr = 0;
    for (const ev of sub.events) {
      const classified = classifyEvent(ev.fromStatus, ev.toStatus, mrrSar, prevMrr);
      if (!classified) continue;
      await db.subscriptionEvent.update({
        where: { id: ev.id },
        data: {
          eventCategory: classified.category,
          mrrDeltaSar: classified.mrrDeltaSar,
        },
      });
      eventsUpdated++;
      // Track running MRR for the next event
      if (
        classified.category === "NEW" ||
        classified.category === "TRIAL_CONVERTED" ||
        classified.category === "REACTIVATION"
      ) {
        prevMrr = mrrSar;
      } else if (classified.category === "CHURN") {
        prevMrr = 0;
      } else if (classified.category === "EXPANSION" || classified.category === "CONTRACTION") {
        prevMrr += classified.mrrDeltaSar;
      }
    }
  }

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`[backfill-analytics-v1] complete in ${elapsedSec}s`);
  console.log(`  subscriptions updated: ${subsUpdated}`);
  console.log(`  events updated:        ${eventsUpdated}`);
  console.log(`  non-zero mrrSar:       ${mrrComputedNonZero}`);

  await db.$disconnect();
}

main().catch((err) => {
  console.error("[backfill-analytics-v1] FAILED:", err);
  process.exit(1);
});
