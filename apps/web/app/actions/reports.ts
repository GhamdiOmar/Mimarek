"use server";

import { db } from "@repo/db";
import { requirePermission } from "../../lib/auth-helpers";

export async function getRevenueReport(startDate: string, endDate: string) {
  const session = await requirePermission("reports:read");
  const orgId = session.organizationId;
  const start = new Date(startDate);
  const end = new Date(endDate);

  const duration = end.getTime() - start.getTime();
  const prevStart = new Date(start.getTime() - duration);
  const prevEnd = new Date(start);

  // Use effectivePaid SQL expression: keyed on paidAt (not updatedAt)
  // effectivePaid = CASE WHEN status='PAID' THEN COALESCE(paidAmount,amount) ELSE COALESCE(paidAmount,0) END
  // Aggregation over all rows (no status='PAID' filter) where paidAt is in range
  const [rentAggRows, salesAgg, prevRentAggRows, prevSalesAgg] = await Promise.all([
    db.$queryRaw<{ total: string }[]>`
      SELECT COALESCE(SUM(
        CASE WHEN ri.status = 'PAID'
             THEN COALESCE(ri."paidAmount", ri.amount)
             ELSE COALESCE(ri."paidAmount", 0)
        END
      ), 0)::text AS total
      FROM "RentInstallment" ri
      JOIN "Lease" l ON l.id = ri."leaseId"
      JOIN "Customer" c ON c.id = l."customerId"
      WHERE ri."paidAt" >= ${start}
        AND ri."paidAt" <= ${end}
        AND c."organizationId" = ${orgId}
    `,
    db.contract.aggregate({
      where: {
        status: "SIGNED",
        type: "SALE",
        signedAt: { gte: start, lte: end },
        customer: { organizationId: orgId },
      },
      _sum: { amount: true },
    }),
    db.$queryRaw<{ total: string }[]>`
      SELECT COALESCE(SUM(
        CASE WHEN ri.status = 'PAID'
             THEN COALESCE(ri."paidAmount", ri.amount)
             ELSE COALESCE(ri."paidAmount", 0)
        END
      ), 0)::text AS total
      FROM "RentInstallment" ri
      JOIN "Lease" l ON l.id = ri."leaseId"
      JOIN "Customer" c ON c.id = l."customerId"
      WHERE ri."paidAt" >= ${prevStart}
        AND ri."paidAt" < ${prevEnd}
        AND c."organizationId" = ${orgId}
    `,
    db.contract.aggregate({
      where: {
        status: "SIGNED",
        type: "SALE",
        signedAt: { gte: prevStart, lt: prevEnd },
        customer: { organizationId: orgId },
      },
      _sum: { amount: true },
    }),
  ]);

  const rentTotal = Number(rentAggRows[0]?.total ?? 0);
  const salesTotal = Number(salesAgg._sum.amount ?? 0);
  const combined = rentTotal + salesTotal;
  const prevCombined = Number(prevRentAggRows[0]?.total ?? 0) + Number(prevSalesAgg._sum.amount ?? 0);
  const changePercent = prevCombined > 0 ? Math.round(((combined - prevCombined) / prevCombined) * 100) : 0;

  // Single grouped query per metric — replaces per-month loop to eliminate N+1
  // effectivePaid bucketed by paidAt month, all rows with paidAt in range
  const [rentByMonth, salesByMonth] = await Promise.all([
    db.$queryRaw<{ month: string; amount: number }[]>`
      SELECT to_char(date_trunc('month', ri."paidAt"), 'YYYY-MM') AS month,
             COALESCE(SUM(
               CASE WHEN ri.status = 'PAID'
                    THEN COALESCE(ri."paidAmount", ri.amount)
                    ELSE COALESCE(ri."paidAmount", 0)
               END
             ), 0)::float AS amount
      FROM "RentInstallment" ri
      JOIN "Lease" l ON l.id = ri."leaseId"
      JOIN "Customer" c ON c.id = l."customerId"
      WHERE ri."paidAt" >= ${start}
        AND ri."paidAt" <= ${end}
        AND c."organizationId" = ${orgId}
      GROUP BY 1
    `,
    db.$queryRaw<{ month: string; amount: number }[]>`
      SELECT to_char(date_trunc('month', co."signedAt"), 'YYYY-MM') AS month,
             COALESCE(SUM(co.amount), 0)::float AS amount
      FROM "Contract" co
      JOIN "Customer" c ON c.id = co."customerId"
      WHERE co.status = 'SIGNED'
        AND co.type = 'SALE'
        AND co."signedAt" >= ${start}
        AND co."signedAt" <= ${end}
        AND c."organizationId" = ${orgId}
      GROUP BY 1
    `,
  ]);

  const rentMap = new Map<string, number>(rentByMonth.map((r) => [r.month, Number(r.amount)]));
  const salesMap = new Map<string, number>(salesByMonth.map((r) => [r.month, Number(r.amount)]));

  const months: { month: string; rent: number; sales: number; total: number }[] = [];
  const cursor = new Date(start);
  while (cursor < end) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    const r = rentMap.get(key) ?? 0;
    const s = salesMap.get(key) ?? 0;
    months.push({ month: key, rent: r, sales: s, total: r + s });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  // Top 5 leases by rent collected (effectivePaid, keyed on paidAt)
  const topUnitsRaw = await db.$queryRaw<{ leaseId: string; revenue: string }[]>`
    SELECT ri."leaseId",
           SUM(
             CASE WHEN ri.status = 'PAID'
                  THEN COALESCE(ri."paidAmount", ri.amount)
                  ELSE COALESCE(ri."paidAmount", 0)
             END
           )::text AS revenue
    FROM "RentInstallment" ri
    JOIN "Lease" l ON l.id = ri."leaseId"
    JOIN "Customer" c ON c.id = l."customerId"
    WHERE ri."paidAt" >= ${start}
      AND ri."paidAt" <= ${end}
      AND c."organizationId" = ${orgId}
    GROUP BY ri."leaseId"
    ORDER BY 2::numeric DESC
    LIMIT 5
  `;
  // keep original topUnits shape for the code below
  const topUnits = topUnitsRaw.map((r) => ({ leaseId: r.leaseId, _sum: { amount: Number(r.revenue) } }));

  const leaseIds = topUnits.map((t) => t.leaseId);
  const leases = leaseIds.length > 0 ? await db.lease.findMany({
    where: { id: { in: leaseIds } },
    select: { id: true, unit: { select: { number: true, buildingName: true } } },
  }) : [];

  const topUnitsData = topUnits.map((t) => {
    const lease = leases.find((l) => l.id === t.leaseId);
    const unitLabel = lease
      ? [lease.unit.buildingName, lease.unit.number].filter(Boolean).join(" - ")
      : t.leaseId;
    return {
      unit: unitLabel,
      revenue: Number(t._sum.amount ?? 0),
    };
  });

  return {
    rentTotal,
    salesTotal,
    combined,
    changePercent,
    months,
    topUnits: topUnitsData,
  };
}

export async function getOccupancyReport(_startDate: string, _endDate: string) {
  const session = await requirePermission("reports:read");
  const orgId = session.organizationId;

  // v3.0: No project/building model — group by city
  const units = await db.unit.findMany({
    where: { organizationId: orgId },
    select: { status: true, city: true, buildingName: true },
  });

  const grouped = new Map<string, { total: number; occupied: number }>();
  for (const u of units) {
    const key = u.city || u.buildingName || "غير محدد";
    const entry = grouped.get(key) ?? { total: 0, occupied: 0 };
    entry.total++;
    if (["RENTED", "SOLD"].includes(u.status)) entry.occupied++;
    grouped.set(key, entry);
  }

  const projectData = Array.from(grouped.entries()).map(([name, data]) => ({
    name,
    total: data.total,
    occupied: data.occupied,
    vacant: data.total - data.occupied,
    rate: data.total > 0 ? Math.round((data.occupied / data.total) * 100) : 0,
  }));

  const totalUnits = units.length;
  const totalOccupied = units.filter((u) => ["RENTED", "SOLD"].includes(u.status)).length;
  const overallRate = totalUnits > 0 ? Math.round((totalOccupied / totalUnits) * 100) : 0;

  return { overallRate, totalUnits, totalOccupied, projects: projectData };
}

export async function getRentCollectionReport(startDate: string, endDate: string) {
  const session = await requirePermission("reports:read");
  const orgId = session.organizationId;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();

  const installments = await db.rentInstallment.findMany({
    where: {
      dueDate: { gte: start, lte: end },
      lease: { customer: { organizationId: orgId } },
    },
    include: {
      lease: {
        include: {
          customer: { select: { name: true } },
          unit: { select: { number: true, buildingName: true } },
        },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  const totalDue = installments.reduce((s, i) => s + Number(i.amount), 0);
  // Σ effectivePaid over ALL rows — no status filter (OVERDUE partials count)
  const totalCollected = installments.reduce((s, i) => {
    const ep = i.status === "PAID"
      ? Number(i.paidAmount ?? i.amount)
      : Number(i.paidAmount ?? 0);
    return s + ep;
  }, 0);
  const collectionRate = totalDue > 0 ? Math.round((totalCollected / totalDue) * 100) : 0;

  // Overdue: status=OVERDUE OR (UNPAID|PARTIALLY_PAID and past due)
  const overdue = installments.filter(
    (i) =>
      i.status === "OVERDUE" ||
      ((i.status === "UNPAID" || i.status === "PARTIALLY_PAID") && i.dueDate < now)
  );
  // Aging uses AR remaining per row
  const overdueAmount = overdue.reduce((s, i) => s + (Number(i.amount) - Number(i.paidAmount ?? 0)), 0);

  let aging0to30 = 0, aging31to60 = 0, aging61to90 = 0, aging90plus = 0;
  overdue.forEach((i) => {
    const days = Math.floor((now.getTime() - i.dueDate.getTime()) / (1000 * 60 * 60 * 24));
    const remaining = Number(i.amount) - Number(i.paidAmount ?? 0);
    if (days <= 30) aging0to30 += remaining;
    else if (days <= 60) aging31to60 += remaining;
    else if (days <= 90) aging61to90 += remaining;
    else aging90plus += remaining;
  });
  const aging = { "0-30": aging0to30, "31-60": aging31to60, "61-90": aging61to90, "90+": aging90plus };

  const customerMap = new Map<string, { name: string; unit: string; due: number; paid: number; status: string }>();
  installments.forEach((i) => {
    const key = i.lease.customer.name;
    const unitLabel = [i.lease.unit.buildingName, i.lease.unit.number].filter(Boolean).join(" - ");
    const existing = customerMap.get(key) ?? {
      name: key,
      unit: unitLabel,
      due: 0,
      paid: 0,
      status: "متأخر",
    };
    existing.due += Number(i.amount);
    // effectivePaid per row
    existing.paid +=
      i.status === "PAID"
        ? Number(i.paidAmount ?? i.amount)
        : Number(i.paidAmount ?? 0);
    customerMap.set(key, existing);
  });
  const customers = Array.from(customerMap.values()).map((c) => ({
    ...c,
    status: c.paid >= c.due ? "مسدد" : c.paid > 0 ? "جزئي" : "متأخر",
  }));

  return {
    totalDue,
    totalCollected,
    collectionRate,
    overdueCount: overdue.length,
    overdueAmount,
    aging,
    customers,
  };
}

export async function getMaintenanceReport(startDate: string, endDate: string) {
  const session = await requirePermission("reports:read");
  const orgId = session.organizationId;
  const start = new Date(startDate);
  const end = new Date(endDate);

  const requests = await db.maintenanceRequest.findMany({
    where: {
      organizationId: orgId,
      createdAt: { gte: start, lte: end },
    },
    select: {
      status: true,
      priority: true,
      createdAt: true,
      resolvedAt: true,
    },
  });

  const total = requests.length;
  const resolved = requests.filter((r) => r.status === "RESOLVED").length;
  const inProgress = requests.filter((r) => r.status === "IN_PROGRESS").length;
  const open = requests.filter((r) => r.status === "OPEN").length;

  const resolvedWithTime = requests.filter((r) => r.resolvedAt);
  const avgResolutionDays = resolvedWithTime.length > 0
    ? Math.round(
        resolvedWithTime.reduce((s, r) => s + (r.resolvedAt!.getTime() - r.createdAt.getTime()), 0) /
        resolvedWithTime.length / (1000 * 60 * 60 * 24)
      )
    : 0;

  const priorities: Record<string, { total: number; resolved: number; open: number }> = {};
  requests.forEach((r) => {
    const p = r.priority ?? "MEDIUM";
    if (!priorities[p]) priorities[p] = { total: 0, resolved: 0, open: 0 };
    priorities[p]!.total++;
    if (r.status === "RESOLVED") priorities[p]!.resolved++;
    else priorities[p]!.open++;
  });

  return {
    total,
    resolved,
    inProgress,
    open,
    avgResolutionDays,
    priorities,
  };
}

export async function getMaintenanceCostReport(startDate: string, endDate: string) {
  const session = await requirePermission("reports:read");
  const orgId = session.organizationId;
  const start = new Date(startDate);
  const end = new Date(endDate);

  const requests = await db.maintenanceRequest.findMany({
    where: {
      organizationId: orgId,
      createdAt: { gte: start, lte: end },
    },
    include: {
      unit: { select: { id: true, buildingName: true } },
    },
  });

  const totalEstimated = requests.reduce((s, r) => s + Number(r.estimatedCost ?? 0), 0);
  const totalActual = requests.reduce((s, r) => s + Number(r.actualCost ?? 0), 0);
  const totalLaborHours = requests.reduce((s, r) => s + (r.laborHours ?? 0), 0);

  const byCategory: Record<string, { estimated: number; actual: number; count: number }> = {};
  requests.forEach((r) => {
    const cat = r.category;
    if (!byCategory[cat]) byCategory[cat] = { estimated: 0, actual: 0, count: 0 };
    byCategory[cat]!.estimated += Number(r.estimatedCost ?? 0);
    byCategory[cat]!.actual += Number(r.actualCost ?? 0);
    byCategory[cat]!.count++;
  });

  // Group by building name instead of building model
  const byBuilding: Record<string, { name: string; estimated: number; actual: number; count: number }> = {};
  requests.forEach((r) => {
    if (!r.unit) return;
    const bName = r.unit.buildingName ?? "غير محدد";
    if (!byBuilding[bName]) byBuilding[bName] = { name: bName, estimated: 0, actual: 0, count: 0 };
    byBuilding[bName]!.estimated += Number(r.estimatedCost ?? 0);
    byBuilding[bName]!.actual += Number(r.actualCost ?? 0);
    byBuilding[bName]!.count++;
  });

  return JSON.parse(JSON.stringify({
    totalEstimated,
    totalActual,
    variance: totalActual - totalEstimated,
    totalLaborHours,
    totalRequests: requests.length,
    byCategory: Object.entries(byCategory).map(([cat, data]) => ({ category: cat, ...data })),
    byBuilding: Object.values(byBuilding),
  }));
}
