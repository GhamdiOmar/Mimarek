/**
 * Subscription State Machine
 *
 * Manages subscription status transitions with audit trail.
 *
 * The valid-transition map + state diagram live in ./subscription-transitions
 * (pure module, unit-tested). This file owns DB orchestration, the same-state
 * no-op short-circuit, event logging, and entitlement invalidation.
 *
 * Every transition logs a SubscriptionEvent for audit.
 */

import { db } from "@repo/db";
import type { Prisma, SubscriptionStatus } from "@prisma/client";
import { invalidateEntitlements } from "../entitlements";
import { isValidSubscriptionTransition } from "./subscription-transitions";
import { mrrForCycle } from "./mrr";
import { boundaryMrrEvent, subscriptionMrr } from "./arr-events";

// ─── State Machine ──────────────────────────────────────────────────────────

/**
 * Transition a subscription to a new status.
 * Validates the transition, logs an event, and updates the subscription.
 *
 * @param subscriptionId - The subscription to transition
 * @param toStatus - Target status
 * @param triggeredBy - Who triggered this ("system", "webhook:moyasar", "admin:<userId>", "user:<userId>")
 * @param reason - Optional reason for the transition
 * @param metadata - Optional additional context
 */
export async function transitionSubscription(
  subscriptionId: string,
  toStatus: SubscriptionStatus,
  triggeredBy: string,
  reason?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const subscription = await db.subscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    throw new Error(`Subscription not found: ${subscriptionId}`);
  }

  const fromStatus = subscription.status;

  // Validate transition
  if (fromStatus === toStatus) {
    return; // No-op — already in target state
  }

  if (!isValidSubscriptionTransition(fromStatus, toStatus)) {
    throw new Error(
      `Invalid subscription transition: ${fromStatus} → ${toStatus}`
    );
  }

  // Build update data based on target status
  const updateData: Record<string, unknown> = {
    status: toStatus,
    updatedAt: new Date(),
  };

  switch (toStatus) {
    case "CANCELED":
      updateData.canceledAt = new Date();
      updateData.cancelReason = reason || null;
      break;
    case "PAUSED":
      updateData.pausedAt = new Date();
      break;
    case "ACTIVE":
      // Clear pause/cancel state on reactivation
      updateData.pausedAt = null;
      updateData.canceledAt = null;
      updateData.cancelReason = null;
      break;
  }

  // ARR-waterfall categorisation for ACTIVE-boundary crossings (see boundaryMrrEvent).
  const { eventCategory, mrrDeltaSar } = boundaryMrrEvent(
    fromStatus,
    toStatus,
    subscriptionMrr(subscription),
  );

  // Perform transition + event log atomically
  await db.$transaction([
    db.subscription.update({
      where: { id: subscriptionId },
      data: updateData,
    }),
    db.subscriptionEvent.create({
      data: {
        subscriptionId,
        fromStatus,
        toStatus,
        triggeredBy,
        reason,
        eventCategory,
        mrrDeltaSar,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
    }),
  ]);

  // Invalidate cached entitlements for the org
  invalidateEntitlements(subscription.organizationId);
}

// ─── Trial Management ───────────────────────────────────────────────────────

/**
 * Check and expire trials that have passed their end date.
 * Should be called by a cron job or scheduled task.
 */
export async function expireTrials(): Promise<number> {
  const now = new Date();

  const expiredTrials = await db.subscription.findMany({
    where: {
      status: "TRIALING",
      trialEndsAt: { lte: now },
    },
  });

  let count = 0;
  for (const sub of expiredTrials) {
    try {
      // Check if they have a payment method — if yes, transition to ACTIVE
      const hasPaymentMethod = await db.paymentMethod.count({
        where: { organizationId: sub.organizationId },
      });

      if (hasPaymentMethod > 0) {
        await transitionSubscription(
          sub.id,
          "ACTIVE",
          "system",
          "Trial ended with payment method on file"
        );
      } else {
        await transitionSubscription(
          sub.id,
          "CANCELED",
          "system",
          "Trial expired without payment method"
        );
      }
      count++;
    } catch (error) {
      console.error(`[TrialExpiry] Failed for subscription ${sub.id}:`, error);
    }
  }

  return count;
}

// ─── Dunning Logic ──────────────────────────────────────────────────────────

/**
 * Process dunning for past-due subscriptions.
 * Called by a cron job — retries at 1 day, 3 days, 7 days.
 *
 * After 3 failed retries → transition to UNPAID.
 */
export async function processDunning(): Promise<void> {
  const pastDueSubscriptions = await db.subscription.findMany({
    where: { status: "PAST_DUE" },
    include: {
      events: {
        where: { toStatus: "PAST_DUE" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      organization: {
        include: {
          paymentMethods: { where: { isDefault: true }, take: 1 },
        },
      },
    },
  });

  const now = new Date();

  for (const sub of pastDueSubscriptions) {
    const pastDueEvent = sub.events[0];
    if (!pastDueEvent) continue;

    const daysSincePastDue = Math.floor(
      (now.getTime() - pastDueEvent.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Count dunning attempts
    const dunningAttempts = await db.subscriptionEvent.count({
      where: {
        subscriptionId: sub.id,
        reason: { startsWith: "Dunning retry" },
      },
    });

    // Retry schedule: 1 day, 3 days, 7 days
    const retryDays = [1, 3, 7];
    const shouldRetry = dunningAttempts < 3 && daysSincePastDue >= (retryDays[dunningAttempts] ?? 999);

    if (shouldRetry) {
      // Try to charge saved payment method
      const paymentMethod = sub.organization.paymentMethods[0];
      if (paymentMethod) {
        // Log retry attempt — actual charging happens via server action
        await db.subscriptionEvent.create({
          data: {
            subscriptionId: sub.id,
            fromStatus: "PAST_DUE",
            toStatus: "PAST_DUE",
            triggeredBy: "system",
            reason: `Dunning retry #${dunningAttempts + 1}`,
            metadata: {
              daysSincePastDue,
              paymentMethodId: paymentMethod.id,
            },
          },
        });
      }
    }

    // After 3 retries or 10+ days — transition to UNPAID
    if (dunningAttempts >= 3 || daysSincePastDue >= 10) {
      await transitionSubscription(
        sub.id,
        "UNPAID",
        "system",
        `Dunning exhausted after ${dunningAttempts} retries over ${daysSincePastDue} days`
      );
    }
  }
}

// ─── Subscription Creation ──────────────────────────────────────────────────

/**
 * Create a new subscription for an organization.
 */
export async function createSubscription(params: {
  organizationId: string;
  planId: string;
  billingCycle: "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL";
  startTrial?: boolean;
  trialDays?: number;
}): Promise<string> {
  const { organizationId, planId, billingCycle, startTrial = true, trialDays = 14 } = params;

  const plan = await db.plan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("Plan not found");

  const now = new Date();
  const trialEnd = startTrial
    ? new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000)
    : null;

  // Calculate period end based on billing cycle
  const periodEnd = trialEnd ?? calculatePeriodEnd(now, billingCycle);

  const priceAtRenewal = billingCycle === "ANNUAL" ? plan.priceAnnual : plan.priceMonthly;
  const mrr = mrrForCycle(Number(priceAtRenewal), billingCycle);

  const subscription = await db.subscription.create({
    data: {
      organizationId,
      planId,
      status: startTrial ? "TRIALING" : "ACTIVE",
      billingCycle,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      trialEndsAt: trialEnd,
      nextBillingDate: trialEnd ?? periodEnd,
      priceAtRenewal,
      mrrSar: mrr,
    },
  });

  // Log the creation event. A subscription that starts ACTIVE (no trial) enters
  // the ARR base immediately → book it as NEW (+mrr); a trial books NEW on
  // conversion (TRIALING→ACTIVE) via transitionSubscription instead.
  await db.subscriptionEvent.create({
    data: {
      subscriptionId: subscription.id,
      fromStatus: null,
      toStatus: startTrial ? "TRIALING" : "ACTIVE",
      triggeredBy: "system",
      reason: startTrial
        ? `New ${trialDays}-day trial started for plan: ${plan.slug}`
        : `Subscription created for plan: ${plan.slug}`,
      eventCategory: startTrial ? undefined : "NEW",
      mrrDeltaSar: startTrial ? undefined : mrr,
    },
  });

  return subscription.id;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function calculatePeriodEnd(
  start: Date,
  cycle: "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL"
): Date {
  const end = new Date(start);
  switch (cycle) {
    case "MONTHLY":
      end.setMonth(end.getMonth() + 1);
      break;
    case "QUARTERLY":
      end.setMonth(end.getMonth() + 3);
      break;
    case "SEMI_ANNUAL":
      end.setMonth(end.getMonth() + 6);
      break;
    case "ANNUAL":
      end.setFullYear(end.getFullYear() + 1);
      break;
  }
  return end;
}
