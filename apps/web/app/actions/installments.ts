"use server";

import { db } from "@repo/db";
import { Prisma, PaymentStatus, type RentInstallment } from "@repo/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "../../lib/auth-helpers";
import { logAuditEvent } from "../../lib/audit";
import { decidePaymentApplication } from "../../lib/payments/recording";
import { appendRentPayment } from "../../lib/payments/ledger";
import { ROUTES } from "../../lib/routes";
import { serialize } from "../../lib/serialize";
import { issueForChargeBestEffort, issueCreditNoteForRentReversalBestEffort } from "../../lib/zatca-issuance";

const RecordPaymentSchema = z.object({
  paymentMethod: z.string().min(1),
  amount: z.number().positive(),
  paymentDate: z.string().min(1).optional(),
  referenceNumber: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
  paymentReference: z.string().trim().min(1).max(120),
});

const ReversePaymentSchema = z.object({
  amount: z.number().positive(),
  reason: z.string().trim().min(1).max(1000),
  idempotencyKey: z.string().trim().min(1).max(120),
  txType: z.enum(["REVERSAL", "REFUND"]).default("REVERSAL"),
});

export async function getInstallments(filters?: {
  status?: string;
  leaseId?: string;
}) {
  const session = await requirePermission("finance:read");

  const where: Prisma.RentInstallmentWhereInput = {
    lease: { customer: { organizationId: session.organizationId } },
  };

  if (filters?.status) {
    where.status = filters.status as PaymentStatus;
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
  return serialize(results);
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
    leaseId: string;
    amount: string;
    paidAmount: string | null;
    status: string;
    organizationId: string;
  };

  let txResult: {
    row: RentInstallment;
    replayed: boolean;
    before: { status: string; paidAmount: number } | null;
    after: { status: string; paidAmount: number } | null;
  };

  try {
    txResult = await db.$transaction(async (tx) => {
      // (1) Idempotency short-circuit — now on the immutable ledger row keyed by
      //     [installmentId, idempotencyKey]. The idempotencyKey IS the
      //     paymentReference, so a same-reference re-submit replays the cached
      //     installment without appending a second ledger row.
      const priorPayment = await tx.rentPayment.findUnique({
        where: {
          installmentId_idempotencyKey: {
            installmentId,
            idempotencyKey: safeData.paymentReference,
          },
        },
        include: {
          installment: {
            include: { lease: { include: { customer: true } } },
          },
        },
      });
      if (priorPayment) {
        if (
          priorPayment.installment.lease.customer.organizationId !==
          session.organizationId
        ) {
          throw new Error(
            "القسط غير موجود أو ليس لديك صلاحية الوصول إليه. / Installment not found or you do not have access to it."
          );
        }
        return {
          row: priorPayment.installment,
          replayed: true,
          before: null,
          after: null,
        };
      }

      // (2) Lock row with FOR UPDATE
      const locked = await tx.$queryRaw<LockedRow[]>`
        SELECT ri.id,
               ri."leaseId" AS "leaseId",
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

      // (3)–(6) Pure payment-application decision (guards unchanged)
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

      // (7) Append the immutable ledger row + recompute the cache. We also keep
      //     writing the "last payment" denormalized fields (paidAt / method /
      //     referenceNumber / paymentReference / notes) onto the installment so
      //     existing list views that read those don't regress.
      await appendRentPayment(tx, {
        installmentId,
        leaseId: row.leaseId,
        installmentAmount: Number(row.amount),
        amount: safeData.amount,
        txType: "PAYMENT",
        idempotencyKey: safeData.paymentReference,
        channel: safeData.paymentMethod,
        reference: safeData.referenceNumber,
        notes: safeData.notes,
        createdById: session.userId,
        lastPaymentMeta: {
          paidAt: paidAtDate,
          paymentMethod: safeData.paymentMethod,
          referenceNumber: safeData.referenceNumber,
          paymentReference: safeData.paymentReference,
          notes: safeData.notes,
        },
      });

      // Re-read the cache-updated installment for the returned row.
      const updated = await tx.rentInstallment.findUniqueOrThrow({
        where: { id: installmentId },
      });

      return {
        row: updated,
        replayed: false,
        before: { status: row.status, paidAmount: priorPaid },
        after: { status: decision.newStatus, paidAmount: decision.newPaidAmount },
      };
    });
  } catch (e: unknown) {
    // P2002 race: two concurrent appends with the same [installmentId,
    // idempotencyKey] — the loser re-fetches the installment (org-scoped) and
    // returns it as a replay.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const existing = await db.rentInstallment.findFirst({
        where: {
          id: installmentId,
          lease: { customer: { organizationId: session.organizationId } },
        },
      });
      if (existing) {
        revalidatePath(ROUTES.payments);
        revalidatePath(ROUTES.finance);
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

  // ZATCA Track C (R4 / H1): issue the tenant document for this rent payment — best-effort,
  // post-commit, NEVER blocks the payment (L26). Residential → receipt; commercial → invoice.
  if (!txResult.replayed && session.organizationId) {
    await issueForChargeBestEffort({
      kind: "RENT_INSTALLMENT",
      organizationId: session.organizationId,
      rentInstallmentId: installmentId,
      amount: safeData.amount,
      sourceKey: safeData.paymentReference,
    });
  }

  revalidatePath(ROUTES.payments);
  revalidatePath(ROUTES.finance);
  return serialize(txResult.row);
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

  // Skip already-paid installments gracefully (the org-scope/existence check is
  // the snapshot's only job — the authoritative amount/lock is re-read in-tx below).
  const payable = installments.filter((i) => i.status !== "PAID");
  if (!payable.length) return { updated: 0 };

  const now = new Date();

  type LockedRow = {
    id: string;
    leaseId: string;
    amount: string;
    paidAmount: string | null;
    status: string;
    organizationId: string;
  };

  // Append a PAYMENT for the REMAINING amount of each payable installment inside
  // one interactive transaction. Each row is RE-READ `FOR UPDATE` inside the tx and
  // its remaining is recomputed from the LOCKED snapshot (mirrors the single-row
  // recordPayment) — a concurrent recordPayment is serialized by the row lock, so
  // the bulk path can never over-collect above face value (QA H-2). The idempotency
  // key is DETERMINISTIC — `bulk:<id>:<lockedPaidAmount>` — so a rapid double-submit
  // of the same batch dedupes: the 2nd attempt either finds remaining<=0 and skips,
  // or collides on the [installmentId, idempotencyKey] unique index (P2002 → no-op
  // replay) for the same starting state (QA M-3).
  const applied = await db.$transaction(async (tx) => {
    const done: { id: string; amount: number; sourceKey: string }[] = [];
    for (const inst of payable) {
      // Re-read + lock the row inside the tx; org-scope re-checked on the locked row.
      const locked = await tx.$queryRaw<LockedRow[]>`
        SELECT ri.id,
               ri."leaseId" AS "leaseId",
               ri.amount::text AS amount,
               ri."paidAmount"::text AS "paidAmount",
               ri.status::text AS status,
               c."organizationId" AS "organizationId"
        FROM "RentInstallment" ri
        JOIN "Lease" l ON l.id = ri."leaseId"
        JOIN "Customer" c ON c.id = l."customerId"
        WHERE ri.id = ${inst.id}
        FOR UPDATE OF ri
      `;
      const row = locked[0];
      // Foreign-org or vanished row — skip (the pre-check already proved org scope;
      // this is defense-in-depth against a row that moved/changed between read & lock).
      if (!row || row.organizationId !== session.organizationId) continue;

      const amount = Number(row.amount);
      const lockedPaidAmount = Number(row.paidAmount ?? 0);
      const remaining = amount - lockedPaidAmount;
      // Nothing left to collect (already settled within tolerance) — skip.
      if (remaining <= 0.005) continue;

      try {
        await appendRentPayment(tx, {
          installmentId: row.id,
          leaseId: row.leaseId,
          installmentAmount: amount,
          amount: remaining,
          txType: "PAYMENT",
          idempotencyKey: `bulk:${row.id}:${lockedPaidAmount}`,
          channel: "BULK",
          createdById: session.userId,
          lastPaymentMeta: { paidAt: now },
        });
        done.push({ id: row.id, amount: remaining, sourceKey: `bulk:${row.id}:${lockedPaidAmount}` });
      } catch (e: unknown) {
        // Duplicate append for the same [installmentId, idempotencyKey] (a rapid
        // double-submit of the same batch in the same state) — treat as a no-op
        // replay: do NOT count it as a fresh collection.
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
          continue;
        throw e;
      }
    }
    return done;
  });

  if (!applied.length) return { updated: 0 };

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "UPDATE",
    resource: "RentInstallment",
    resourceId: "bulk",
    metadata: {
      action: "bulkMarkPaid",
      count: applied.length,
      ids: applied.map((a) => a.id),
    },
    organizationId: session.organizationId,
  });

  // ZATCA Track C (R4 / H2): issue a tenant document for EACH bulk-collected installment —
  // no skip. Best-effort; never blocks (L26). Parallel (allSettled — the wrappers never throw)
  // so a large batch doesn't serialize N ZATCA round-trips. Same sourceKey as the ledger dedup.
  if (session.organizationId) {
    const orgId = session.organizationId;
    await Promise.allSettled(
      applied.map((a) =>
        issueForChargeBestEffort({
          kind: "RENT_INSTALLMENT",
          organizationId: orgId,
          rentInstallmentId: a.id,
          amount: a.amount,
          sourceKey: a.sourceKey,
        }),
      ),
    );
  }

  revalidatePath(ROUTES.payments);
  revalidatePath(ROUTES.finance);
  return { updated: applied.length };
}

// ─── I2: Reversal / Refund ──────────────────────────────────────────────────

/**
 * Append a NEGATIVE ledger row against an installment to reverse or refund a
 * prior collection. Same transaction/lock shape as recordPayment. The recomputed
 * ledger SUM may not drop below -0.005 (a reversal can at most zero out what was
 * collected — never go net-negative).
 */
export async function reverseRentPayment(
  installmentId: string,
  data: {
    amount: number;
    reason: string;
    idempotencyKey: string;
    txType?: "REVERSAL" | "REFUND";
  }
) {
  // Permission gate FIRST (codebase convention) — an unauthorized caller is
  // rejected before any input validation runs.
  const session = await requirePermission("finance:write");

  const parsed = ReversePaymentSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(
      "تعذّر عكس الدفعة: تحقق من المبلغ والسبب. / Could not reverse the payment: please check the amount and reason."
    );
  }
  const safeData = parsed.data;

  type LockedRow = {
    id: string;
    leaseId: string;
    amount: string;
    paidAmount: string | null;
    status: string;
    organizationId: string;
  };

  let txResult: {
    row: RentInstallment;
    replayed: boolean;
    before: { status: string; paidAmount: number } | null;
    after: { status: string; paidAmount: number } | null;
  };

  try {
    txResult = await db.$transaction(async (tx) => {
      // (1) Idempotency short-circuit on the immutable ledger row.
      const priorPayment = await tx.rentPayment.findUnique({
        where: {
          installmentId_idempotencyKey: {
            installmentId,
            idempotencyKey: safeData.idempotencyKey,
          },
        },
        include: {
          installment: {
            include: { lease: { include: { customer: true } } },
          },
        },
      });
      if (priorPayment) {
        if (
          priorPayment.installment.lease.customer.organizationId !==
          session.organizationId
        ) {
          throw new Error(
            "القسط غير موجود أو ليس لديك صلاحية الوصول إليه. / Installment not found or you do not have access to it."
          );
        }
        return {
          row: priorPayment.installment,
          replayed: true,
          before: null,
          after: null,
        };
      }

      // (2) Lock row with FOR UPDATE
      const locked = await tx.$queryRaw<LockedRow[]>`
        SELECT ri.id,
               ri."leaseId" AS "leaseId",
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

      // (3) Guard: the post-reversal ledger SUM may not go net-negative.
      const priorPaid = Number(row.paidAmount ?? 0);
      const projectedSum = priorPaid - safeData.amount;
      if (projectedSum < -0.005) {
        throw new Error(
          `مبلغ العكس يتجاوز المبلغ المُحصّل (${priorPaid} ريال). / Reversal exceeds the collected amount (${priorPaid} SAR).`
        );
      }

      // (4) Append the NEGATIVE ledger row + recompute the cache. No
      //     last-payment denorm write — a reversal/refund is not a "last payment".
      const { newPaidAmount, newStatus } = await appendRentPayment(tx, {
        installmentId,
        leaseId: row.leaseId,
        installmentAmount: Number(row.amount),
        amount: -safeData.amount,
        txType: safeData.txType,
        idempotencyKey: safeData.idempotencyKey,
        channel: safeData.txType,
        reference: safeData.reason,
        notes: safeData.reason,
        createdById: session.userId,
      });

      const updated = await tx.rentInstallment.findUniqueOrThrow({
        where: { id: installmentId },
      });

      return {
        row: updated,
        replayed: false,
        before: { status: row.status, paidAmount: priorPaid },
        after: { status: newStatus, paidAmount: newPaidAmount },
      };
    });
  } catch (e: unknown) {
    // P2002 race: concurrent reversal with the same [installmentId, idempotencyKey].
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const existing = await db.rentInstallment.findFirst({
        where: {
          id: installmentId,
          lease: { customer: { organizationId: session.organizationId } },
        },
      });
      if (existing) {
        revalidatePath(ROUTES.payments);
        revalidatePath(ROUTES.finance);
        return serialize(existing);
      }
    }
    throw e;
  }

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
        action: "reverseRentPayment",
        amount: safeData.amount,
        txType: safeData.txType,
        idempotencyKey: safeData.idempotencyKey,
        reason: safeData.reason,
      },
      organizationId: session.organizationId,
    });
  }

  // ZATCA Track C (R4 / H3): a reversal/refund of a cleared rent invoice → credit note
  // (chained, verbatim positive — L23). Best-effort; never blocks the reversal (L26).
  if (!txResult.replayed && session.organizationId) {
    await issueCreditNoteForRentReversalBestEffort(session.organizationId, installmentId, safeData.reason);
  }

  revalidatePath(ROUTES.payments);
  revalidatePath(ROUTES.finance);
  return serialize(txResult.row);
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

  revalidatePath(ROUTES.payments);
  return result.count;
}
