"use server";

import { requirePermission } from "../../../lib/auth-helpers";
import { db, jsonSafe, sumDecimal, type DateRangeParams } from "./_shared";

/**
 * Coupon-driven revenue forgone as a percentage of pre-discount revenue
 * in the range. Pre-discount basis = SUM(subtotal).
 *
 * Result: leakagePct ∈ [0, 1], null when no qualifying invoices.
 */
export async function getDiscountLeakage(range: DateRangeParams) {
  await requirePermission("billing:admin");

  const invoices = await db.invoice.findMany({
    where: {
      issuedAt: { gte: range.from, lte: range.to, not: null },
      status: { in: ["ISSUED", "PAID", "PARTIALLY_PAID"] },
    },
    select: { discountAmount: true, subtotal: true },
  });

  const forgoneSar = sumDecimal(invoices.map((i) => i.discountAmount));
  const basisSar = sumDecimal(invoices.map((i) => i.subtotal));
  const leakagePct = basisSar > 0 ? forgoneSar / basisSar : null;

  return jsonSafe({
    forgoneSar,
    basisSar,
    leakagePct,
    invoiceCount: invoices.length,
  });
}
