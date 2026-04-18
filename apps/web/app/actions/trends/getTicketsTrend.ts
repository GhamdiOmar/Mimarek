"use server";

import { db } from "@repo/db";
import { requirePermission } from "../../../lib/auth-helpers";
import { dayBuckets, dayIndex } from "./shared";

/** Last 30 days of open ticket count at end-of-day. */
export async function getTicketsTrend(): Promise<number[]> {
  const session = await requirePermission("dashboard:read");
  const orgId = session.organizationId;
  const buckets = dayBuckets(30);
  const start = buckets[0]!;

  const tickets = await db.maintenanceRequest.findMany({
    where: { organizationId: orgId, createdAt: { gte: start } },
    select: { createdAt: true, resolvedAt: true },
  });

  return buckets.map((day) => {
    let open = 0;
    for (const t of tickets) {
      const openedIdx = dayIndex(t.createdAt, start);
      const closedIdx = t.resolvedAt ? dayIndex(t.resolvedAt, start) : Infinity;
      const dayIdx = dayIndex(day, start);
      if (openedIdx <= dayIdx && dayIdx < closedIdx) open++;
    }
    return open;
  });
}
