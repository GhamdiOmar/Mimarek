import { describe, it, expect } from "vitest";
import { buildSubscriptionInvoiceLines } from "../lib/payment/invoice-lines";

// A subscription invoice = the plan line + one line per active add-on (qty ×
// snapshotted unit price). VAT is line-level (ZATCA); totals sum the lines.

const base = { planNameEn: "Professional", planNameAr: "الاحترافي", billingCycleAr: "سنوي" };

describe("buildSubscriptionInvoiceLines", () => {
  it("plan only → one line, 15% VAT", () => {
    const r = buildSubscriptionInvoiceLines({ ...base, billingCycle: "ANNUAL", planPrice: 4790, addOns: [] });
    expect(r.lineItems).toHaveLength(1);
    expect(r.lineItems[0]).toMatchObject({ unitPrice: 4790, quantity: 1, sortOrder: 0 });
    expect(r.subtotal).toBe(4790);
    expect(r.vatAmount).toBe(718.5); // 4790 × 0.15
    expect(r.total).toBe(5508.5);
  });

  it("plan + one add-on → two lines, summed totals (line-level VAT)", () => {
    const r = buildSubscriptionInvoiceLines({
      ...base, billingCycle: "MONTHLY", planPrice: 499,
      addOns: [{ nameEn: "Extra Users +5", nameAr: "مستخدمون", quantity: 1, unitPrice: 49 }],
    });
    expect(r.lineItems).toHaveLength(2);
    expect(r.lineItems[1]).toMatchObject({ description: "Extra Users +5", unitPrice: 49, quantity: 1, sortOrder: 1 });
    expect(r.subtotal).toBe(548); // 499 + 49
    expect(r.vatAmount).toBe(82.2); // 74.85 + 7.35
    expect(r.total).toBe(630.2);
  });

  it("add-on quantity multiplies its line", () => {
    const r = buildSubscriptionInvoiceLines({
      ...base, billingCycle: "MONTHLY", planPrice: 499,
      addOns: [{ nameEn: "Seats", nameAr: "مقاعد", quantity: 3, unitPrice: 49 }],
    });
    expect(r.lineItems[1]).toMatchObject({ quantity: 3, unitPrice: 49, total: 169.05 }); // 147 + 22.05
    expect(r.subtotal).toBe(646); // 499 + 147
  });

  it("multiple add-ons get incrementing sortOrder and sum", () => {
    const r = buildSubscriptionInvoiceLines({
      ...base, billingCycle: "MONTHLY", planPrice: 499,
      addOns: [
        { nameEn: "A", nameAr: "أ", quantity: 1, unitPrice: 99 },
        { nameEn: "B", nameAr: "ب", quantity: 1, unitPrice: 49 },
      ],
    });
    expect(r.lineItems.map((l) => l.sortOrder)).toEqual([0, 1, 2]);
    expect(r.subtotal).toBe(647); // 499 + 99 + 49
  });
});
