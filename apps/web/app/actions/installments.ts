"use server";

import { db } from "@repo/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "../../lib/auth-helpers";
import { logAuditEvent } from "../../lib/audit";

export async function getInstallments(filters?: {
  status?: string;
  leaseId?: string;
}) {
  const session = await requirePermission("finance:read");

  const where: any = {
    lease: { customer: { organizationId: session.organizationId } },
  };

  if (filters?.status) {
    where.status = filters.status;
  }
  if (filters?.leaseId) {
    where.leaseId = filters.leaseId;
  }

  const results = await db.rentInstallment.findMany({
    where,
    include: {
      lease: {
        include: {
          customer: true,
          unit: true,
        },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  // Serialize Decimal/Date for client components
  return JSON.parse(JSON.stringify(results));
}

export async function recordPayment(
  installmentId: string,
  data: {
    paymentMethod: string;
    amount?: number; // For partial payments
  }
) {
  const session = await requirePermission("finance:write");

  // Verify installment belongs to org
  const installment = await db.rentInstallment.findFirst({
    where: { id: installmentId },
    include: { lease: { include: { customer: true } } },
  });
  if (!installment || installment.lease.customer.organizationId !== session.organizationId) {
    throw new Error("Payment installment not found. Please refresh the page and try again.");
  }

  const updated = await db.rentInstallment.update({
    where: { id: installmentId },
    data: {
      status: "PAID",
      paidAt: new Date(),
      paymentMethod: data.paymentMethod,
    },
  });

  logAuditEvent({ userId: session.userId, userEmail: session.email, userRole: session.role, action: "UPDATE", resource: "RentInstallment", resourceId: installmentId, metadata: { action: "recordPayment", paymentMethod: data.paymentMethod }, organizationId: session.organizationId });

  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard/finance");
  return JSON.parse(JSON.stringify(updated));
}

export async function markOverdueInstallments() {
  const session = await requirePermission("finance:write");

  const result = await db.rentInstallment.updateMany({
    where: {
      status: "UNPAID",
      dueDate: { lt: new Date() },
      lease: { customer: { organizationId: session.organizationId } },
    },
    data: { status: "OVERDUE" },
  });

  revalidatePath("/dashboard/payments");
  return result.count;
}
