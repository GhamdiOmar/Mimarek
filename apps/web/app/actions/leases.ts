"use server";

import { db } from "@repo/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "../../lib/auth-helpers";
import { logAuditEvent } from "../../lib/audit";

async function generateContractNumber(
  organizationId: string
): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.contract.count({
    where: {
      type: "LEASE",
      customer: { organizationId },
      createdAt: { gte: new Date(`${year}-01-01`) },
    },
  });
  const seq = String(count + 1).padStart(4, "0");
  return `LEASE-${year}-${seq}`;
}

export async function createLease(data: {
  unitId: string;
  customerId: string;
  startDate: string; // ISO date string
  endDate: string;
  totalAmount: number;
  installmentCount: number; // e.g., 12 for monthly, 4 for quarterly
}) {
  const session = await requirePermission("leases:write");

  // Verify customer belongs to org
  const customer = await db.customer.findFirst({
    where: { id: data.customerId, organizationId: session.organizationId },
  });
  if (!customer) throw new Error("Customer not found or you don't have access. Please verify the customer exists in your organization.");

  // Verify unit belongs to org
  const unit = await db.unit.findFirst({
    where: { id: data.unitId, organizationId: session.organizationId },
  });
  if (!unit) {
    throw new Error("Unit not found or you don't have access. Please verify the unit exists in your organization.");
  }

  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  const installmentAmount = Math.round((data.totalAmount / data.installmentCount) * 100) / 100;

  const contractNumber = await generateContractNumber(session.organizationId);

  // Create lease + installments + linked contract in transaction
  const lease = await db.$transaction(async (tx: any) => {
    const newLease = await tx.lease.create({
      data: {
        unitId: data.unitId,
        customerId: data.customerId,
        startDate,
        endDate,
        totalAmount: data.totalAmount,
        status: "ACTIVE",
      },
    });

    // Generate installments
    const installments = [];
    for (let i = 0; i < data.installmentCount; i++) {
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + i);

      installments.push({
        leaseId: newLease.id,
        dueDate,
        amount: installmentAmount,
        status: "UNPAID" as const,
      });
    }

    await tx.rentInstallment.createMany({ data: installments });

    // Create linked Contract record
    await tx.contract.create({
      data: {
        customerId: data.customerId,
        unitId: data.unitId,
        type: "LEASE",
        amount: data.totalAmount,
        userId: session.userId,
        status: "SIGNED",
        signedAt: new Date(),
        contractNumber,
        leaseId: newLease.id,
        paymentFrequency: data.installmentCount <= 1 ? "ANNUAL" : data.installmentCount <= 4 ? "QUARTERLY" : "MONTHLY",
        noticePeriodDays: 60,
      },
    });

    // Update unit status to RENTED
    await tx.unit.update({
      where: { id: data.unitId },
      data: { status: "RENTED" },
    });

    // Update customer status to ACTIVE_TENANT
    await tx.customer.update({
      where: { id: data.customerId },
      data: { status: "ACTIVE_TENANT" },
    });

    return newLease;
  });

  logAuditEvent({ userId: session.userId, userEmail: session.email, userRole: session.role, action: "CREATE", resource: "Lease", resourceId: lease.id, organizationId: session.organizationId });

  revalidatePath("/dashboard/contracts");
  revalidatePath("/dashboard/units");
  return JSON.parse(JSON.stringify(lease));
}

export async function getLeases(filters?: { status?: string }) {
  const session = await requirePermission("leases:read");

  const where: any = {
    customer: { organizationId: session.organizationId },
  };

  if (filters?.status) {
    where.status = filters.status;
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
  return JSON.parse(JSON.stringify(results));
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

  await db.$transaction(async (tx: any) => {
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

  revalidatePath("/dashboard/contracts");
  revalidatePath("/dashboard/units");
}
