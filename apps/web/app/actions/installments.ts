"use server";

import { db } from "@repo/db";
import { Prisma } from "@repo/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "../../lib/auth-helpers";
import { logAuditEvent } from "../../lib/audit";
import { decidePaymentApplication } from "../../lib/payments/recording";

const RecordPaymentSchema = z.object({
  paymentMethod: z.string().min(1),
  amount: z.number().positive(),
  paymentDate: z.string().min(1).optional(),
  referenceNumber: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
  paymentReference: z.string().trim().min(1).max(120),
});

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
    amount: number;
    paymentDate?: string;
    referenceNumber?: string;
    notes?: string;
    paymentReference: string;
  }
) {
  const parsed = RecordPaymentSchema.safeParse(data);
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
    organizationId: string;
  };

  let txResult: {
    row: any;
    replayed: boolean;
    before: { status: string; paidAmount: number } | null;
    after: { status: string; paidAmount: number } | null;
  };

  try {
    txResult = await db.$transaction(async (tx) => {
      // (1) Idempotency short-circuit
      const prior = await tx.rentInstallment.findFirst({
        where: { id: installmentId, paymentReference: safeData.paymentReference },
        include: { lease: { include: { customer: true } } },
      });
      if (prior) {
        if (prior.lease.customer.organizationId !== session.organizationId) {
          throw new Error(
            "القسط غير موجود أو ليس لديك صلاحية الوصول إليه. / Installment not found or you do not have access to it."
          );
        }
        return { row: prior, replayed: true, before: null, after: null };
      }

      // (2) Lock row with FOR UPDATE
      const locked = await tx.$queryRaw<LockedRow[]>`
        SELECT ri.id,
               ri.amount::text AS amount,
               ri."paidAmount"::text AS "paidAmount",
               ri.status::text AS status,
               c."organizationId" AS "organizationId"
        FROM "RentInstallment" ri
        JOIN "Lease" l ON l.id = ri."leaseId"
        JOIN "Customer" c ON c.id = l."customerId"
        WHERE ri.id = ${installmentId}
        FOR UPDATE OF ri
      `;

      const row = locked[0];
      if (!row || row.organizationId !== session.organizationId) {
        throw new Error(
          "القسط غير موجود أو ليس لديك صلاحية الوصول إليه. / Installment not found or you do not have access to it."
        );
      }

      // (3)–(6) Pure payment-application decision
      const priorPaid = Number(row.paidAmount ?? 0);
      const decision = decidePaymentApplication(
        { status: row.status, amount: Number(row.amount), paidAmount: priorPaid },
        safeData.amount
      );

      if (decision.kind === "reject") {
        if (decision.reason === "ALREADY_PAID") {
          throw new Error(
            "تم تسديد هذا القسط بالكامل مسبقاً. / This installment is already fully paid."
          );
        }
        throw new Error(
          `المبلغ يتجاوز المتبقّي المستحق (${decision.remaining} ريال). / Amount exceeds the remaining balance due (${decision.remaining} SAR).`
        );
      }

      // (7) Write — paidAmount ALWAYS written with status
      const updated = await tx.rentInstallment.update({
        where: { id: installmentId },
        data: {
          status: decision.newStatus as any,
          paidAmount: decision.newPaidAmount,
          paidAt: paidAtDate,
          paymentMethod: safeData.paymentMethod,
          referenceNumber: safeData.referenceNumber,
          notes: safeData.notes,
          paymentReference: safeData.paymentReference,
        },
      });

      return {
        row: updated,
        replayed: false,
        before: { status: row.status, paidAmount: priorPaid },
        after: { status: decision.newStatus, paidAmount: decision.newPaidAmount },
      };
    });
  } catch (e: any) {
    // P2002 race: two concurrent writes with the same paymentReference
    if (e?.code === "P2002") {
      const existing = await db.rentInstallment.findFirst({
        where: {
          id: installmentId,
          paymentReference: safeData.paymentReference,
          lease: { customer: { organizationId: session.organizationId } },
        },
      });
      if (existing) {
        revalidatePath("/dashboard/payments");
        revalidatePath("/dashboard/finance");
        return JSON.parse(JSON.stringify(existing));
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
      resource: "RentInstallment",
      resourceId: installmentId,
      before: txResult.before ?? undefined,
      after: txResult.after ?? undefined,
      metadata: {
        action: "recordPayment",
        paymentMethod: safeData.paymentMethod,
        amount: safeData.amount,
        paymentReference: safeData.paymentReference,
      },
      organizationId: session.organizationId,
    });
  }

  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard/finance");
  return JSON.parse(JSON.stringify(txResult.row));
}

// ─── CX-010: Bulk Operations ────────────────────────────────────────────────

export async function bulkMarkInstallmentsPaid(ids: string[]) {
  if (!ids.length) return { updated: 0 };
  // Gate on finance:write to match single-row recordPayment — the bulk path must
  // never be more permissive than the single-row money mutation (QA H1).
  const session = await requirePermission("finance:write");

  // Verify all installments belong to the org via lease → customer → organizationId
  const installments = await db.rentInstallment.findMany({
    where: {
      id: { in: ids },
      lease: { customer: { organizationId: session.organizationId } },
    },
    include: {
      lease: { include: { customer: true } },
    },
  });

  if (installments.length !== ids.length) {
    throw new Error(
      "One or more installments do not belong to your organization. Please refresh and try again."
    );
  }

  // Skip already-paid installments gracefully
  const payable = installments.filter((i) => i.status !== "PAID");
  if (!payable.length) return { updated: 0 };

  const now = new Date();

  const updated = await db.$transaction(
    payable.map((inst) =>
      db.rentInstallment.update({
        where: { id: inst.id },
        data: {
          status: "PAID",
          // AGENTS §4: always write paidAmount alongside status
          paidAmount: inst.amount,
          paidAt: now,
        },
      })
    )
  );

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "UPDATE",
    resource: "RentInstallment",
    resourceId: "bulk",
    metadata: {
      action: "bulkMarkPaid",
      count: updated.length,
      ids: payable.map((i) => i.id),
    },
    organizationId: session.organizationId,
  });

  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard/finance");
  return { updated: updated.length };
}

export async function markOverdueInstallments() {
  const session = await requirePermission("finance:write");

  const result = await db.rentInstallment.updateMany({
    where: {
      status: { in: ["UNPAID", "PARTIALLY_PAID"] },
      dueDate: { lt: new Date() },
      lease: { customer: { organizationId: session.organizationId } },
    },
    data: { status: "OVERDUE" },
  });

  revalidatePath("/dashboard/payments");
  return result.count;
}
