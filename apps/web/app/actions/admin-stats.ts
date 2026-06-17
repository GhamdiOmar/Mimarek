"use server";

import { db } from "@repo/db";
import { requirePermission } from "../../lib/auth-helpers";
import { serialize } from "../../lib/serialize";

export async function adminGetPlatformStats() {
  await requirePermission("billing:admin");

  const [
    orgCount,
    userCount,
    propertyCount,
    contractCount,
    subCounts,
    invoiceCounts,
    ticketCounts,
  ] = await Promise.all([
    db.organization.count(),
    db.user.count(),
    db.unit.count(),
    db.contract.count(),
    db.subscription.groupBy({ by: ["status"], _count: true }),
    db.invoice.groupBy({ by: ["status"], _count: true }),
    db.supportTicket.groupBy({ by: ["status"], _count: true }),
  ]);

  const subByStatus = Object.fromEntries(subCounts.map((r) => [r.status, r._count]));
  const invByStatus = Object.fromEntries(invoiceCounts.map((r) => [r.status, r._count]));
  const tickByStatus = Object.fromEntries(ticketCounts.map((r) => [r.status, r._count]));

  return {
    orgCount,
    userCount,
    propertyCount,
    contractCount,
    activeSubscriptions: subByStatus["ACTIVE"] ?? 0,
    trialingSubscriptions: subByStatus["TRIALING"] ?? 0,
    pastDueSubscriptions: subByStatus["PAST_DUE"] ?? 0,
    canceledSubscriptions: subByStatus["CANCELED"] ?? 0,
    paidInvoices: invByStatus["PAID"] ?? 0,
    unpaidInvoices: invByStatus["UNPAID"] ?? 0,
    overdueInvoices: invByStatus["OVERDUE"] ?? 0,
    openTickets: tickByStatus["OPEN"] ?? 0,
    inProgressTickets: tickByStatus["IN_PROGRESS"] ?? 0,
    resolvedTickets: tickByStatus["RESOLVED"] ?? 0,
  };
}

export async function adminGetAllTickets(filters?: {
  status?: string;
  priority?: string;
  category?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  await requirePermission("billing:admin");

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 30;

  const where: Record<string, unknown> = {};
  if (filters?.status) where.status = filters.status;
  if (filters?.priority) where.priority = filters.priority;
  if (filters?.category) where.category = filters.category;
  if (filters?.search) {
    where.OR = [
      { subject: { contains: filters.search, mode: "insensitive" } },
      { ticketNumber: { contains: filters.search, mode: "insensitive" } },
      { user: { email: { contains: filters.search, mode: "insensitive" } } },
    ];
  }

  const [tickets, total] = await Promise.all([
    db.supportTicket.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        organization: { select: { id: true, name: true, nameArabic: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.supportTicket.count({ where }),
  ]);

  return {
    tickets: serialize(tickets),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function adminRespondToTicket(ticketId: string, message: string, newStatus?: string) {
  const session = await requirePermission("billing:admin");

  await db.ticketMessage.create({
    data: {
      ticketId,
      userId: session.userId,
      message,
      isStaffReply: true,
    },
  });

  if (newStatus) {
    await db.supportTicket.update({
      where: { id: ticketId },
      data: { status: newStatus as never },
    });
  }
}
