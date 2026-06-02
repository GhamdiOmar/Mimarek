"use server";

import { requirePermission } from "../../../lib/auth-helpers";
import { db, jsonSafe, type DateRangeParams } from "./_shared";

/**
 * Net New ARR (annualised SAR ex-VAT) over the range, with category
 * breakdown and 12-month sparkline.
 *
 *   netNewArr = SUM(mrrDeltaSar where eventCategory matters) * 12
 *
 * Excludes TRIAL_STARTED (zero MRR impact). Returns null when no
 * categorised events exist in the range.
 */
export async function getNetNewArr(range: DateRangeParams) {
  await requirePermission("billing:admin");

  const events = await db.subscriptionEvent.findMany({
    where: {
      createdAt: { gte: range.from, lte: range.to },
      eventCategory: {
        in: [
          "NEW",
          "EXPANSION",
          "CONTRACTION",
          "CHURN",
          "REACTIVATION",
          "REFUND_ADJUSTMENT",
        ],
      },
    },
    select: { eventCategory: true, mrrDeltaSar: true },
  });

  const breakdown = {
    newSar: 0,
    expansionSar: 0,
    contractionSar: 0,
    churnSar: 0,
    reactivationSar: 0,
    refundAdjSar: 0,
  };
  for (const e of events) {
    const delta = Number(e.mrrDeltaSar ?? 0) * 12; // monthly delta → annualised
    switch (e.eventCategory) {
      case "NEW":
        breakdown.newSar += delta;
        break;
      case "EXPANSION":
        breakdown.expansionSar += delta;
        break;
      case "CONTRACTION":
        breakdown.contractionSar += delta;
        break;
      case "CHURN":
        breakdown.churnSar += delta;
        break;
      case "REACTIVATION":
        breakdown.reactivationSar += delta;
        break;
      case "REFUND_ADJUSTMENT":
        breakdown.refundAdjSar += delta;
        break;
    }
  }

  const valueSar =
    breakdown.newSar +
    breakdown.expansionSar +
    breakdown.contractionSar +
    breakdown.churnSar +
    breakdown.reactivationSar +
    breakdown.refundAdjSar;

  // 12-month sparkline of trailing months' Net New ARR
  const now = new Date();
  const sparkStart = new Date(now.getUTCFullYear(), now.getUTCMonth() - 11, 1);
  const trailingEvents = await db.subscriptionEvent.findMany({
    where: {
      createdAt: { gte: sparkStart },
      eventCategory: { not: null },
    },
    select: { createdAt: true, mrrDeltaSar: true },
  });
  const sparkline = Array.from({ length: 12 }, () => 0);
  for (const e of trailingEvents) {
    const monthsAgo =
      (now.getUTCFullYear() - e.createdAt.getUTCFullYear()) * 12 +
      (now.getUTCMonth() - e.createdAt.getUTCMonth());
    const idx = 11 - monthsAgo;
    if (idx >= 0 && idx < 12) {
      sparkline[idx] = (sparkline[idx] ?? 0) + Number(e.mrrDeltaSar ?? 0) * 12;
    }
  }

  return jsonSafe({
    valueSar,
    breakdown,
    sparkline,
    eventCount: events.length,
  });
}
