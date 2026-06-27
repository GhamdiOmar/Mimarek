import { describe, it, expect } from "vitest";
import { computeInclusiveBreakdown } from "../lib/zatca-amounts";
describe("computeInclusiveBreakdown — ZATCA VAT-inclusive back-computation", () => {
  it("1150 @ 15% → 1000 / 150 / 1150", () => expect(computeInclusiveBreakdown(1150, 0.15)).toEqual({ subtotal: 1000, vatAmount: 150, total: 1150 }));
  it("exempt (0%) → gross passes through", () => expect(computeInclusiveBreakdown(100, 0)).toEqual({ subtotal: 100, vatAmount: 0, total: 100 }));
  it("subtotal + vat always reconciles to total", () => { const r = computeInclusiveBreakdown(100, 0.15); expect(round2(r.subtotal + r.vatAmount)).toBe(r.total); function round2(n: number) { return Math.round((n + Number.EPSILON) * 100) / 100; } });
});
