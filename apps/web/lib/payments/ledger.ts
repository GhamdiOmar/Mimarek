/**
 * Append-only RentPayment ledger (I2) — NO "use server".
 *
 * `appendRentPayment` is the ONE write path for the immutable RentPayment ledger.
 * Every money movement against an installment (PAYMENT, REVERSAL, REFUND,
 * ADJUSTMENT) is a row here; the `RentInstallment.paidAmount` / `.status` columns
 * are a derived CACHE recomputed as `SUM(RentPayment.amount)` after each append.
 *
 * It MUST run inside a transaction whose target `RentInstallment` row is already
 * locked `FOR UPDATE` by the caller — the recompute reads the full ledger sum and
 * writes the cache, so two concurrent appends against the same installment must be
 * serialized by that row lock (the [installmentId, idempotencyKey] unique index is
 * the second line of defense against a duplicate append).
 *
 * `amount` is SIGNED: PAYMENT / ADJUSTMENT > 0, REVERSAL / REFUND < 0.
 */

import type { Prisma, RentPaymentType } from "@repo/db";

/** Derived installment status from the recomputed ledger sum vs the face amount. */
function deriveStatus(
  newPaidAmount: number,
  installmentAmount: number,
): "PAID" | "PARTIALLY_PAID" | "UNPAID" {
  if (newPaidAmount >= installmentAmount - 0.005) return "PAID";
  if (newPaidAmount > 0.005) return "PARTIALLY_PAID";
  return "UNPAID";
}

export type AppendRentPaymentArgs = {
  installmentId: string;
  leaseId: string;
  installmentAmount: number;
  /** Signed: PAYMENT/ADJUSTMENT > 0; REVERSAL/REFUND < 0. */
  amount: number;
  txType: RentPaymentType;
  idempotencyKey: string;
  channel?: string | null;
  reference?: string | null;
  notes?: string | null;
  createdById?: string | null;
  /**
   * Optional "last payment" denormalized metadata to keep writing onto the
   * RentInstallment row so existing list views that read these columns don't
   * regress. Only set on a forward PAYMENT — reversals/refunds leave them as-is.
   */
  lastPaymentMeta?: {
    paidAt?: Date;
    paymentMethod?: string | null;
    referenceNumber?: string | null;
    paymentReference?: string | null;
    notes?: string | null;
  };
};

export type AppendRentPaymentResult = {
  newPaidAmount: number;
  newStatus: "PAID" | "PARTIALLY_PAID" | "UNPAID";
};

/**
 * Insert one immutable RentPayment row, recompute the installment's cached
 * paidAmount/status from the ledger SUM, and persist the cache (plus optional
 * last-payment denorm fields). Returns the recomputed cache.
 *
 * @param tx   A Prisma transaction client (the installment row must already be locked).
 * @param args See AppendRentPaymentArgs.
 */
export async function appendRentPayment(
  tx: Prisma.TransactionClient,
  args: AppendRentPaymentArgs,
): Promise<AppendRentPaymentResult> {
  // (1) Insert the immutable ledger row.
  await tx.rentPayment.create({
    data: {
      installmentId: args.installmentId,
      leaseId: args.leaseId,
      amount: args.amount,
      txType: args.txType,
      idempotencyKey: args.idempotencyKey,
      channel: args.channel ?? null,
      reference: args.reference ?? null,
      notes: args.notes ?? null,
      createdById: args.createdById ?? null,
    },
  });

  // (2) Recompute the cache from the full ledger SUM for this installment.
  const agg = await tx.rentPayment.aggregate({
    where: { installmentId: args.installmentId },
    _sum: { amount: true },
  });
  const newPaidAmount = Number(agg._sum.amount ?? 0);

  // (3) Derive status from the recomputed sum.
  const newStatus = deriveStatus(newPaidAmount, args.installmentAmount);

  // (4) Persist the cache + optional last-payment denorm fields in one update.
  await tx.rentInstallment.update({
    where: { id: args.installmentId },
    data: {
      paidAmount: newPaidAmount,
      status: newStatus,
      ...(args.lastPaymentMeta
        ? {
            paidAt: args.lastPaymentMeta.paidAt,
            paymentMethod: args.lastPaymentMeta.paymentMethod,
            referenceNumber: args.lastPaymentMeta.referenceNumber,
            paymentReference: args.lastPaymentMeta.paymentReference,
            notes: args.lastPaymentMeta.notes,
          }
        : {}),
    },
  });

  return { newPaidAmount, newStatus };
}
