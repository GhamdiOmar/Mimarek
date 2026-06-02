"use server";

import { db } from "./_shared";

/**
 * Upsert one SubscriptionMrrSnapshot row per currently-active subscription
 * (plus subs that churned in the target month) for the given month.
 *
 * Called by:
 *   • /api/cron/snapshot-mrr — once on day 1 of each month at 00:05 UTC
 *   • /api/cron/refresh-current-month-snapshot — every 6 hours for the
 *     current month so mid-month dashboards aren't 30-days stale
 *
 * Both invocations are idempotent — the @@unique([subscriptionId,
 * snapshotMonth]) constraint guarantees one row per (sub, month).
 *
 * NOT a user-callable server action — server-side helper called by cron
 * routes only. Kept here so the same logic powers both schedules.
 */
export async function snapshotMrrForMonth(snapshotMonth: string): Promise<{
  snapshotMonth: string;
  written: number;
  activeIncluded: number;
  recentlyChurnedIncluded: number;
}> {
  // Parse "YYYY-MM" -> Date range
  const [yStr, mStr] = snapshotMonth.split("-");
  const y = Number(yStr);
  const m = Number(mStr) - 1; // JS month 0-indexed
  if (
    Number.isNaN(y) ||
    Number.isNaN(m) ||
    m < 0 ||
    m > 11 ||
    y < 2020 ||
    y > 2100
  ) {
    throw new Error(`Invalid snapshotMonth: ${snapshotMonth}`);
  }
  const monthStart = new Date(Date.UTC(y, m, 1));
  const nextMonthStart = new Date(Date.UTC(y, m + 1, 1));

  // Active subscriptions right now
  const active = await db.subscription.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      organizationId: true,
      planId: true,
      mrrSar: true,
      status: true,
    },
  });

  // Subs that churned within this snapshot month — needed for the
  // ARR waterfall churn bucket. Status now CANCELED/UNPAID with a
  // canceledAt inside the month.
  const recentlyChurned = await db.subscription.findMany({
    where: {
      status: { in: ["CANCELED", "UNPAID"] },
      canceledAt: { gte: monthStart, lt: nextMonthStart },
    },
    select: {
      id: true,
      organizationId: true,
      planId: true,
      mrrSar: true,
      status: true,
    },
  });

  const all = [...active, ...recentlyChurned];

  let written = 0;
  for (const sub of all) {
    await db.subscriptionMrrSnapshot.upsert({
      where: {
        subscriptionId_snapshotMonth: {
          subscriptionId: sub.id,
          snapshotMonth,
        },
      },
      update: {
        mrrSar: sub.mrrSar ?? 0,
        status: sub.status,
        planId: sub.planId,
      },
      create: {
        organizationId: sub.organizationId,
        subscriptionId: sub.id,
        snapshotMonth,
        mrrSar: sub.mrrSar ?? 0,
        status: sub.status,
        planId: sub.planId,
      },
    });
    written++;
  }

  return {
    snapshotMonth,
    written,
    activeIncluded: active.length,
    recentlyChurnedIncluded: recentlyChurned.length,
  };
}
