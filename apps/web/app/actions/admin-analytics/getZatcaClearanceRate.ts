"use server";

import { requirePermission } from "../../../lib/auth-helpers";
import { db, jsonSafe, type DateRangeParams } from "./_shared";

const SPIKE_MULTIPLIER = 2;

/**
 * Percentage of invoices issued in the range that successfully cleared
 * with ZATCA. Surfaces a spike alert when the last 7 days' rejected
 * count exceeds 2× the trailing-30-day daily-avg baseline.
 *
 * Steady-state target ≥ 99%.
 */
export async function getZatcaClearanceRate(range: DateRangeParams) {
  await requirePermission("billing:admin");

  const rangeInvoices = await db.invoice.findMany({
    where: {
      issuedAt: { gte: range.from, lte: range.to, not: null },
      zatcaStatus: { in: ["CLEARED", "REJECTED", "PENDING"] },
    },
    select: { zatcaStatus: true },
  });

  let cleared = 0;
  let rejected = 0;
  let pending = 0;
  for (const inv of rangeInvoices) {
    if (inv.zatcaStatus === "CLEARED") cleared++;
    else if (inv.zatcaStatus === "REJECTED") rejected++;
    else if (inv.zatcaStatus === "PENDING") pending++;
  }
  const denom = cleared + rejected + pending;
  const rate = denom > 0 ? cleared / denom : null;

  // Spike detection over the last 30 days, independent of the range
  const now = new Date();
  const thirtyAgo = new Date(now.getTime() - 30 * 86_400_000);
  const sevenAgo = new Date(now.getTime() - 7 * 86_400_000);
  const recentRejections = await db.invoice.findMany({
    where: {
      issuedAt: { gte: thirtyAgo, not: null },
      zatcaStatus: "REJECTED",
    },
    select: { issuedAt: true },
  });

  let recent7 = 0;
  for (const inv of recentRejections) {
    if (inv.issuedAt && inv.issuedAt >= sevenAgo) recent7++;
  }
  const dailyAvg30 = recentRejections.length / 30;
  const alertSpike = dailyAvg30 > 0 && recent7 / 7 > dailyAvg30 * SPIKE_MULTIPLIER;

  return jsonSafe({
    rate,
    cleared,
    rejected,
    pending,
    last7Rejections: recent7,
    dailyAvg30Rejections: dailyAvg30,
    alertSpike,
  });
}
