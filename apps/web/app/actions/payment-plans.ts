"use server";

import { db } from "@repo/db";
import { z } from "zod";
import { requirePermission } from "../../lib/auth-helpers";
import { logAuditEvent } from "../../lib/audit";
import { revalidatePath } from "next/cache";
import { routeToContract } from "../../lib/routes";
import { serialize } from "../../lib/serialize";

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
          organizationId: session.organizationId,
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

  revalidatePath(routeToContract(contractId));
  return serialize(plan);
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
  return serialize(plan);
}

const RecordInstallmentPaymentSchema = z.object({
  amount: z.number().positive(),
  paymentMethod: z.string().min(1).optional(),
  referenceNumber: z.string().trim().max(120).optional(),
  paymentReference: z.string().trim().min(1).max(120),
  paymentDate: z.string().min(1).optional(),
});

export async function recordInstallmentPayment(
  installmentId: string,
  data: {
    amount: number;
    paymentMethod?: string;
    referenceNumber?: string;
    paymentReference: string;
    paymentDate?: string;
  }
) {
  const parsed = RecordInstallmentPaymentSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(
      "تعذّر تسجيل الدفعة: تحقق من المبلغ وطريقة الدفع. / Could not record payment: please check the amount and payment method."
    );
  }
  const safeData = parsed.data;

  const session = await requirePermission("finance:write");

  // Resolve paidAt date
  let paidAtDate: Date;
  if (safeData.paymentDate) {
    paidAtDate = new Date(safeData.paymentDate);
    if (isNaN(paidAtDate.getTime())) {
      throw new Error(
        "تاريخ الدفع غير صالح. / The payment date is invalid."
      );
    }
  } else {
    paidAtDate = new Date();
  }

  type LockedRow = {
    id: string;
    amount: string;
    paidAmount: string | null;
    status: string;
    paymentPlanId: string;
    organizationId: string | null;
  };

  let txResult: {
    row: any;
    replayed: boolean;
    before: { status: string; paidAmount: number } | null;
    after: { status: string; paidAmount: number } | null;
    planId: string;
  };

  try {
    txResult = await db.$transaction(async (tx) => {
      // (1) Idempotency short-circuit
      const prior = await tx.paymentPlanInstallment.findFirst({
        where: { id: installmentId, paymentReference: safeData.paymentReference },
        include: { paymentPlan: true },
      });
      if (prior) {
        const orgId = prior.paymentPlan.organizationId;
        if (orgId !== session.organizationId) {
          throw new Error(
            "القسط غير موجود أو ليس لديك صلاحية الوصول إليه. / Installment not found or you do not have access to it."
          );
        }
        return {
          row: prior,
          replayed: true,
          before: null,
          after: null,
          planId: prior.paymentPlanId,
        };
      }

      // (2) Lock row with FOR UPDATE
      const locked = await tx.$queryRaw<LockedRow[]>`
        SELECT ppi.id,
               ppi.amount::text AS amount,
               ppi."paidAmount"::text AS "paidAmount",
               ppi.status::text AS status,
               ppi."paymentPlanId" AS "paymentPlanId",
               pp."organizationId" AS "organizationId"
        FROM "PaymentPlanInstallment" ppi
        JOIN "PaymentPlan" pp ON pp.id = ppi."paymentPlanId"
        WHERE ppi.id = ${installmentId}
        FOR UPDATE OF ppi
      `;

      const row = locked[0];
      if (!row || row.organizationId !== session.organizationId) {
        throw new Error(
          "القسط غير موجود أو ليس لديك صلاحية الوصول إليه. / Installment not found or you do not have access to it."
        );
      }

      // (3) Already fully paid guard
      if (row.status === "PAID") {
        throw new Error(
          "تم تسديد هذا القسط بالكامل مسبقاً. / This installment is already fully paid."
        );
      }

      // (4) Accumulate
      const installmentAmount = Number(row.amount);
      const priorPaid = Number(row.paidAmount ?? 0);
      const newPaidAmount = priorPaid + safeData.amount;

      // (5) Overpay guard
      if (newPaidAmount > installmentAmount + 0.005) {
        const remaining = (installmentAmount - priorPaid).toFixed(2);
        throw new Error(
          `المبلغ يتجاوز المتبقّي المستحق (${remaining} ريال). / Amount exceeds the remaining balance due (${remaining} SAR).`
        );
      }

      // (6) Determine new status
      const newStatus =
        newPaidAmount >= installmentAmount - 0.005 ? "PAID" : "PARTIALLY_PAID";

      // (7) Write — paidAmount + paidAt ALWAYS written with status (partial too)
      const updated = await tx.paymentPlanInstallment.update({
        where: { id: installmentId },
        data: {
          paidAmount: newPaidAmount,
          paidAt: paidAtDate,
          status: newStatus as any,
          paymentMethod: safeData.paymentMethod,
          referenceNumber: safeData.referenceNumber,
          paymentReference: safeData.paymentReference,
        },
      });

      // (8) Plan-completion rollup — inside the same transaction
      const allInstallments = await tx.paymentPlanInstallment.findMany({
        where: { paymentPlanId: row.paymentPlanId },
        select: { id: true, status: true },
      });
      const allPaid = allInstallments.every(
        (i) =>
          (i.id === installmentId && newStatus === "PAID") ||
          (i.id !== installmentId && i.status === "PAID")
      );
      if (allPaid) {
        await tx.paymentPlan.update({
          where: { id: row.paymentPlanId },
          data: { status: "COMPLETED_PLAN" },
        });
      }

      return {
        row: updated,
        replayed: false,
        before: { status: row.status, paidAmount: priorPaid },
        after: { status: newStatus, paidAmount: newPaidAmount },
        planId: row.paymentPlanId,
      };
    });
  } catch (e: any) {
    // P2002 race: two concurrent writes with the same paymentReference
    if (e?.code === "P2002") {
      const existing = await db.paymentPlanInstallment.findFirst({
        where: {
          id: installmentId,
          paymentReference: safeData.paymentReference,
          paymentPlan: { organizationId: session.organizationId },
        },
      });
      if (existing) {
        return serialize(existing);
      }
    }
    throw e;
  }

  // Audit only on non-replayed writes
  if (!txResult.replayed) {
    logAuditEvent({
      userId: session.userId,
      userEmail: session.email,
      userRole: session.role,
      action: "UPDATE",
      resource: "PaymentPlanInstallment",
      resourceId: installmentId,
      before: txResult.before ?? undefined,
      after: txResult.after ?? undefined,
      metadata: {
        paymentAmount: safeData.amount,
        paymentReference: safeData.paymentReference,
      },
      organizationId: session.organizationId,
    });
  }

  return serialize(txResult.row);
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
