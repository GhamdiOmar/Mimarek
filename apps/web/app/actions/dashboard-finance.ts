"use server";

import { db } from "@repo/db";
import { startOfMonth, endOfMonth } from "date-fns";
import { requireTenantPermission } from "../../lib/auth-helpers";
import { effectivePaid } from "../../lib/money";

export type FinanceStats = {
  collectedMTD: number;
  expectedMTD: number;
  collectionRatePct: number; // 0–100
  totalAR: number;           // all outstanding
  aging: { bucket: string; amount: number }[]; // 0-30, 31-60, 61-90, 90+
  unpaidCount: number;
  overdueCount: number;
};

/**
 * Finance dashboard KPIs — rent roll + AR aging.
 *
 * @param range Optional reporting window (from the dashboard date picker). When
 * provided, the collected/expected headline reflects installments due within
 * the window; when absent it defaults to month-to-date. AR aging + unpaid /
 * overdue counts are always current-state ("outstanding right now"), so they
 * are intentionally not window-bound.
 */
export async function getFinanceStats(range?: {
  from: Date;
  to: Date;
}): Promise<FinanceStats> {
  const session = await requireTenantPermission("dashboard:read");
  const orgId = session.organizationId;

  const now = new Date();
  // Default reporting window = month-to-date; endOfMonth keeps the `lte` upper
  // bound inclusive-correct (no double-count of next-month's first instant).
  const periodStart = range?.from ?? startOfMonth(now);
  const periodEnd = range?.to ?? endOfMonth(now);

  const [mtdInstallments, unpaidInstallments, unpaidCount, overdueCount] =
    await Promise.all([
      // All rows due in the reporting window — effectivePaid handles the math
      db.rentInstallment.findMany({
        where: {
          lease: { customer: { organizationId: orgId } },
          dueDate: { gte: periodStart, lte: periodEnd },
        },
        select: { amount: true, paidAmount: true, status: true },
      }),
      // AR rows: only unpaid/partial/overdue contribute to AR
      db.rentInstallment.findMany({
        where: {
          lease: { customer: { organizationId: orgId } },
          status: { in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] },
          dueDate: { lt: now },
        },
        select: { amount: true, paidAmount: true, dueDate: true },
      }),
      db.rentInstallment.count({
        where: {
          lease: { customer: { organizationId: orgId } },
          status: { in: ["UNPAID", "PARTIALLY_PAID"] },
        },
      }),
      db.rentInstallment.count({
        where: {
          lease: { customer: { organizationId: orgId } },
          status: "OVERDUE",
        },
      }),
    ]);

  const expectedMTD = Math.round(
    mtdInstallments.reduce((s, r) => s + Number(r.amount), 0),
  );
  // Σ effectivePaid over ALL MTD rows — no status filter
  const collectedMTD = Math.round(
    mtdInstallments.reduce((s, r) => s + effectivePaid(r), 0),
  );
  const collectionRatePct =
    expectedMTD === 0 ? 0 : Math.round((collectedMTD / expectedMTD) * 100);

  const buckets = [
    { bucket: "0-30", amount: 0 },
    { bucket: "31-60", amount: 0 },
    { bucket: "61-90", amount: 0 },
    { bucket: "90+", amount: 0 },
  ];
  for (const r of unpaidInstallments) {
    const daysOverdue = Math.floor(
      (now.getTime() - r.dueDate.getTime()) / (24 * 60 * 60 * 1000),
    );
    // AR remaining per row
    const amt = Number(r.amount) - Number(r.paidAmount ?? 0);
    if (daysOverdue <= 30) buckets[0]!.amount += amt;
    else if (daysOverdue <= 60) buckets[1]!.amount += amt;
    else if (daysOverdue <= 90) buckets[2]!.amount += amt;
    else buckets[3]!.amount += amt;
  }
  for (const b of buckets) b.amount = Math.round(b.amount);

  const totalAR = buckets.reduce((s, b) => s + b.amount, 0);

  return {
    collectedMTD,
    expectedMTD,
    collectionRatePct,
    totalAR,
    aging: buckets,
    unpaidCount,
    overdueCount,
  };
}
