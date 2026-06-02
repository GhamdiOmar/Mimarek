"use server";

import { requirePermission } from "../../../lib/auth-helpers";
import { db, jsonSafe, sumDecimal, type DateRangeParams } from "./_shared";

function monthKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Top-5 / Top-10 paying orgs' share of total ARR — concentration risk.
 * Sourced from the snapshot table for the range-end month so historical
 * Plan price changes don't distort the answer.
 *
 * Returns ratios in [0, 1]; UI renders as percentage.
 */
export async function getTopArrConcentration(range: DateRangeParams) {
  await requirePermission("billing:admin");

  const snapMonth = monthKey(range.to);
  const rows = await db.subscriptionMrrSnapshot.findMany({
    where: { snapshotMonth: snapMonth, status: "ACTIVE" },
    select: { organizationId: true, mrrSar: true },
  });

  // Aggregate by org (a tenant can theoretically have multiple subs)
  const arrByOrg = new Map<string, number>();
  for (const r of rows) {
    const arr = Number(r.mrrSar ?? 0) * 12;
    arrByOrg.set(r.organizationId, (arrByOrg.get(r.organizationId) ?? 0) + arr);
  }
  const sorted = Array.from(arrByOrg.values()).sort((a, b) => b - a);
  const total = sumDecimal(sorted);

  const top5 = sorted.slice(0, 5).reduce((a, b) => a + b, 0);
  const top10 = sorted.slice(0, 10).reduce((a, b) => a + b, 0);

  return jsonSafe({
    totalArrSar: total,
    top5Pct: total > 0 ? top5 / total : null,
    top10Pct: total > 0 ? top10 / total : null,
    orgCount: sorted.length,
    snapMonth,
  });
}
