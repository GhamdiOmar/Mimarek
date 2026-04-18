"use server";

import { db } from "@repo/db";
import { startOfMonth, subMonths } from "date-fns";
import { requirePermission } from "../../lib/auth-helpers";

export type FinanceStats = {
  collectedMTD: number;
  expectedMTD: number;
  collectionRatePct: number; // 0–100
  totalAR: number;           // all outstanding
  aging: { bucket: string; amount: number }[]; // 0-30, 31-60, 61-90, 90+
  unpaidCount: number;
  overdueCount: number;
};

/** Finance dashboard KPIs — rent roll + AR aging. */
export async function getFinanceStats(): Promise<FinanceStats> {
  const session = await requirePermission("dashboard:read");
  const orgId = session.organizationId;

  const now = new Date();
  const mtdStart = startOfMonth(now);
  const mtdEnd = new Date(mtdStart.getFullYear(), mtdStart.getMonth() + 1, 1);

  const [mtdInstallments, unpaidInstallments, unpaidCount, overdueCount] =
    await Promise.all([
      db.rentInstallment.findMany({
        where: {
          lease: { customer: { organizationId: orgId } },
          dueDate: { gte: mtdStart, lt: mtdEnd },
        },
        select: { amount: true, status: true },
      }),
      db.rentInstallment.findMany({
        where: {
          lease: { customer: { organizationId: orgId } },
          status: { in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] },
          dueDate: { lt: now },
        },
        select: { amount: true, dueDate: true },
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
  const collectedMTD = Math.round(
    mtdInstallments
      .filter((r) => r.status === "PAID")
      .reduce((s, r) => s + Number(r.amount), 0),
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
    const amt = Number(r.amount);
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
