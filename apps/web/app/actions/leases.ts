"use server";

import { db, Prisma, LeaseStatus } from "@repo/db";
import { revalidatePath } from "next/cache";
import { ROUTES } from "../../lib/routes";
import { serialize } from "../../lib/serialize";
import { requirePermission } from "../../lib/auth-helpers";
import { logAuditEvent } from "../../lib/audit";

export async function getLeases(filters?: { status?: string }) {
  const session = await requirePermission("leases:read");

  const where: Prisma.LeaseWhereInput = {
    customer: { organizationId: session.organizationId },
  };

  if (filters?.status) {
    where.status = filters.status as LeaseStatus;
  }

  const results = await db.lease.findMany({
    where,
    include: {
      unit: true,
      customer: true,
      installments: { orderBy: { dueDate: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Serialize Decimal/Date for client components
  return serialize(results);
}

export async function terminateLease(leaseId: string) {
  const session = await requirePermission("leases:write");

  const lease = await db.lease.findFirst({
    where: { id: leaseId },
    include: { customer: true },
  });
  if (!lease || lease.customer.organizationId !== session.organizationId) {
    throw new Error("Lease not found or you don't have access. Please verify the lease exists in your organization.");
  }

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.lease.update({
      where: { id: leaseId },
      data: { status: "TERMINATED" },
    });

    // Free the unit
    await tx.unit.update({
      where: { id: lease.unitId },
      data: { status: "AVAILABLE" },
    });

    // Update customer status
    await tx.customer.update({
      where: { id: lease.customerId },
      data: { status: "PAST_TENANT" },
    });
  });

  logAuditEvent({ userId: session.userId, userEmail: session.email, userRole: session.role, action: "UPDATE", resource: "Lease", resourceId: leaseId, metadata: { newStatus: "TERMINATED" }, organizationId: session.organizationId });

  revalidatePath(ROUTES.contracts);
  revalidatePath(ROUTES.units);
}
