import { db } from "@repo/db";
import { Prisma } from "@prisma/client";
import type { BillingCycle, SubscriptionStatus } from "@prisma/client";
import { mrrForCycle } from "./mrr";
import { eventCategoryForDelta } from "./admin-subscription-helpers";
import { newPriceFor } from "./scheduled-plan-change-price";
import { invalidateEntitlements } from "../entitlements";
import { notifyScheduledPlanChange } from "../billing-notifications";

// ─── Scheduled plan-change engine (pricing P5) ───────────────────────────────
//
// A platform admin schedules a future re-price / migration for the cohort of
// subscriptions currently on a source plan. The daily cron applies it AT THE
// CUTOFF by writing the new price into each affected sub's `priceAtRenewal`
// (and `planId` for a migration) — grandfathering is automatic: the current
// period was already paid at the old price, the new price only bites at renewal.
//
// Idempotency: the parent `status` gates re-entry, and each per-sub
// `SubscriptionEvent.idempotencyKey = "<subId>:<changeId>"` (unique) makes a
// re-run after a partial-failure a no-op for already-applied subs.

const COHORT_STATUSES: SubscriptionStatus[] = ["TRIALING", "ACTIVE", "PAST_DUE"];

type ChangeRow = Prisma.ScheduledPlanChangeGetPayload<{ include: { sourcePlan: true; targetPlan: true } }>;

type CohortSub = {
  id: string;
  organizationId: string;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  priceAtRenewal: Prisma.Decimal | null;
  mrrSar: Prisma.Decimal | null;
  planId: string;
};

/** Reprice/migrate one sub atomically + idempotently. Returns false if already applied. */
async function applyChangeToSub(change: ChangeRow, sub: CohortSub): Promise<boolean> {
  const idempotencyKey = `${sub.id}:${change.id}`;
  const currentPrice = Number(sub.priceAtRenewal ?? 0);
  const newPrice = newPriceFor(change, sub.billingCycle, currentPrice);
  const oldMrr = sub.mrrSar != null ? Number(sub.mrrSar) : mrrForCycle(currentPrice, sub.billingCycle);
  const newMrr = mrrForCycle(newPrice, sub.billingCycle);
  const delta = Math.round((newMrr - oldMrr) * 100) / 100;
  const isMigration = change.changeType === "PLAN_MIGRATION" && !!change.targetPlanId;

  try {
    await db.$transaction([
      db.subscription.update({
        where: { id: sub.id },
        data: {
          priceAtRenewal: newPrice,
          mrrSar: newMrr,
          ...(isMigration ? { planId: change.targetPlanId! } : {}),
        },
      }),
      db.subscriptionEvent.create({
        data: {
          subscriptionId: sub.id,
          fromStatus: sub.status,
          toStatus: sub.status,
          triggeredBy: "system:scheduled-plan-change",
          reason: isMigration
            ? `Scheduled migration to ${change.targetPlan?.slug ?? "plan"}`
            : "Scheduled price change",
          eventCategory: eventCategoryForDelta(delta) ?? undefined,
          mrrDeltaSar: delta,
          idempotencyKey,
          metadata: { scheduledChangeId: change.id, newPrice },
        },
      }),
    ]);
    if (isMigration) invalidateEntitlements(sub.organizationId);
    return true;
  } catch (e) {
    // Unique-violation on idempotencyKey → this sub was applied in a prior run.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
    throw e;
  }
}

/** Best-effort announcement to every affected org's admins (never throws). */
async function announce(change: ChangeRow): Promise<void> {
  try {
    const orgs = await db.subscription.findMany({
      where: { planId: change.sourcePlanId, status: { in: COHORT_STATUSES } },
      select: { organizationId: true },
      distinct: ["organizationId"],
    });
    for (const { organizationId } of orgs) {
      await notifyScheduledPlanChange(organizationId, {
        sourcePlanNameEn: change.sourcePlan.nameEn,
        sourcePlanNameAr: change.sourcePlan.nameAr,
        targetPlanNameEn: change.targetPlan?.nameEn ?? null,
        targetPlanNameAr: change.targetPlan?.nameAr ?? null,
        effectiveAt: change.grandfatherUntil ?? change.effectiveAt,
        isMigration: change.changeType === "PLAN_MIGRATION",
      });
    }
  } catch (err) {
    console.error(`[ScheduledPlanChange] announce failed for ${change.id}:`, err);
  }
}

/**
 * Run the announce + apply passes. Called by the daily cron with `now`.
 * Returns counts for the cron response/log.
 */
export async function applyScheduledPlanChanges(now: Date): Promise<{
  announced: number;
  applied: number;
  subsRepriced: number;
}> {
  let announced = 0;
  let applied = 0;
  let subsRepriced = 0;

  // 1) Announce pass — SCHEDULED with a due announceAt (future announcements that
  //    weren't fired at creation).
  const toAnnounce = await db.scheduledPlanChange.findMany({
    where: { status: "SCHEDULED", announceAt: { lte: now } },
    include: { sourcePlan: true, targetPlan: true },
  });
  for (const change of toAnnounce) {
    await announce(change);
    await db.scheduledPlanChange.update({ where: { id: change.id }, data: { status: "ANNOUNCED" } });
    announced++;
  }

  // 2) Apply pass — due (effectiveAt + optional grandfather both passed). APPLYING
  //    is re-entered so a change interrupted mid-loop resumes; the per-sub
  //    idempotencyKey makes the redo a no-op for subs already done.
  const toApply = await db.scheduledPlanChange.findMany({
    where: {
      status: { in: ["SCHEDULED", "ANNOUNCED", "APPLYING"] },
      effectiveAt: { lte: now },
      OR: [{ grandfatherUntil: null }, { grandfatherUntil: { lte: now } }],
    },
    include: { sourcePlan: true, targetPlan: true },
  });
  for (const change of toApply) {
    if (change.status === "SCHEDULED") await announce(change); // null announceAt → announce at apply
    await db.scheduledPlanChange.update({ where: { id: change.id }, data: { status: "APPLYING" } });

    const subs = (await db.subscription.findMany({
      where: { planId: change.sourcePlanId, status: { in: COHORT_STATUSES } },
      select: { id: true, organizationId: true, status: true, billingCycle: true, priceAtRenewal: true, mrrSar: true, planId: true },
    })) as CohortSub[];
    for (const sub of subs) {
      if (await applyChangeToSub(change, sub)) subsRepriced++;
    }

    // Count applied subs by their per-change events (not `subs.length`): a
    // resumed PLAN_MIGRATION re-selects only the remaining cohort, so the event
    // count is the resume-safe true total.
    const totalApplied = await db.subscriptionEvent.count({
      where: { idempotencyKey: { endsWith: `:${change.id}` } },
    });
    await db.scheduledPlanChange.update({
      where: { id: change.id },
      data: { status: "APPLIED", appliedAt: now, affectedCount: totalApplied },
    });
    applied++;
  }

  return { announced, applied, subsRepriced };
}
