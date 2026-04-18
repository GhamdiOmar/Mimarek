"use server";

import { db } from "@repo/db";
import { startOfMonth, subMonths } from "date-fns";
import { requirePermission } from "../../../lib/auth-helpers";

/** Last 12 months of platform MRR (sum of paid invoices per month). Platform-admin only. */
export async function getMrrTrend(): Promise<number[]> {
  await requirePermission("billing:admin");

  const now = new Date();
  const start = startOfMonth(subMonths(now, 11));

  const rows = await db.invoice.findMany({
    where: {
      status: "PAID",
      paidAt: { gte: start },
    },
    select: { total: true, paidAt: true },
  });

  const totals = new Array(12).fill(0);
  for (const r of rows) {
    if (!r.paidAt) continue;
    const monthsBack =
      (now.getFullYear() - r.paidAt.getFullYear()) * 12 +
      (now.getMonth() - r.paidAt.getMonth());
    const idx = 11 - monthsBack;
    if (idx >= 0 && idx < 12) {
      totals[idx] += Number(r.total);
    }
  }
  return totals;
}
