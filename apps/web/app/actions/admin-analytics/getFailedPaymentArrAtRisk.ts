"use server";

import { requirePermission } from "../../../lib/auth-helpers";
import { db, jsonSafe } from "./_shared";

/**
 * Annualised recurring revenue from subscriptions currently PAST_DUE or
 * UNPAID, MINUS the portion already counted in AR aging (Invoice
 * unpaid amount) so the dashboard never double-counts the same dirham.
 *
 * Ex-VAT — uses Subscription.mrrSar × 12 if available, else falls back
 * to Subscription.priceAtRenewal × cycle conversion.
 */
export async function getFailedPaymentArrAtRisk(_range: { from: Date; to: Date }) {
  await requirePermission("billing:admin");
  void _range; // snapshot — not range-dependent

  const subs = await db.subscription.findMany({
    where: { status: { in: ["PAST_DUE", "UNPAID"] } },
    select: {
      id: true,
      mrrSar: true,
      priceAtRenewal: true,
      billingCycle: true,
      invoices: {
        where: {
          status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
          dueDate: { lt: new Date(), not: null },
        },
        select: { subtotal: true },
      },
    },
  });

  let atRiskArrSar = 0;
  for (const s of subs) {
    let arr = Number(s.mrrSar ?? 0) * 12;
    if (arr === 0 && s.priceAtRenewal != null) {
      const price = Number(s.priceAtRenewal);
      arr = s.billingCycle === "ANNUAL" ? price : price * 12;
    }
    // Subtract the ex-VAT portion already exposed in AR aging buckets
    const alreadyAged = s.invoices.reduce(
      (acc, inv) => acc + Number(inv.subtotal ?? 0),
      0,
    );
    const remaining = Math.max(0, arr - alreadyAged);
    atRiskArrSar += remaining;
  }

  return jsonSafe({
    atRiskArrSar,
    count: subs.length,
  });
}
