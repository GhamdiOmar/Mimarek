"use server";

import { db } from "@repo/db";
import { requireTenantPermission } from "../../../lib/auth-helpers";
import { effectivePaid } from "../../../lib/money";
import { dayBuckets, dayIndex } from "./shared";

/** Last 30 days of paid rent-installment amounts, bucketed daily by paidAt. */
export async function getRevenueTrend(): Promise<number[]> {
  const session = await requireTenantPermission("dashboard:read");
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
      // Single-homed money rule (spec §4) — import the canonical helper rather
      // than re-inlining it, so this trend can't silently drift from finance/reports.
      totals[idx] += effectivePaid(r);
    }
  }
  return totals;
}
