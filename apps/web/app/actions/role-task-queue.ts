"use server";

import { db } from "@repo/db";
import { requirePermission } from "../../lib/auth-helpers";
import { getLeasingStats } from "./dashboard-leasing";
import { getFinanceStats } from "./dashboard-finance";
import { getMaintenanceStats } from "./dashboard-maintenance";
import type { RoleTaskQueueItem } from "@repo/types";

/**
 * getRoleTaskQueue — derives role-scoped actionable buckets from existing
 * dashboard stats plus a small set of extra counts (contracts awaiting
 * signature, leads to follow up). Returns four slices keyed by role.
 *
 * Derivation rules:
 *  leasing:
 *    - leads-to-follow-up     → db.deal.count (status ACTIVE, stage NEW|QUALIFIED)   severity: info
 *    - contracts-awaiting-sig → db.contract.count (status DRAFT|SENT)               severity: warning
 *    - expiring-soon          → LeasingStats.expiringSoon                            severity: warning
 *    - pending-applications   → LeasingStats.pendingApplications                    severity: info
 *
 *  finance:
 *    - overdue-payments       → FinanceStats.overdueCount                            severity: error
 *    - ar-90plus              → FinanceStats.aging[3].amount > 0                     severity: error
 *    - collection-below-tgt   → FinanceStats.collectionRatePct < 90                  severity: warning
 *
 *  maintenance:
 *    - sla-breach             → MaintenanceStats.slaBreachCount                      severity: error
 *    - open-tickets           → MaintenanceStats.openTickets                         severity: info
 *
 *  owner:
 *    curated union of highest-severity items from the three roles above.
 *
 * Zero-count items are excluded (no noise). Decimal fields are serialized
 * via JSON.parse(JSON.stringify()) to strip Prisma Decimal objects.
 */
export type RoleTaskQueueResult = {
  leasing: RoleTaskQueueItem[];
  finance: RoleTaskQueueItem[];
  maintenance: RoleTaskQueueItem[];
  owner: RoleTaskQueueItem[];
};

export async function getRoleTaskQueue(): Promise<RoleTaskQueueResult> {
  const session = await requirePermission("dashboard:read");
  const orgId = session.organizationId;

  // Fetch all sources in parallel to minimise round-trips
  const [leasingStats, financeStats, maintenanceStats, contractsAwaitingSig, leadsToFollowUp] =
    await Promise.all([
      getLeasingStats(),
      getFinanceStats(),
      getMaintenanceStats(),
      // Contracts not yet signed: DRAFT or SENT (org-scoped via customer relation)
      db.contract.count({
        where: {
          customer: { organizationId: orgId },
          status: { in: ["DRAFT", "SENT"] },
        },
      }),
      // Leads to follow up: ACTIVE deals at early pipeline stages
      db.deal.count({
        where: {
          customer: { organizationId: orgId },
          status: "ACTIVE",
          stage: { in: ["NEW", "QUALIFIED"] },
        },
      }),
    ]);

  // ── Leasing items ────────────────────────────────────────────────────────────
  const leasingItems: RoleTaskQueueItem[] = [];

  if (leadsToFollowUp > 0) {
    leasingItems.push({
      id: "leads-to-follow-up",
      title: { ar: "عملاء يحتاجون متابعة", en: "Leads to follow up" },
      count: leadsToFollowUp,
      href: "/dashboard/crm",
      severity: "info",
    });
  }

  if (contractsAwaitingSig > 0) {
    leasingItems.push({
      id: "contracts-awaiting-signature",
      title: { ar: "عقود بانتظار التوقيع", en: "Contracts awaiting signature" },
      count: contractsAwaitingSig,
      href: "/dashboard/contracts",
      severity: "warning",
    });
  }

  if (leasingStats.expiringSoon > 0) {
    leasingItems.push({
      id: "leases-expiring-soon",
      title: { ar: "عقود إيجار تنتهي قريباً", en: "Leases / reservations expiring soon" },
      count: leasingStats.expiringSoon,
      href: "/dashboard/reservations",
      severity: "warning",
    });
  }

  if (leasingStats.pendingApplications > 0) {
    leasingItems.push({
      id: "pending-applications",
      title: { ar: "طلبات معلقة", en: "Pending applications" },
      count: leasingStats.pendingApplications,
      href: "/dashboard/reservations",
      severity: "info",
    });
  }

  // ── Finance items ────────────────────────────────────────────────────────────
  const financeItems: RoleTaskQueueItem[] = [];

  if (financeStats.overdueCount > 0) {
    financeItems.push({
      id: "overdue-payments",
      title: { ar: "مدفوعات متأخرة", en: "Overdue payments" },
      count: financeStats.overdueCount,
      href: "/dashboard/finance",
      severity: "error",
    });
  }

  // 90+ AR bucket is aging[3]
  const ar90plus = financeStats.aging[3]?.amount ?? 0;
  if (ar90plus > 0) {
    financeItems.push({
      id: "ar-90plus",
      title: { ar: "مستحقات فوق 90 يوم", en: "90+ day AR outstanding" },
      // amount in SAR — no count chip (item still shows without count)
      href: "/dashboard/finance",
      severity: "error",
    });
  }

  if (financeStats.collectionRatePct < 90) {
    financeItems.push({
      id: "collection-below-target",
      title: { ar: "نسبة التحصيل دون الهدف", en: "Collection rate below target" },
      href: "/dashboard/finance",
      severity: "warning",
    });
  }

  // ── Maintenance items ────────────────────────────────────────────────────────
  const maintenanceItems: RoleTaskQueueItem[] = [];

  if (maintenanceStats.slaBreachCount > 0) {
    maintenanceItems.push({
      id: "sla-breach",
      title: { ar: "طلبات تجاوزت مستوى الخدمة", en: "SLA-breach tickets" },
      count: maintenanceStats.slaBreachCount,
      href: "/dashboard/maintenance",
      severity: "error",
    });
  }

  if (maintenanceStats.openTickets > 0) {
    maintenanceItems.push({
      id: "open-tickets",
      title: { ar: "طلبات صيانة مفتوحة", en: "Open maintenance tickets" },
      count: maintenanceStats.openTickets,
      href: "/dashboard/maintenance",
      severity: "info",
    });
  }

  // ── Owner items — curated union of highest-severity items ────────────────────
  // Include error-severity items from all roles, then warning items, then info.
  // De-duplicate by id using a Map (first insertion wins — error items come first).
  const ownerCandidates = [
    ...financeItems,
    ...maintenanceItems,
    ...leasingItems,
  ];
  const seen = new Set<string>();
  const ownerItems: RoleTaskQueueItem[] = [];
  for (const item of ownerCandidates) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      ownerItems.push(item);
    }
  }

  // Serialize to strip any Prisma Decimal objects that may have leaked through
  return JSON.parse(
    JSON.stringify({ leasing: leasingItems, finance: financeItems, maintenance: maintenanceItems, owner: ownerItems }),
  );
}
