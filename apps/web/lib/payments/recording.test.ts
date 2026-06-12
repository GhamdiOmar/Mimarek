import { describe, it, expect } from "vitest";
import { decidePaymentApplication } from "./recording";

describe("decidePaymentApplication", () => {
  it("full payment → PAID with exact newPaidAmount", () => {
    const decision = decidePaymentApplication(
      { status: "UNPAID", amount: 1000, paidAmount: 0 },
      1000
    );
    expect(decision).toEqual({
      kind: "apply",
      newStatus: "PAID",
      newPaidAmount: 1000,
    });
  });

  it("partial payment → PARTIALLY_PAID", () => {
    const decision = decidePaymentApplication(
      { status: "UNPAID", amount: 1000, paidAmount: 0 },
      600
    );
    expect(decision).toEqual({
      kind: "apply",
      newStatus: "PARTIALLY_PAID",
      newPaidAmount: 600,
    });
  });

  it("completing a partial (600 of 1000, pay 400) → PAID", () => {
    const decision = decidePaymentApplication(
      { status: "PARTIALLY_PAID", amount: 1000, paidAmount: 600 },
      400
    );
    expect(decision).toEqual({
      kind: "apply",
      newStatus: "PAID",
      newPaidAmount: 1000,
    });
  });

  it("overpay (600 of 1000, pay 401) → OVERPAY with remaining '400.00'", () => {
    const decision = decidePaymentApplication(
      { status: "PARTIALLY_PAID", amount: 1000, paidAmount: 600 },
      401
    );
    expect(decision).toEqual({
      kind: "reject",
      reason: "OVERPAY",
      remaining: "400.00",
    });
  });

  it("tolerance: amount 1000, pay 1000.004 → apply PAID (within +0.005)", () => {
    const decision = decidePaymentApplication(
      { status: "UNPAID", amount: 1000, paidAmount: 0 },
      1000.004
    );
    expect(decision).toEqual({
      kind: "apply",
      newStatus: "PAID",
      newPaidAmount: 1000.004,
    });
  });

  it("tolerance: pay 999.996 → PAID (>= amount - 0.005)", () => {
    const decision = decidePaymentApplication(
      { status: "UNPAID", amount: 1000, paidAmount: 0 },
      999.996
    );
    expect(decision).toEqual({
      kind: "apply",
      newStatus: "PAID",
      newPaidAmount: 999.996,
    });
  });

  it("tolerance: pay 999.99 → PARTIALLY_PAID (below amount - 0.005)", () => {
    const decision = decidePaymentApplication(
      { status: "UNPAID", amount: 1000, paidAmount: 0 },
      999.99
    );
    expect(decision).toEqual({
      kind: "apply",
      newStatus: "PARTIALLY_PAID",
      newPaidAmount: 999.99,
    });
  });

  it("status PAID + any pay → ALREADY_PAID", () => {
    const decision = decidePaymentApplication(
      { status: "PAID", amount: 1000, paidAmount: 1000 },
      0.01
    );
    expect(decision).toEqual({ kind: "reject", reason: "ALREADY_PAID" });
  });

  it("zero prior paidAmount default applies cleanly", () => {
    const decision = decidePaymentApplication(
      { status: "UNPAID", amount: 500, paidAmount: 0 },
      250
    );
    expect(decision).toEqual({
      kind: "apply",
      newStatus: "PARTIALLY_PAID",
      newPaidAmount: 250,
    });
  });

  it("remaining formatting always carries 2 decimals", () => {
    const decision = decidePaymentApplication(
      { status: "PARTIALLY_PAID", amount: 1000, paidAmount: 250.5 },
      800
    );
    expect(decision).toEqual({
      kind: "reject",
      reason: "OVERPAY",
      remaining: "749.50",
    });
  });
});
