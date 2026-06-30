export type SubscriptionInvoiceLine = {
  description: string;
  descriptionAr: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  sortOrder: number;
};

/**
 * Build the line items + aggregate totals for a subscription invoice: the plan
 * line (sortOrder 0) followed by one line per active add-on (quantity × the
 * snapshotted unit price). VAT is computed per line (the ZATCA convention) and
 * the invoice totals are the sum of the lines. Pure (no db/next) → unit-tested;
 * `generateSubscriptionInvoice` delegates here so a billed period includes the
 * org's add-ons.
 */
export function buildSubscriptionInvoiceLines(input: {
  planNameEn: string;
  planNameAr: string;
  billingCycle: string;
  billingCycleAr: string;
  planPrice: number;
  addOns: ReadonlyArray<{ nameEn: string; nameAr: string; quantity: number; unitPrice: number }>;
  vatRate?: number;
}): { lineItems: SubscriptionInvoiceLine[]; subtotal: number; vatAmount: number; total: number } {
  const vatRate = input.vatRate ?? 0.15;
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const line = (
    description: string,
    descriptionAr: string,
    quantity: number,
    unitPrice: number,
    sortOrder: number,
  ): SubscriptionInvoiceLine => {
    const lineSubtotal = round2(unitPrice * quantity);
    const lineVat = round2(lineSubtotal * vatRate);
    return { description, descriptionAr, quantity, unitPrice, vatRate, vatAmount: lineVat, total: round2(lineSubtotal + lineVat), sortOrder };
  };

  const lineItems = [
    line(
      `${input.planNameEn} - ${input.billingCycle} subscription`,
      `${input.planNameAr} - اشتراك ${input.billingCycleAr}`,
      1,
      input.planPrice,
      0,
    ),
    ...input.addOns.map((a, i) => line(a.nameEn, a.nameAr, a.quantity, a.unitPrice, i + 1)),
  ];

  // Sum the ROUNDED per-line subtotals (= line.total − line.vatAmount, both
  // already halala-rounded) so the invoice subtotal always equals the sum of the
  // printed line subtotals — keeps ZATCA totals internally consistent.
  const subtotal = round2(lineItems.reduce((s, li) => s + (li.total - li.vatAmount), 0));
  const vatAmount = round2(lineItems.reduce((s, li) => s + li.vatAmount, 0));
  const total = round2(subtotal + vatAmount);
  return { lineItems, subtotal, vatAmount, total };
}
