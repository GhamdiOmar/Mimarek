"use server";

import { db } from "@repo/db";
import { requirePermission } from "../../lib/auth-helpers";

/** effectivePaid — canonical formula per spec §4 */
function effectivePaid(r: { status: string; amount: any; paidAmount: any }): number {
  return r.status === "PAID"
    ? Number(r.paidAmount ?? r.amount)
    : Number(r.paidAmount ?? 0);
}

export async function getFinanceStats() {
  const session = await requirePermission("finance:read");
  const orgId = session.organizationId;

  // Get all installments for this org — paidAmount needed for effectivePaid
  const installments = await db.rentInstallment.findMany({
    where: {
      lease: { customer: { organizationId: orgId } },
    },
    select: { amount: true, status: true, paidAmount: true, paidAt: true, dueDate: true },
  });

  // Get contract amounts (sale revenue)
  const contracts = await db.contract.findMany({
    where: {
      customer: { organizationId: orgId },
      status: "SIGNED",
    },
    select: { amount: true, signedAt: true },
  });

  // Σ effectivePaid over ALL rows (no status filter) — OVERDUE partials contribute
  const totalRentRevenue = installments.reduce((sum, i) => sum + effectivePaid(i), 0);

  const totalSaleRevenue = contracts.reduce((sum, c) => sum + Number(c.amount), 0);
  const totalRevenue = totalRentRevenue + totalSaleRevenue;

  // AR: Σ remaining over UNPAID/OVERDUE/PARTIALLY_PAID
  const pendingInvoices = installments
    .filter((i) => i.status === "UNPAID" || i.status === "OVERDUE" || i.status === "PARTIALLY_PAID")
    .reduce((sum, i) => sum + (Number(i.amount) - Number(i.paidAmount ?? 0)), 0);

  const overdueAmount = installments
    .filter((i) => i.status === "OVERDUE")
    .reduce((sum, i) => sum + (Number(i.amount) - Number(i.paidAmount ?? 0)), 0);

  const paidCount = installments.filter((i) => i.status === "PAID").length;
  const totalCount = installments.length;
  // collection rate = collected / (collected + pending)
  const collectionRate =
    totalRentRevenue + pendingInvoices > 0
      ? Math.round((totalRentRevenue / (totalRentRevenue + pendingInvoices)) * 100)
      : 0;

  return {
    totalRevenue,
    totalRentRevenue,
    totalSaleRevenue,
    pendingInvoices,
    overdueAmount,
    collectionRate,
    installmentCount: totalCount,
    paidCount,
  };
}

export async function getMaintenanceCostSummary() {
  const session = await requirePermission("finance:read");
  const orgId = session.organizationId;

  const requests = await db.maintenanceRequest.findMany({
    where: { organizationId: orgId },
    select: { estimatedCost: true, actualCost: true, category: true },
  });

  const totalEstimated = requests.reduce((s, r) => s + Number(r.estimatedCost ?? 0), 0);
  const totalActual = requests.reduce((s, r) => s + Number(r.actualCost ?? 0), 0);

  const byCategory: Record<string, number> = {};
  requests.forEach(r => {
    const cat = r.category;
    byCategory[cat] = (byCategory[cat] ?? 0) + Number(r.actualCost ?? r.estimatedCost ?? 0);
  });

  return { totalEstimated, totalActual, byCategory };
}

export async function getUnitRevenueBreakdown() {
  const session = await requirePermission("finance:read");
  const orgId = session.organizationId;

  const units = await db.unit.findMany({
    where: { organizationId: orgId },
    include: {
      leases: {
        where: { status: "ACTIVE" },
        include: {
          // No status filter on installments — effectivePaid handles it
          installments: { select: { amount: true, paidAmount: true, status: true } },
        },
      },
      maintenanceRequests: {
        select: { actualCost: true, estimatedCost: true },
      },
    },
  });

  return JSON.parse(JSON.stringify(
    units.map(u => {
      const rentIncome = u.leases.reduce((s, l) =>
        s + l.installments.reduce((is, i) => is + effectivePaid(i), 0), 0);
      const maintenanceCost = u.maintenanceRequests.reduce((s, m) =>
        s + Number(m.actualCost ?? m.estimatedCost ?? 0), 0);
      return {
        id: u.id,
        number: u.number,
        building: u.buildingName ?? u.city ?? "—",
        rentIncome,
        maintenanceCost,
        netIncome: rentIncome - maintenanceCost,
      };
    }).filter(u => u.rentIncome > 0 || u.maintenanceCost > 0)
  ));
}
