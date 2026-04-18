"use server";

import { db } from "@repo/db";
import { requirePermission } from "../../../lib/auth-helpers";
import { dayBuckets, dayIndex } from "./shared";

/** Last 30 days of paid rent-installment amounts, bucketed daily. */
export async function getRevenueTrend(): Promise<number[]> {
  const session = await requirePermission("dashboard:read");
  const orgId = session.organizationId;
  const buckets = dayBuckets(30);
  const start = buckets[0]!;

  const rows = await db.rentInstallment.findMany({
    where: {
      lease: { customer: { organizationId: orgId } },
      status: "PAID",
      updatedAt: { gte: start },
    },
    select: { amount: true, updatedAt: true },
  });

  const totals = new Array(buckets.length).fill(0);
  for (const r of rows) {
    const idx = dayIndex(r.updatedAt, start);
    if (idx >= 0 && idx < totals.length) {
      totals[idx] += Number(r.amount);
    }
  }
  return totals;
}
