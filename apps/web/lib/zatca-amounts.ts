/** Round to 2 decimals (half-up via EPSILON nudge). */
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * VAT-inclusive back-computation. `gross` is the VAT-inclusive charge the tenant
 * paid; `vatRate` is e.g. 0.15. Returns the reconciling net subtotal, VAT, and
 * total. vatRate <= 0 → exempt / out-of-scope (subtotal = gross, vat = 0).
 */
export function computeInclusiveBreakdown(
  gross: number,
  vatRate: number,
): { subtotal: number; vatAmount: number; total: number } {
  const g = round2(gross);
  const isTaxable = vatRate > 0;
  const subtotal = isTaxable ? round2(g / (1 + vatRate)) : g;
  const vatAmount = isTaxable ? round2(g - subtotal) : 0;
  const total = round2(subtotal + vatAmount);
  return { subtotal, vatAmount, total };
}
