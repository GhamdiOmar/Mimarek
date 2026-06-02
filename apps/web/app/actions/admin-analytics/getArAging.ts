"use server";

import { requirePermission } from "../../../lib/auth-helpers";
import { db, jsonSafe, type DateRangeParams } from "./_shared";

const MS_PER_DAY = 86_400_000;

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

  const buckets = {
    "0-30": 0,
    "31-60": 0,
    "61-90": 0,
    "90+": 0,
  };
  let totalSarGross = 0;
  for (const inv of invoices) {
    if (!inv.dueDate) continue;
    const days = Math.floor((asOf.getTime() - inv.dueDate.getTime()) / MS_PER_DAY);
    const total = Number(inv.total ?? 0);
    totalSarGross += total;
    if (days <= 30) buckets["0-30"] += total;
    else if (days <= 60) buckets["31-60"] += total;
    else if (days <= 90) buckets["61-90"] += total;
    else buckets["90+"] += total;
  }

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
