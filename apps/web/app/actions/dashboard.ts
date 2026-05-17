"use server";

import { db } from "@repo/db";
import { requirePermission } from "../../lib/auth-helpers";

export async function getDashboardStats() {
  const session = await requirePermission("dashboard:read");
  const orgId = session.organizationId;

  const [
    totalUnits,
    unitsByStatus,
    activeLeases,
    totalRentCollected,
    pendingRent,
    customerCount,
    newCustomersThisMonth,
    openMaintenanceCount,
  ] = await Promise.all([
    db.unit.count({ where: { organizationId: orgId } }),

    db.unit.groupBy({
      by: ["status"],
      where: { organizationId: orgId },
      _count: true,
    }),

    db.lease.count({
      where: {
        status: "ACTIVE",
        customer: { organizationId: orgId },
      },
    }),

    db.rentInstallment.aggregate({
      where: {
        status: "PAID",
        lease: { customer: { organizationId: orgId } },
      },
      _sum: { amount: true },
    }),

    db.rentInstallment.aggregate({
      where: {
        status: { in: ["UNPAID", "OVERDUE"] },
        lease: { customer: { organizationId: orgId } },
      },
      _sum: { amount: true },
    }),

    db.customer.count({ where: { organizationId: orgId } }),

    db.customer.count({
      where: {
        organizationId: orgId,
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    }),

    db.maintenanceRequest.count({
      where: {
        organizationId: orgId,
        status: { in: ["OPEN", "IN_PROGRESS"] },
      },
    }),
  ]);

  const rentedCount = unitsByStatus.find((u) => u.status === "RENTED")?._count ?? 0;
  const occupancyRate = totalUnits > 0 ? Math.round((rentedCount / totalUnits) * 100) : 0;

  return {
    totalUnits,
    unitsByStatus: Object.fromEntries(
      unitsByStatus.map((u) => [u.status, u._count])
    ),
    occupancyRate,
    activeLeases,
    totalRentCollected: Number(totalRentCollected._sum.amount ?? 0),
    pendingRent: Number(pendingRent._sum.amount ?? 0),
    customerCount,
    newCustomersThisMonth,
    openMaintenanceCount,
  };
}

export async function getRevenueTimeline() {
  const session = await requirePermission("dashboard:read");
  const orgId = session.organizationId;

  const now = new Date();
  const months: { month: string; rent: number; sales: number }[] = [];

  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const monthKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;

    const [rentAgg, salesAgg] = await Promise.all([
      db.rentInstallment.aggregate({
        where: {
          status: "PAID",
          paidAt: { gte: start, lt: end },
          lease: { customer: { organizationId: orgId } },
        },
        _sum: { amount: true },
      }),
      db.contract.aggregate({
        where: {
          status: "SIGNED",
          type: "SALE",
          signedAt: { gte: start, lt: end },
          customer: { organizationId: orgId },
        },
        _sum: { amount: true },
      }),
    ]);

    months.push({
      month: monthKey,
      rent: Number(rentAgg._sum.amount ?? 0),
      sales: Number(salesAgg._sum.amount ?? 0),
    });
  }

  return months;
}

export async function getDashboardV3Stats() {
  const session = await requirePermission("dashboard:read");
  const orgId = session.organizationId;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [
    totalProperties,
    activeDeals,
    signedContracts,
    pendingPayments,
    openMaintenance,
    monthlyRevenueAgg,
  ] = await Promise.all([
    db.unit.count({ where: { organizationId: orgId } }),

    db.reservation.count({
      where: {
        status: { in: ["PENDING", "CONFIRMED"] },
        customer: { organizationId: orgId },
      },
    }),

    db.contract.count({
      where: {
        status: "SIGNED",
        customer: { organizationId: orgId },
      },
    }),

    // Pending payments — overdue installments (dueDate < now, status != PAID)
    db.paymentPlanInstallment.count({
      where: {
        dueDate: { lt: now },
        status: { not: "PAID" },
        paymentPlan: { contract: { customer: { organizationId: orgId } } },
      },
    }),

    db.maintenanceRequest.count({
      where: {
        organizationId: orgId,
        status: { not: "CLOSED" },
      },
    }),

    // Monthly Revenue — PAID installments this month
    db.paymentPlanInstallment.aggregate({
      where: {
        status: "PAID",
        paidAt: { gte: monthStart, lt: monthEnd },
        paymentPlan: { contract: { customer: { organizationId: orgId } } },
      },
      _sum: { amount: true },
    }),
  ]);

  return {
    totalProperties,
    activeDeals,
    signedContracts,
    pendingPayments,
    openMaintenance,
    monthlyRevenue: Number(monthlyRevenueAgg._sum.amount ?? 0),
  };
}

export async function getDashboardRecentDeals() {
  const session = await requirePermission("dashboard:read");
  const orgId = session.organizationId;

  const deals = await db.reservation.findMany({
    where: { customer: { organizationId: orgId } },
    include: {
      customer: { select: { id: true, name: true } },
      unit: { select: { id: true, number: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return JSON.parse(JSON.stringify(deals));
}

export async function getDashboardUpcomingPayments() {
  const session = await requirePermission("dashboard:read");
  const orgId = session.organizationId;

  const now = new Date();

  const installments = await db.paymentPlanInstallment.findMany({
    where: {
      status: { not: "PAID" },
      dueDate: { gte: now },
      paymentPlan: { contract: { customer: { organizationId: orgId } } },
    },
    include: {
      paymentPlan: {
        include: {
          contract: {
            include: {
              customer: { select: { id: true, name: true } },
              unit: { select: { id: true, number: true } },
            },
          },
        },
      },
    },
    orderBy: { dueDate: "asc" },
    take: 5,
  });

  return JSON.parse(JSON.stringify(installments));
}

export async function getDashboardMaintenanceSummary() {
  const session = await requirePermission("dashboard:read");
  const orgId = session.organizationId;

  const grouped = await db.maintenanceRequest.groupBy({
    by: ["status"],
    where: { organizationId: orgId },
    _count: true,
  });

  return grouped.map((g) => ({ status: g.status as string, count: g._count as number }));
}

