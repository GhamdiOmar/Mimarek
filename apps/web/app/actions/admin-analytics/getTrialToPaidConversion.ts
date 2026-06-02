"use server";

import { requirePermission } from "../../../lib/auth-helpers";
import { db, jsonSafe, type DateRangeParams } from "./_shared";

/**
 * Of trials that STARTED in the range, the rate that CONVERTED to paid
 * (regardless of when the conversion happened — could be after `range.to`
 * if the trial was still running at range end).
 *
 * Always returns the raw denominator so a "38%" reading can't be
 * mistaken for a large-sample stat when n=13.
 */
export async function getTrialToPaidConversion(range: DateRangeParams) {
  await requirePermission("billing:admin");

  const trialStarts = await db.subscriptionEvent.findMany({
    where: {
      createdAt: { gte: range.from, lte: range.to },
      eventCategory: "TRIAL_STARTED",
    },
    select: { subscriptionId: true },
  });
  const trialSubIds = Array.from(new Set(trialStarts.map((e) => e.subscriptionId)));

  if (trialSubIds.length === 0) {
    return jsonSafe({ converted: 0, denominator: 0, rate: null });
  }

  const conversions = await db.subscriptionEvent.findMany({
    where: {
      subscriptionId: { in: trialSubIds },
      eventCategory: "TRIAL_CONVERTED",
    },
    select: { subscriptionId: true },
  });
  const convertedIds = new Set(conversions.map((e) => e.subscriptionId));

  return jsonSafe({
    converted: convertedIds.size,
    denominator: trialSubIds.length,
    rate: convertedIds.size / trialSubIds.length,
  });
}
