"use server";

import { db } from "@repo/db";
import { requirePermission } from "../../../lib/auth-helpers";
import { dayBuckets, dayIndex } from "./shared";

/** Last 30 days of paid rent-installment amounts, bucketed daily by paidAt. */
export async function getRevenueTrend(): Promise<number[]> {
  const session = await requirePermission("dashboard:read");
  const orgId = session.organizationId;
  const buckets = dayBuckets(30);
  const start = buckets[0]!;

  // Filter on paidAt (not updatedAt) — only rows that have a paidAt in range
  const rows = await db.rentInstallment.findMany({
    where: {
      lease: { customer: { organizationId: orgId } },
      paidAt: { gte: start },
    },
    select: { amount: true, paidAmount: true, status: true, paidAt: true },
  });

  const totals = new Array(buckets.length).fill(0);
  for (const r of rows) {
    // Ignore rows with null paidAt
    if (!r.paidAt) continue;
    const idx = dayIndex(r.paidAt, start);
    if (idx >= 0 && idx < totals.length) {
      const ep =
        r.status === "PAID"
          ? Number(r.paidAmount ?? r.amount)
          : Number(r.paidAmount ?? 0);
      totals[idx] += ep;
    }
  }
  return totals;
}
