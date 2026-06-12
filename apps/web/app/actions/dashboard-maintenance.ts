"use server";

import { db } from "@repo/db";
import { startOfMonth, endOfMonth } from "date-fns";
import { requirePermission } from "../../lib/auth-helpers";

export type MaintenanceStats = {
  openTickets: number;
  inProgressTickets: number;
  slaBreachCount: number;              // dueDate < now AND not closed
  avgResolutionHours: number | null;   // resolved within the reporting window
  byCategory: Array<{ category: string; count: number }>;
  byPriority: Array<{ priority: string; count: number }>;
};

/**
 * Maintenance dashboard KPIs — ticket volume, SLA, resolution time.
 *
 * @param range Optional reporting window (from the dashboard date picker). When
 * provided, `avgResolutionHours` (a flow metric — tickets resolved in the
 * window) reflects the chosen window; when absent it defaults to month-to-date.
 * `openTickets`, `inProgressTickets`, `slaBreachCount`, `byCategory`, and
 * `byPriority` are current-state stock metrics ("open right now") and are
 * intentionally not window-bound.
 */
export async function getMaintenanceStats(range?: {
  from: Date;
  to: Date;
}): Promise<MaintenanceStats> {
  const session = await requirePermission("dashboard:read");
  const orgId = session.organizationId;

  const now = new Date();
  const periodStart = range?.from ?? startOfMonth(now);
  const periodEnd = range?.to ?? endOfMonth(now);

  const [openTickets, inProgressTickets, slaBreachCount, resolved, openRows] =
    await Promise.all([
      db.maintenanceRequest.count({
        where: { organizationId: orgId, status: "OPEN" },
      }),
      db.maintenanceRequest.count({
        where: { organizationId: orgId, status: "IN_PROGRESS" },
      }),
      db.maintenanceRequest.count({
        where: {
          organizationId: orgId,
          status: { in: ["OPEN", "IN_PROGRESS"] },
          dueDate: { lt: now },
        },
      }),
      db.maintenanceRequest.findMany({
        where: {
          organizationId: orgId,
          resolvedAt: { gte: periodStart, lte: periodEnd },
        },
        select: { createdAt: true, resolvedAt: true },
      }),
      db.maintenanceRequest.findMany({
        where: {
          organizationId: orgId,
          status: { in: ["OPEN", "IN_PROGRESS"] },
        },
        select: { category: true, priority: true },
      }),
    ]);

  let avgResolutionHours: number | null = null;
  if (resolved.length > 0) {
    const totalMs = resolved.reduce((acc, r) => {
      if (!r.resolvedAt) return acc;
      return acc + (r.resolvedAt.getTime() - r.createdAt.getTime());
    }, 0);
    avgResolutionHours = Math.round((totalMs / resolved.length) / (60 * 60 * 1000));
  }

  const catMap = new Map<string, number>();
  const prioMap = new Map<string, number>();
  for (const r of openRows) {
    catMap.set(r.category, (catMap.get(r.category) ?? 0) + 1);
    prioMap.set(r.priority, (prioMap.get(r.priority) ?? 0) + 1);
  }
  const byCategory = Array.from(catMap.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
  const byPriority = Array.from(prioMap.entries())
    .map(([priority, count]) => ({ priority, count }))
    .sort((a, b) => b.count - a.count);

  return {
    openTickets,
    inProgressTickets,
    slaBreachCount,
    avgResolutionHours,
    byCategory,
    byPriority,
  };
}
