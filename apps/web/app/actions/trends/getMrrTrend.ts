"use server";

import { db } from "@repo/db";
import { requirePermission } from "../../../lib/auth-helpers";

export async function getMrrTrend(): Promise<number[]> {
  await requirePermission("billing:admin");

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const invoices = await db.invoice.findMany({
    where: {
      status: "PAID",
      paidAt: { gte: start },
    },
    select: { paidAt: true, total: true },
  });

  const buckets = Array.from({ length: 12 }, () => 0);
  for (const inv of invoices) {
    if (!inv.paidAt) continue;
    const monthsAgo =
      (now.getFullYear() - inv.paidAt.getFullYear()) * 12 +
      (now.getMonth() - inv.paidAt.getMonth());
    const idx = 11 - monthsAgo;
    if (idx >= 0 && idx < 12) {
      buckets[idx] = (buckets[idx] ?? 0) + Number(inv.total);
    }
  }

  return buckets as number[];
}
