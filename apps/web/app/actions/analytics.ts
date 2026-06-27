"use server";

import { db } from "@repo/db";
import { requireTenantPermission } from "../../lib/auth-helpers";

/**
 * Analytics — v3.0 CRM & Property Platform
 * Note: Off-plan development pipeline functions removed in v3.0 (models deleted).
 */

export async function getPropertyAnalytics() {
  const session = await requireTenantPermission("dashboard:read");
  const orgId = session.organizationId;

  const [totalUnits, unitsByStatus, unitsByType] = await Promise.all([
    db.unit.count({ where: { organizationId: orgId } }),
    db.unit.groupBy({
      by: ["status"],
      where: { organizationId: orgId },
      _count: true,
    }),
    db.unit.groupBy({
      by: ["type"],
      where: { organizationId: orgId },
      _count: true,
    }),
  ]);

  return {
    totalUnits,
    byStatus: Object.fromEntries(unitsByStatus.map((u) => [u.status, u._count])),
    byType: Object.fromEntries(unitsByType.map((u) => [u.type, u._count])),
  };
}
