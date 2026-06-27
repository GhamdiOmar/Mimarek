import { describe, it, expect } from "vitest";
import { effectivePaid } from "../lib/money";
describe("effectivePaid (spec §4)", () => {
  it("PAID with null paidAmount counts the full amount", () => expect(effectivePaid({ status: "PAID", amount: 1000, paidAmount: null })).toBe(1000));
  it("PAID with paidAmount counts paidAmount", () => expect(effectivePaid({ status: "PAID", amount: 1000, paidAmount: 800 })).toBe(800));
  it("OVERDUE partial counts paidAmount", () => expect(effectivePaid({ status: "OVERDUE", amount: 1000, paidAmount: 200 })).toBe(200));
  it("UNPAID with null counts 0", () => expect(effectivePaid({ status: "UNPAID", amount: 1000, paidAmount: null })).toBe(0));
});
