"use server";

import { requirePermission } from "../../../lib/auth-helpers";
import { db, jsonSafe, sumDecimal, type DateRangeParams } from "./_shared";

function monthKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * ARR Waterfall — Starting + (New + Expansion + Reactivation
 * − Contraction − Churn − Refund/Adj) = Ending, all in annualised SAR
 * ex-VAT.
 *
 * Endpoints come from SubscriptionMrrSnapshot rows (immune to historical
 * Plan price changes). Deltas come from SubscriptionEvent.mrrDeltaSar.
 *
 * Reconciliation rule: |Starting + ΣDeltas − Ending| ≤ 1 SAR.
 * Drift beyond that signals snapshot lag or back-fill drift; surface in
 * the UI as a banner.
 */
export async function getArrWaterfall(range: DateRangeParams) {
  await requirePermission("billing:admin");

  const startMonth = monthKey(range.from);
  const endMonth = monthKey(range.to);

  const [startingRows, endingRows, events] = await Promise.all([
    db.subscriptionMrrSnapshot.findMany({
      where: { snapshotMonth: startMonth, status: "ACTIVE" },
      select: { mrrSar: true },
    }),
    db.subscriptionMrrSnapshot.findMany({
      where: { snapshotMonth: endMonth, status: "ACTIVE" },
      select: { mrrSar: true },
    }),
    db.subscriptionEvent.findMany({
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
    }),
  ]);

  const startingArr = sumDecimal(startingRows.map((r) => r.mrrSar)) * 12;
  const endingArr = sumDecimal(endingRows.map((r) => r.mrrSar)) * 12;

  const buckets = {
    newArr: 0,
    expansionArr: 0,
    contractionArr: 0,
    churnArr: 0,
    reactivationArr: 0,
    refundAdjArr: 0,
  };
  for (const e of events) {
    const annualised = Number(e.mrrDeltaSar ?? 0) * 12;
    switch (e.eventCategory) {
      case "NEW":
        buckets.newArr += annualised;
        break;
      case "EXPANSION":
        buckets.expansionArr += annualised;
        break;
      case "CONTRACTION":
        buckets.contractionArr += annualised;
        break;
      case "CHURN":
        buckets.churnArr += annualised;
        break;
      case "REACTIVATION":
        buckets.reactivationArr += annualised;
        break;
      case "REFUND_ADJUSTMENT":
        buckets.refundAdjArr += annualised;
        break;
    }
  }

  const sumDeltas =
    buckets.newArr +
    buckets.expansionArr +
    buckets.contractionArr +
    buckets.churnArr +
    buckets.reactivationArr +
    buckets.refundAdjArr;
  const reconciliationDrift = Math.abs(startingArr + sumDeltas - endingArr);

  return jsonSafe({
    startingArr,
    ...buckets,
    endingArr,
    reconciliationDrift,
    startMonth,
    endMonth,
  });
}
