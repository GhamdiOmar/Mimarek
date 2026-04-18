"use server";

import { db } from "@repo/db";
import { startOfMonth, subDays } from "date-fns";
import { requirePermission } from "../../lib/auth-helpers";

export type LeasingStats = {
  leasesSignedMTD: number;
  pendingApplications: number;
  activeLeases: number;
  expiringSoon: number; // next 30 days
  pipeline: Array<{ stage: string; count: number; amount: number }>;
};

/** Leasing dashboard KPIs + pipeline funnel data. */
export async function getLeasingStats(): Promise<LeasingStats> {
  const session = await requirePermission("dashboard:read");
  const orgId = session.organizationId;

  const now = new Date();
  const mtdStart = startOfMonth(now);
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [leasesSignedMTD, pendingApplications, activeLeases, expiringSoon, reservations] =
    await Promise.all([
      db.lease.count({
        where: {
          customer: { organizationId: orgId },
          status: "ACTIVE",
          createdAt: { gte: mtdStart },
        },
      }),
      db.reservation.count({
        where: { customer: { organizationId: orgId }, status: "PENDING" },
      }),
      db.lease.count({
        where: { customer: { organizationId: orgId }, status: "ACTIVE" },
      }),
      db.lease.count({
        where: {
          customer: { organizationId: orgId },
          status: "ACTIVE",
          endDate: { gte: now, lte: in30Days },
        },
      }),
      db.reservation.findMany({
        where: {
          customer: { organizationId: orgId },
          createdAt: { gte: subDays(now, 90) },
        },
        select: { status: true, amount: true },
      }),
    ]);

  const stageMap = new Map<string, { count: number; amount: number }>();
  for (const r of reservations) {
    const s = r.status;
    const entry = stageMap.get(s) ?? { count: 0, amount: 0 };
    entry.count += 1;
    entry.amount += Number(r.amount ?? 0);
    stageMap.set(s, entry);
  }

  const pipeline = Array.from(stageMap.entries())
    .map(([stage, v]) => ({ stage, count: v.count, amount: Math.round(v.amount) }))
    .sort((a, b) => b.count - a.count);

  return {
    leasesSignedMTD,
    pendingApplications,
    activeLeases,
    expiringSoon,
    pipeline,
  };
}
