// Optimistic reducer for the payments table (used with useOptimisticAction).
// `RentInstallment` is a TYPE-ONLY import (erased at runtime) so importing this module never pulls
// the heavy View. `decidePaymentApplication` is the SAME pure decision the server uses
// (lib/payments/recording.ts) — reusing it makes the optimistic projection match the server exactly,
// so a partial payment optimistically shows PARTIALLY_PAID (not a fleeting "PAID" lie).
import type { RentInstallment } from "./PaymentsView";
import { decidePaymentApplication } from "../../../lib/payments/recording";

export type PaymentPatch =
  | { type: "markPaid"; ids: string[] } // bulk mark-paid: settle the full installment amount
  | { type: "applyPayment"; id: string; amount: number }; // single record-payment: may be partial

export function paymentReducer(rows: RentInstallment[], patch: PaymentPatch): RentInstallment[] {
  if (patch.type === "markPaid") {
    const ids = new Set(patch.ids);
    return rows.map((r) =>
      ids.has(r.id) ? { ...r, status: "PAID" as const, paidAmount: r.amount } : r,
    );
  }

  // applyPayment — mirror the server's exact decision (accumulate, overpay/already-paid guards,
  // PAID vs PARTIALLY_PAID threshold). On a reject (already paid / overpay) we leave the row
  // unchanged: no optimistic flip, and the server returns the real error toast.
  return rows.map((r) => {
    if (r.id !== patch.id) return r;
    const decision = decidePaymentApplication(
      { status: r.status, amount: r.amount, paidAmount: r.paidAmount ?? 0 },
      patch.amount,
    );
    return decision.kind === "apply"
      ? { ...r, status: decision.newStatus, paidAmount: decision.newPaidAmount }
      : r;
  });
}
