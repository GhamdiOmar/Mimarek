import { describe, it, expect } from "vitest";
import { boundaryMrrEvent, subscriptionMrr } from "../lib/payment/arr-events";

// ARR-waterfall reconciliation: SubscriptionMrrSnapshot (and thus ARR) counts
// status=ACTIVE only, so a status transition moves ARR ⇔ it crosses the ACTIVE
// boundary. getArrWaterfall reconciles |starting + ΣmrrDeltaSar − ending| ≤ 1,
// summing NEW + EXPANSION + CONTRACTION + CHURN + REACTIVATION + REFUND_ADJ.
// These lock the category/sign so every churn/reactivation path reconciles.

describe("boundaryMrrEvent — ACTIVE-boundary crossing → ARR event", () => {
  it("ACTIVE → CANCELED books CHURN at −mrr", () => {
    expect(boundaryMrrEvent("ACTIVE", "CANCELED", 499)).toEqual({ eventCategory: "CHURN", mrrDeltaSar: -499 });
  });

  it("ACTIVE → PAUSED books CHURN at −mrr (paused subs leave the active ARR base)", () => {
    expect(boundaryMrrEvent("ACTIVE", "PAUSED", 499)).toEqual({ eventCategory: "CHURN", mrrDeltaSar: -499 });
  });

  it("ACTIVE → PAST_DUE books CHURN at −mrr (past-due is excluded from the active base)", () => {
    expect(boundaryMrrEvent("ACTIVE", "PAST_DUE", 499)).toEqual({ eventCategory: "CHURN", mrrDeltaSar: -499 });
  });

  it("PAUSED → ACTIVE books REACTIVATION at +mrr", () => {
    expect(boundaryMrrEvent("PAUSED", "ACTIVE", 499)).toEqual({ eventCategory: "REACTIVATION", mrrDeltaSar: 499 });
  });

  it("PAST_DUE → ACTIVE (recovery) books REACTIVATION at +mrr", () => {
    expect(boundaryMrrEvent("PAST_DUE", "ACTIVE", 499)).toEqual({ eventCategory: "REACTIVATION", mrrDeltaSar: 499 });
  });

  it("TRIALING → ACTIVE (conversion) books NEW at +mrr, not REACTIVATION", () => {
    expect(boundaryMrrEvent("TRIALING", "ACTIVE", 499)).toEqual({ eventCategory: "NEW", mrrDeltaSar: 499 });
  });

  it("PAST_DUE → CANCELED books nothing — no double-count (the −mrr was booked on ACTIVE→PAST_DUE)", () => {
    expect(boundaryMrrEvent("PAST_DUE", "CANCELED", 499)).toEqual({});
  });

  it("PAUSED → CANCELED books nothing (already left the active base on pause)", () => {
    expect(boundaryMrrEvent("PAUSED", "CANCELED", 499)).toEqual({});
  });

  it("TRIALING → CANCELED books nothing (a trial never entered the ARR base)", () => {
    expect(boundaryMrrEvent("TRIALING", "CANCELED", 499)).toEqual({});
  });

  it("PAST_DUE → UNPAID books nothing (non-active ↔ non-active moves no ARR)", () => {
    expect(boundaryMrrEvent("PAST_DUE", "UNPAID", 499)).toEqual({});
  });
});

describe("subscriptionMrr — stored snapshot, else derived from renewal price", () => {
  it("prefers the stored mrrSar when present", () => {
    expect(subscriptionMrr({ mrrSar: 499, priceAtRenewal: 5988, billingCycle: "ANNUAL" })).toBe(499);
  });

  it("derives MRR from an ANNUAL renewal price (÷12)", () => {
    expect(subscriptionMrr({ mrrSar: null, priceAtRenewal: 5988, billingCycle: "ANNUAL" })).toBe(499);
  });

  it("derives MRR from a MONTHLY renewal price (÷1)", () => {
    expect(subscriptionMrr({ mrrSar: null, priceAtRenewal: 499, billingCycle: "MONTHLY" })).toBe(499);
  });

  it("treats a null price as zero MRR", () => {
    expect(subscriptionMrr({ mrrSar: null, priceAtRenewal: null, billingCycle: "MONTHLY" })).toBe(0);
  });
});
