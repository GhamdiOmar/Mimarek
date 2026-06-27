"use server";

import { db, type Prisma } from "@repo/db";
import { requirePermission } from "../../lib/auth-helpers";
import { serialize } from "../../lib/serialize";

export async function getAuditLogs(filters?: {
  userId?: string;
  action?: string;
  resource?: string;
  resourceId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}) {
  const session = await requirePermission("audit:read");

  const page = Math.max(1, filters?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters?.pageSize ?? 50));
  const skip = (page - 1) * pageSize;

  const where: Prisma.AuditLogWhereInput = {
    organizationId: session.organizationId,
  };

  if (filters?.userId) where.userId = filters.userId;
  if (filters?.action) where.action = filters.action;
  if (filters?.resource) where.resource = filters.resource;
  if (filters?.resourceId) where.resourceId = filters.resourceId;
  if (filters?.from || filters?.to) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (filters.from) createdAt.gte = new Date(filters.from);
    if (filters.to) createdAt.lte = new Date(filters.to);
    where.createdAt = createdAt;
  }

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    db.auditLog.count({ where }),
  ]);

  return {
    logs: serialize(logs),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
