"use server";

import { db } from "@repo/db";
import { requirePermission } from "../../lib/auth-helpers";
import { logAuditEvent } from "../../lib/audit";
import { revalidatePath } from "next/cache";

// ─── RED: Payment Plans ─────────────────────────────────────────────────────

export async function createPaymentPlan(
  contractId: string,
  data: {
    downPayment?: number;
    installments: Array<{ amount: number; dueDate: string }>;
  }
) {
  const session = await requirePermission("contracts:write");

  const contract = await db.contract.findFirst({
    where: { id: contractId, unit: { organizationId: session.organizationId } },
  });
  if (!contract) throw new Error("Contract not found or you don't have access. Please verify the contract exists.");

  // Validate sum
  const netAmount = Number(contract.netAmount ?? contract.amount);
  const downPayment = data.downPayment ?? 0;
  const installmentTotal = data.installments.reduce((sum, i) => sum + i.amount, 0);
  const total = downPayment + installmentTotal;

  if (Math.abs(total - netAmount) > 0.01) {
    throw new Error(
      `The payment plan total (${total.toFixed(2)} SAR) does not match the contract amount (${netAmount.toFixed(2)} SAR). Please adjust the installment amounts so they add up to the contract total.`
    );
  }

  const plan = await db.paymentPlan.create({
    data: {
      contractId,
      name: `Payment Plan - ${contract.contractNumber ?? contractId.slice(-6)}`,
      totalAmount: netAmount,
      downPayment: downPayment || undefined,
      status: "ACTIVE_PLAN",
      organizationId: session.organizationId,
      installments: {
        create: data.installments.map((inst, idx) => ({
          installmentNumber: idx + 1,
          amount: inst.amount,
          dueDate: new Date(inst.dueDate),
        })),
      },
    },
    include: { installments: true },
  });

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "CREATE",
    resource: "PaymentPlan",
    resourceId: plan.id,
    metadata: { contractId, installmentCount: data.installments.length },
    organizationId: session.organizationId,
  });

  revalidatePath(`/dashboard/contracts/${contractId}`);
  return JSON.parse(JSON.stringify(plan));
}

export async function getPaymentPlan(contractId: string) {
  const session = await requirePermission("contracts:read");

  const plan = await db.paymentPlan.findFirst({
    where: { contractId, organizationId: session.organizationId },
    include: {
      installments: { orderBy: { installmentNumber: "asc" } },
    },
  });

  if (!plan) return null;
  return JSON.parse(JSON.stringify(plan));
}

export async function recordInstallmentPayment(
  installmentId: string,
  data: { amount: number; paymentMethod?: string; referenceNumber?: string }
) {
  const session = await requirePermission("finance:write");

  const installment = await db.paymentPlanInstallment.findFirst({
    where: { id: installmentId },
    include: { paymentPlan: true },
  });
  if (!installment) throw new Error("Payment installment not found. Please refresh the page and try again.");

  // Verify org access
  const plan = await db.paymentPlan.findFirst({
    where: { id: installment.paymentPlanId, organizationId: session.organizationId },
  });
  if (!plan) throw new Error("Payment plan not found. Please verify the contract has an associated payment plan.");

  const newPaidAmount = Number(installment.paidAmount ?? 0) + data.amount;
  const installmentAmount = Number(installment.amount);
  const newStatus = newPaidAmount >= installmentAmount ? "PAID" : "PARTIALLY_PAID";

  const updated = await db.paymentPlanInstallment.update({
    where: { id: installmentId },
    data: {
      paidAmount: newPaidAmount,
      paidAt: newStatus === "PAID" ? new Date() : undefined,
      status: newStatus as any,
      paymentMethod: data.paymentMethod,
      referenceNumber: data.referenceNumber,
    },
  });

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "UPDATE",
    resource: "PaymentPlanInstallment",
    resourceId: installmentId,
    before: { paidAmount: Number(installment.paidAmount ?? 0), status: installment.status },
    after: { paidAmount: newPaidAmount, status: newStatus },
    metadata: { paymentAmount: data.amount },
    organizationId: session.organizationId,
  });

  // Check if all installments are paid → complete the plan
  const allInstallments = await db.paymentPlanInstallment.findMany({
    where: { paymentPlanId: plan.id },
  });
  const allPaid = allInstallments.every((i) => i.status === "PAID" || (i.id === installmentId && newStatus === "PAID"));
  if (allPaid) {
    await db.paymentPlan.update({
      where: { id: plan.id },
      data: { status: "COMPLETED_PLAN" },
    });
  }

  return JSON.parse(JSON.stringify(updated));
}

export async function getPaymentPlanSummary(contractId: string) {
  const session = await requirePermission("contracts:read");

  const plan = await db.paymentPlan.findFirst({
    where: { contractId, organizationId: session.organizationId },
    include: { installments: { orderBy: { dueDate: "asc" } } },
  });

  if (!plan) return null;

  const totalPaid = plan.installments.reduce((sum, i) => sum + Number(i.paidAmount ?? 0), 0);
  const totalAmount = Number(plan.totalAmount);
  const totalRemaining = totalAmount - totalPaid;
  const now = new Date();
  const nextDue = plan.installments.find((i) => i.status !== "PAID" && new Date(i.dueDate) >= now);
  const overdueCount = plan.installments.filter(
    (i) => i.status !== "PAID" && new Date(i.dueDate) < now
  ).length;

  return {
    totalPaid,
    totalRemaining,
    totalAmount,
    nextDue: nextDue ? { dueDate: nextDue.dueDate, amount: Number(nextDue.amount) } : null,
    overdueCount,
    installmentCount: plan.installments.length,
    paidCount: plan.installments.filter((i) => i.status === "PAID").length,
  };
}
