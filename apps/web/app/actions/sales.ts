"use server";

import { db } from "@repo/db";
import { requireTenantPermission } from "../../lib/auth-helpers";

export async function getSalesStats() {
  const session = await requireTenantPermission("dashboard:read");
  const orgId = session.organizationId;

  const [customerCount, reservationCount, contractCount] = await Promise.all([
    db.customer.count({ where: { organizationId: orgId } }),
    db.reservation.count({
      where: { customer: { organizationId: orgId } },
    }),
    db.contract.count({
      where: { customer: { organizationId: orgId } },
    }),
  ]);

  return { customerCount, reservationCount, contractCount };
}

