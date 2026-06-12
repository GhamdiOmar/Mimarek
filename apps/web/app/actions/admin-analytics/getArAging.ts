"use server";

import { requirePermission } from "../../../lib/auth-helpers";
import { bucketInvoices } from "../../../lib/billing/ar-aging";
import { db, jsonSafe, type DateRangeParams } from "./_shared";

/**
 * AR aging buckets in SAR gross (includes 15% VAT). Counts every
 * unpaid invoice with a past due date as of the upper bound of the
 * range (`to`). The range is not strictly a "filter window" — aging is
 * always a snapshot at a moment in time. We anchor that moment to
 * `range.to` so the dashboard reads as-of the picked period end.
 */
export async function getArAging(range: DateRangeParams) {
  await requirePermission("billing:admin");

  const asOf = range.to;
  const invoices = await db.invoice.findMany({
    where: {
      status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
      dueDate: { lt: asOf, not: null },
    },
    select: { total: true, dueDate: true },
  });

  const { buckets, totalSarGross } = bucketInvoices(
    invoices.map((inv) => ({
      total: Number(inv.total ?? 0),
      dueDate: inv.dueDate,
    })),
    asOf,
  );

  return jsonSafe({
    asOf: asOf.toISOString(),
    totalSarGross,
    buckets: [
      { label: "0-30", sumSarGross: buckets["0-30"] },
      { label: "31-60", sumSarGross: buckets["31-60"] },
      { label: "61-90", sumSarGross: buckets["61-90"] },
      { label: "90+", sumSarGross: buckets["90+"] },
    ],
  });
}
