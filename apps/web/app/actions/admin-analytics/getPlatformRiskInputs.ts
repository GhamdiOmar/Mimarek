"use server";

import { requirePermission } from "../../../lib/auth-helpers";
import { db, jsonSafe } from "./_shared";

const TWENTY_ONE_DAYS_MS = 21 * 86_400_000;
const FOURTEEN_DAYS_MS = 14 * 86_400_000;
const THIRTY_DAYS_MS = 30 * 86_400_000;

/**
 * Tenant risk inputs — the four leading-indicator counts that compose
 * the future Phase-3 Composite Health Score. Each one is independently
 * actionable today.
 *
 * Snapshot (not range-bound) — these are "right now" signals.
 */
export async function getPlatformRiskInputs() {
  await requirePermission("billing:admin");

  const now = new Date();
  const twentyOneAgo = new Date(now.getTime() - TWENTY_ONE_DAYS_MS);
  const fourteenAgo = new Date(now.getTime() - FOURTEEN_DAYS_MS);
  const thirtyAgo = new Date(now.getTime() - THIRTY_DAYS_MS);

  // Past-due subscriptions (org count, distinct)
  const pastDueSubs = await db.subscription.findMany({
    where: { status: { in: ["PAST_DUE", "UNPAID"] } },
    select: { organizationId: true },
  });
  const pastDueOrgCount = new Set(pastDueSubs.map((s) => s.organizationId)).size;

  // Tenants with no ADMIN-role user logged in for > 21d
  // Active subs first, then check each org's max admin lastActiveAt
  const activeSubs = await db.subscription.findMany({
    where: { status: "ACTIVE" },
    select: { organizationId: true },
  });
  const activeOrgIds = Array.from(new Set(activeSubs.map((s) => s.organizationId)));
  let noLoginAdminCount = 0;
  if (activeOrgIds.length > 0) {
    const orgs = await db.user.groupBy({
      by: ["organizationId"],
      where: {
        organizationId: { in: activeOrgIds },
        role: "ADMIN",
      },
      _max: { lastActiveAt: true },
    });
    const seenOrgs = new Set<string>();
    for (const o of orgs) {
      if (!o.organizationId) continue;
      seenOrgs.add(o.organizationId);
      const last = o._max.lastActiveAt;
      if (last == null || last < twentyOneAgo) noLoginAdminCount++;
    }
    // Orgs that have no ADMIN user at all also count
    for (const orgId of activeOrgIds) {
      if (!seenOrgs.has(orgId)) noLoginAdminCount++;
    }
  }

  // Open Urgent/High tickets older than 14d
  const openP1OldCount = await db.supportTicket.count({
    where: {
      status: { in: ["OPEN", "IN_PROGRESS", "WAITING_ON_USER"] },
      priority: { in: ["URGENT", "HIGH"] },
      createdAt: { lt: fourteenAgo },
    },
  });

  // Subscriptions with >2 failed payment transactions in last 30d
  const failed = await db.paymentTransaction.groupBy({
    by: ["invoiceId"],
    where: {
      status: "FAILED",
      initiatedAt: { gte: thirtyAgo },
    },
    _count: { _all: true },
  });
  const failedInvoiceIds = failed
    .filter((f) => f._count._all > 2)
    .map((f) => f.invoiceId);
  let failedPaymentCount = 0;
  if (failedInvoiceIds.length > 0) {
    const failedInvoices = await db.invoice.findMany({
      where: { id: { in: failedInvoiceIds } },
      select: { organizationId: true },
    });
    failedPaymentCount = new Set(failedInvoices.map((i) => i.organizationId)).size;
  }

  return jsonSafe({
    pastDueCount: pastDueOrgCount,
    noLoginAdminCount,
    openP1OldCount,
    failedPaymentCount,
    asOf: now.toISOString(),
  });
}
