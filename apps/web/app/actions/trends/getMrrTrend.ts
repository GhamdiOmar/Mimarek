"use server";

import { db } from "@repo/db";
import { requirePermission } from "../../../lib/auth-helpers";

/**
 * 12-month MRR trend in monthly SAR ex-VAT, most recent month last.
 *
 * Sourced from SubscriptionMrrSnapshot — immune to historical Plan price
 * changes that would otherwise retroactively rewrite the chart. Until
 * the snapshot cron has run for a given month, that month's bucket
 * reads 0; the dashboard renders that as "—" per AGENTS.md §6.8.4.
 */
export async function getMrrTrend(): Promise<number[]> {
  await requirePermission("billing:admin");

  const now = new Date();
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getUTCFullYear(), now.getUTCMonth() - i, 1);
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    months.push(`${d.getUTCFullYear()}-${m}`);
  }

  const rows = await db.subscriptionMrrSnapshot.findMany({
    where: { snapshotMonth: { in: months }, status: "ACTIVE" },
    select: { snapshotMonth: true, mrrSar: true },
  });

  const byMonth = new Map<string, number>();
  for (const r of rows) {
    byMonth.set(
      r.snapshotMonth,
      (byMonth.get(r.snapshotMonth) ?? 0) + Number(r.mrrSar ?? 0),
    );
  }

  return months.map((m) => byMonth.get(m) ?? 0);
}
