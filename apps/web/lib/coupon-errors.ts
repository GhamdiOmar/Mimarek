/**
 * Typed coupon failure so `applyCoupon` can signal a STABLE reason code instead
 * of a prose string. `applyCouponByCode` reads `err.reason` directly (no brittle
 * message regex — the /mimaric-qa M1 finding) and the client maps the code to
 * bilingual copy. Lives in a plain module because a `"use server"` file may only
 * export async functions (AGENTS.md §4).
 *
 * The human `message` is preserved (and kept identical to the prior throw text)
 * so the existing `applyCoupon` unit tests that assert on the message still pass.
 */
export type CouponReason =
  | "INVALID"
  | "NO_INVOICE"
  | "ALREADY_USED"
  | "ALREADY_COUPONED"
  | "INVOICE_NOT_OPEN"
  | "INACTIVE"
  | "NOT_YET_VALID"
  | "EXPIRED"
  | "MAX_REDEEMED"
  | "WRONG_PLAN"
  | "WRONG_CYCLE"
  | "MIN_PURCHASE"
  | "FAILED";

export class CouponError extends Error {
  readonly reason: CouponReason;
  constructor(reason: CouponReason, message: string) {
    super(message);
    this.name = "CouponError";
    this.reason = reason;
  }
}
