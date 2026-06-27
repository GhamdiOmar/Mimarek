"use server";

import { db } from "@repo/db";
import { requireTenantPermission } from "../../../lib/auth-helpers";
import { effectivePaid } from "../../../lib/money";
import { subWeeks, startOfWeek } from "date-fns";

/** Last 12 weeks of AR collection % (effectivePaid / scheduled). */
export async function getCollectionsTrend(): Promise<number[]> {
  const session = await requireTenantPermission("dashboard:read");
  const orgId = session.organizationId;

  const today = new Date();
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const start = startOfWeek(subWeeks(today, 11 - i), { weekStartsOn: 0 });
    const end = startOfWeek(subWeeks(today, 10 - i), { weekStartsOn: 0 });
    return { start, end };
  });

  // Select paidAmount for effectivePaid; axis is dueDate (due-cohort metric)
  const rows = await db.rentInstallment.findMany({
    where: {
      lease: { customer: { organizationId: orgId } },
      dueDate: { gte: weeks[0]!.start },
    },
    select: { dueDate: true, amount: true, paidAmount: true, status: true },
  });

  return weeks.map(({ start, end }) => {
    const bucket = rows.filter((r) => r.dueDate >= start && r.dueDate < end);
    // Σ effectivePaid over ALL bucket rows — no status filter
    const paid = bucket.reduce((acc, r) => acc + effectivePaid(r), 0);
    const total = bucket.reduce((acc, r) => acc + Number(r.amount), 0);
    return total === 0 ? 0 : Math.round((paid / total) * 100);
  });
}
