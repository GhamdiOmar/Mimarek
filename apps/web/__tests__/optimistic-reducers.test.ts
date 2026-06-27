import { describe, it, expect } from "vitest";
import { paymentReducer } from "../app/dashboard/payments/optimistic";
import type { RentInstallment } from "../app/dashboard/payments/PaymentsView";
import { reservationReducer } from "../app/dashboard/reservations/optimistic";
import type { Reservation } from "../app/dashboard/reservations/ReservationsView";

// `import type` above is erased at runtime, so these imports never pull the heavy "use client" Views.

function installment(over: Partial<RentInstallment> & { id: string }): RentInstallment {
  return {
    dueDate: "2026-01-01",
    amount: 1000,
    paidAmount: null,
    status: "UNPAID",
    paidAt: null,
    paymentMethod: null,
    leaseId: "lease-1",
    lease: { customer: { id: "c1", name: "Cust" }, unit: { number: "101", buildingName: null } },
    ...over,
  };
}

function reservation(over: Partial<Reservation> & { id: string }): Reservation {
  return {
    status: "PENDING",
    amount: 5000,
    depositAmount: null,
    expiresAt: "2026-02-01",
    createdAt: "2026-01-01",
    customer: { id: "c1", name: "Cust" },
    unit: { id: "u1", number: "101", buildingName: null },
    ...over,
  };
}

describe("paymentReducer (optimistic mark-paid)", () => {
  it("flips only the targeted ids to PAID with paidAmount = amount", () => {
    const rows = [installment({ id: "a", amount: 100 }), installment({ id: "b", amount: 200 })];
    const next = paymentReducer(rows, { type: "markPaid", ids: ["a"] });
    expect(next.find((r) => r.id === "a")).toMatchObject({ status: "PAID", paidAmount: 100 });
    // untouched row keeps its original status + paidAmount
    expect(next.find((r) => r.id === "b")).toMatchObject({ status: "UNPAID", paidAmount: null });
  });

  it("marks several rows at once (bulk)", () => {
    const rows = [installment({ id: "a" }), installment({ id: "b" }), installment({ id: "c" })];
    const next = paymentReducer(rows, { type: "markPaid", ids: ["a", "c"] });
    expect(next.filter((r) => r.status === "PAID").map((r) => r.id)).toEqual(["a", "c"]);
    expect(next.find((r) => r.id === "b")?.status).toBe("UNPAID");
  });

  it("is a no-op for an empty id list", () => {
    const rows = [installment({ id: "a" })];
    expect(paymentReducer(rows, { type: "markPaid", ids: [] })).toEqual(rows);
  });

  it("does not mutate the input array", () => {
    const rows = [installment({ id: "a" })];
    const snapshot = JSON.parse(JSON.stringify(rows));
    paymentReducer(rows, { type: "markPaid", ids: ["a"] });
    expect(rows).toEqual(snapshot);
  });
});

describe("paymentReducer (single applyPayment — mirrors the server decision)", () => {
  it("shows PARTIALLY_PAID for a partial payment (not a fleeting PAID)", () => {
    const rows = [installment({ id: "a", amount: 1000, paidAmount: null })];
    const next = paymentReducer(rows, { type: "applyPayment", id: "a", amount: 400 });
    expect(next[0]).toMatchObject({ status: "PARTIALLY_PAID", paidAmount: 400 });
  });

  it("shows PAID when the payment settles the full amount", () => {
    const rows = [installment({ id: "a", amount: 1000, paidAmount: null })];
    const next = paymentReducer(rows, { type: "applyPayment", id: "a", amount: 1000 });
    expect(next[0]).toMatchObject({ status: "PAID", paidAmount: 1000 });
  });

  it("accumulates onto a prior partial payment", () => {
    const rows = [installment({ id: "a", amount: 1000, paidAmount: 600, status: "PARTIALLY_PAID" })];
    const next = paymentReducer(rows, { type: "applyPayment", id: "a", amount: 400 });
    expect(next[0]).toMatchObject({ status: "PAID", paidAmount: 1000 });
  });

  it("does not optimistically change an already-PAID row (server rejects)", () => {
    const rows = [installment({ id: "a", amount: 1000, paidAmount: 1000, status: "PAID" })];
    expect(paymentReducer(rows, { type: "applyPayment", id: "a", amount: 100 })).toEqual(rows);
  });

  it("does not optimistically change on overpay (server rejects)", () => {
    const rows = [installment({ id: "a", amount: 1000, paidAmount: 0 })];
    expect(paymentReducer(rows, { type: "applyPayment", id: "a", amount: 1500 })).toEqual(rows);
  });
});

describe("reservationReducer (optimistic status change)", () => {
  it("sets status only on the matching reservation", () => {
    const rows = [reservation({ id: "x" }), reservation({ id: "y" })];
    const next = reservationReducer(rows, { id: "x", status: "CONFIRMED" });
    expect(next.find((r) => r.id === "x")?.status).toBe("CONFIRMED");
    expect(next.find((r) => r.id === "y")?.status).toBe("PENDING");
  });

  it("supports CANCELLED transitions", () => {
    const rows = [reservation({ id: "x" })];
    expect(reservationReducer(rows, { id: "x", status: "CANCELLED" })[0]?.status).toBe("CANCELLED");
  });

  it("no-ops for an unknown id", () => {
    const rows = [reservation({ id: "x" })];
    expect(reservationReducer(rows, { id: "zzz", status: "CANCELLED" })).toEqual(rows);
  });
});
