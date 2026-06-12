import { describe, expect, it } from "vitest";

import { bucketInvoices, type AgingInvoice } from "./ar-aging";

const MS_PER_DAY = 86_400_000;
const ASOF = new Date("2026-06-12T12:00:00.000Z");

function dueDaysAgo(days: number): Date {
  return new Date(ASOF.getTime() - days * MS_PER_DAY);
}

function inv(total: number, dueDate: Date | null): AgingInvoice {
  return { total, dueDate };
}

describe("bucketInvoices — exact boundaries", () => {
  it("due exactly 30 days before asOf lands in 0-30", () => {
    const r = bucketInvoices([inv(100, dueDaysAgo(30))], ASOF);
    expect(r.buckets["0-30"]).toBe(100);
    expect(r.buckets["31-60"]).toBe(0);
  });

  it("due exactly 31 days before asOf lands in 31-60", () => {
    const r = bucketInvoices([inv(100, dueDaysAgo(31))], ASOF);
    expect(r.buckets["0-30"]).toBe(0);
    expect(r.buckets["31-60"]).toBe(100);
  });

  it("due exactly 60 days before asOf lands in 31-60", () => {
    const r = bucketInvoices([inv(100, dueDaysAgo(60))], ASOF);
    expect(r.buckets["31-60"]).toBe(100);
    expect(r.buckets["61-90"]).toBe(0);
  });

  it("due exactly 61 days before asOf lands in 61-90", () => {
    const r = bucketInvoices([inv(100, dueDaysAgo(61))], ASOF);
    expect(r.buckets["31-60"]).toBe(0);
    expect(r.buckets["61-90"]).toBe(100);
  });

  it("due exactly 90 days before asOf lands in 61-90", () => {
    const r = bucketInvoices([inv(100, dueDaysAgo(90))], ASOF);
    expect(r.buckets["61-90"]).toBe(100);
    expect(r.buckets["90+"]).toBe(0);
  });

  it("due exactly 91 days before asOf lands in 90+", () => {
    const r = bucketInvoices([inv(100, dueDaysAgo(91))], ASOF);
    expect(r.buckets["61-90"]).toBe(0);
    expect(r.buckets["90+"]).toBe(100);
  });
});

describe("bucketInvoices — day 0 and future due dates", () => {
  it("due today (day 0) lands in 0-30", () => {
    const r = bucketInvoices([inv(50, dueDaysAgo(0))], ASOF);
    expect(r.buckets["0-30"]).toBe(50);
    expect(r.totalSarGross).toBe(50);
  });

  it("future dueDate (negative day diff) lands in 0-30 — pinned original behavior", () => {
    // days = Math.floor(negative / MS_PER_DAY) <= 30, so the original loop
    // routed not-yet-due invoices into "0-30". The action's Prisma query
    // (dueDate < asOf) normally prevents this input, but the math is pinned.
    const r = bucketInvoices([inv(75, dueDaysAgo(-10))], ASOF);
    expect(r.buckets["0-30"]).toBe(75);
    expect(r.buckets["31-60"]).toBe(0);
    expect(r.buckets["61-90"]).toBe(0);
    expect(r.buckets["90+"]).toBe(0);
    expect(r.totalSarGross).toBe(75);
  });
});

describe("bucketInvoices — floor behavior", () => {
  it("29.9 days overdue floors to day 29 → 0-30", () => {
    const r = bucketInvoices([inv(100, dueDaysAgo(29.9))], ASOF);
    expect(r.buckets["0-30"]).toBe(100);
  });

  it("30.9 days overdue floors to day 30 → still 0-30", () => {
    const r = bucketInvoices([inv(100, dueDaysAgo(30.9))], ASOF);
    expect(r.buckets["0-30"]).toBe(100);
    expect(r.buckets["31-60"]).toBe(0);
  });

  it("60.5 days overdue floors to day 60 → still 31-60", () => {
    const r = bucketInvoices([inv(100, dueDaysAgo(60.5))], ASOF);
    expect(r.buckets["31-60"]).toBe(100);
  });
});

describe("bucketInvoices — null handling, empty input, totals", () => {
  it("skips rows with null dueDate (excluded from grand total too)", () => {
    const r = bucketInvoices([inv(999, null), inv(100, dueDaysAgo(5))], ASOF);
    expect(r.buckets["0-30"]).toBe(100);
    expect(r.totalSarGross).toBe(100);
  });

  it("empty input returns all zeros", () => {
    const r = bucketInvoices([], ASOF);
    expect(r.buckets).toEqual({ "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 });
    expect(r.totalSarGross).toBe(0);
  });

  it("grand total equals the sum of all buckets", () => {
    const r = bucketInvoices(
      [
        inv(10, dueDaysAgo(1)),
        inv(20, dueDaysAgo(45)),
        inv(30, dueDaysAgo(75)),
        inv(40, dueDaysAgo(120)),
        inv(5, dueDaysAgo(30)),
      ],
      ASOF,
    );
    const bucketSum =
      r.buckets["0-30"] + r.buckets["31-60"] + r.buckets["61-90"] + r.buckets["90+"];
    expect(bucketSum).toBe(105);
    expect(r.totalSarGross).toBe(bucketSum);
  });

  it("sums multiple invoices into the same bucket", () => {
    const r = bucketInvoices([inv(100, dueDaysAgo(95)), inv(200, dueDaysAgo(400))], ASOF);
    expect(r.buckets["90+"]).toBe(300);
    expect(r.totalSarGross).toBe(300);
  });
});
