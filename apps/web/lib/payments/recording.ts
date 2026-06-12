export type PaymentApplication =
  | { kind: "reject"; reason: "ALREADY_PAID" }
  | { kind: "reject"; reason: "OVERPAY"; remaining: string }
  | { kind: "apply"; newStatus: "PAID" | "PARTIALLY_PAID"; newPaidAmount: number };

export function decidePaymentApplication(
  installment: { status: string; amount: number; paidAmount: number },
  payAmount: number
): PaymentApplication {
  // (3) Already fully paid guard
  if (installment.status === "PAID") {
    return { kind: "reject", reason: "ALREADY_PAID" };
  }

  // (4) Accumulate
  const installmentAmount = installment.amount;
  const priorPaid = installment.paidAmount;
  const newPaidAmount = priorPaid + payAmount;

  // (5) Overpay guard (+0.005 tolerance)
  if (newPaidAmount > installmentAmount + 0.005) {
    const remaining = (installmentAmount - priorPaid).toFixed(2);
    return { kind: "reject", reason: "OVERPAY", remaining };
  }

  // (6) Determine new status (-0.005 threshold for PAID)
  const newStatus =
    newPaidAmount >= installmentAmount - 0.005 ? "PAID" : "PARTIALLY_PAID";

  return { kind: "apply", newStatus, newPaidAmount };
}
