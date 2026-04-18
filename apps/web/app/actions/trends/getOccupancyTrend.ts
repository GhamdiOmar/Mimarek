"use server";

import { db } from "@repo/db";
import { requirePermission } from "../../../lib/auth-helpers";
import { subWeeks, startOfWeek } from "date-fns";

/** Last 12 weeks of occupancy % — derived from lease start/end dates. */
export async function getOccupancyTrend(): Promise<number[]> {
  const session = await requirePermission("dashboard:read");
  const orgId = session.organizationId;

  const totalUnits = await db.unit.count({ where: { organizationId: orgId } });
  if (totalUnits === 0) return new Array(12).fill(0);

  const today = new Date();
  const weeks = Array.from({ length: 12 }, (_, i) =>
    startOfWeek(subWeeks(today, 11 - i), { weekStartsOn: 0 }),
  );

  const leases = await db.lease.findMany({
    where: { customer: { organizationId: orgId } },
    select: { startDate: true, endDate: true, status: true },
  });

  return weeks.map((weekStart) => {
    const active = leases.filter(
      (l) =>
        l.startDate <= weekStart &&
        (!l.endDate || l.endDate >= weekStart) &&
        (l.status === "ACTIVE" || l.status === "EXPIRED"),
    ).length;
    return Math.round((active / totalUnits) * 100);
  });
}
