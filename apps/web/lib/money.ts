/**
 * Pure money helpers — NO "use server".
 *
 * This module is the single home for the canonical money-correctness formulas
 * that were previously duplicated inline across finance.ts and the
 * payment-correctness e2e test. Keep it free of side effects and server-only
 * imports so it can be imported by both server actions and plain test scripts.
 */

/**
 * effectivePaid — canonical "how much of this installment has actually been
 * collected" rule (spec §4).
 *
 * - PAID rows: legacy/seed rows may carry a NULL `paidAmount` even though they
 *   were fully settled, so a PAID row with NULL paidAmount counts the full
 *   `amount`.
 * - Non-PAID rows (UNPAID / PARTIALLY_PAID / OVERDUE): count only what was
 *   recorded in `paidAmount`, defaulting to 0.
 *
 * `amount` / `paidAmount` are accepted as `any` because callers pass Prisma
 * `Decimal`, stringified Decimals, or plain numbers — `Number(...)` normalizes
 * all three.
 */
export function effectivePaid(r: {
  status: string;
  amount: any;
  paidAmount: any;
}): number {
  return r.status === "PAID"
    ? Number(r.paidAmount ?? r.amount)
    : Number(r.paidAmount ?? 0);
}
