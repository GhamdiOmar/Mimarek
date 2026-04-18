"use server";

import { db } from "@repo/db";
import { requirePermission } from "../../../lib/auth-helpers";
import { subWeeks, startOfWeek } from "date-fns";

/** Last 12 weeks of AR collection % (paid / (paid + overdue)). */
export async function getCollectionsTrend(): Promise<number[]> {
  const session = await requirePermission("dashboard:read");
  const orgId = session.organizationId;

  const today = new Date();
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const start = startOfWeek(subWeeks(today, 11 - i), { weekStartsOn: 0 });
    const end = startOfWeek(subWeeks(today, 10 - i), { weekStartsOn: 0 });
    return { start, end };
  });

  const rows = await db.rentInstallment.findMany({
    where: {
      lease: { customer: { organizationId: orgId } },
      dueDate: { gte: weeks[0]!.start },
    },
    select: { dueDate: true, amount: true, status: true },
  });

  return weeks.map(({ start, end }) => {
    const bucket = rows.filter((r) => r.dueDate >= start && r.dueDate < end);
    const paid = bucket
      .filter((r) => r.status === "PAID")
      .reduce((acc, r) => acc + Number(r.amount), 0);
    const total = bucket.reduce((acc, r) => acc + Number(r.amount), 0);
    return total === 0 ? 0 : Math.round((paid / total) * 100);
  });
}
