"use server";

import { db } from "@repo/db";
import { requirePermission } from "../../../lib/auth-helpers";
import { subWeeks, startOfWeek } from "date-fns";

/** Last 12 weeks of active pipeline value (PENDING reservation amounts). */
export async function getPipelineTrend(): Promise<number[]> {
  const session = await requirePermission("dashboard:read");
  const orgId = session.organizationId;

  const today = new Date();
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const start = startOfWeek(subWeeks(today, 11 - i), { weekStartsOn: 0 });
    const end = startOfWeek(subWeeks(today, 10 - i), { weekStartsOn: 0 });
    return { start, end };
  });

  const reservations = await db.reservation.findMany({
    where: { customer: { organizationId: orgId } },
    select: {
      amount: true,
      createdAt: true,
      expiresAt: true,
      status: true,
    },
  });

  return weeks.map(({ start, end }) => {
    const active = reservations.filter(
      (r) =>
        r.createdAt < end &&
        r.status === "PENDING" &&
        r.expiresAt >= start,
    );
    return Math.round(
      active.reduce((acc, r) => acc + Number(r.amount ?? 0), 0),
    );
  });
}
