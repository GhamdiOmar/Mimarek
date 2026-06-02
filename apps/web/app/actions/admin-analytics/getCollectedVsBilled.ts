"use server";

import { requirePermission } from "../../../lib/auth-helpers";
import { db, jsonSafe, sumDecimal, type DateRangeParams } from "./_shared";

/**
 * Cash collected vs invoiced in the range. Both gross of 15% VAT.
 * The dashboard label must read "incl. VAT" so this is never mistaken
 * for an ARR figure.
 */
export async function getCollectedVsBilled(range: DateRangeParams) {
  await requirePermission("billing:admin");

  const [collected, billed] = await Promise.all([
    db.invoice.findMany({
      where: {
        paidAt: { gte: range.from, lte: range.to, not: null },
        status: { in: ["PAID", "PARTIALLY_PAID"] },
      },
      select: { total: true },
    }),
    db.invoice.findMany({
      where: {
        issuedAt: { gte: range.from, lte: range.to, not: null },
        status: { in: ["ISSUED", "PAID", "PARTIALLY_PAID", "OVERDUE"] },
      },
      select: { total: true },
    }),
  ]);

  const collectedSarGross = sumDecimal(collected.map((i) => i.total));
  const billedSarGross = sumDecimal(billed.map((i) => i.total));
  const collectionRate = billedSarGross > 0 ? collectedSarGross / billedSarGross : null;

  return jsonSafe({
    collectedSarGross,
    billedSarGross,
    collectionRate,
    collectedCount: collected.length,
    billedCount: billed.length,
  });
}
