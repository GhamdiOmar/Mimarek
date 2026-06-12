/**
 * Pure AR aging bucket math — extracted from
 * `app/actions/admin-analytics/getArAging.ts` so the boundary arithmetic
 * is unit-testable without Prisma/auth. Zero imports by design.
 *
 * Semantics (must stay byte-identical to the original action loop):
 * - Day diff = `Math.floor((asOf - dueDate) / MS_PER_DAY)`.
 * - Buckets: days <= 30 → "0-30"; <= 60 → "31-60"; <= 90 → "61-90"; else "90+".
 * - Rows with a null `dueDate` are skipped entirely (excluded from the
 *   grand total too).
 * - A future `dueDate` yields a negative day diff, which lands in "0-30"
 *   (`days <= 30`). The action's Prisma query filters `dueDate < asOf`,
 *   so this path is normally unreachable there — but the function pins
 *   the original behavior regardless.
 */

const MS_PER_DAY = 86_400_000;

export type AgingBucketLabel = "0-30" | "31-60" | "61-90" | "90+";

export interface AgingInvoice {
  total: number;
  dueDate: Date | null;
}

export interface AgingResult {
  buckets: Record<AgingBucketLabel, number>;
  totalSarGross: number;
}

export function bucketInvoices(invoices: AgingInvoice[], asOf: Date): AgingResult {
  const buckets: Record<AgingBucketLabel, number> = {
    "0-30": 0,
    "31-60": 0,
    "61-90": 0,
    "90+": 0,
  };
  let totalSarGross = 0;
  for (const inv of invoices) {
    if (!inv.dueDate) continue;
    const days = Math.floor((asOf.getTime() - inv.dueDate.getTime()) / MS_PER_DAY);
    const total = inv.total;
    totalSarGross += total;
    if (days <= 30) buckets["0-30"] += total;
    else if (days <= 60) buckets["31-60"] += total;
    else if (days <= 90) buckets["61-90"] += total;
    else buckets["90+"] += total;
  }
  return { buckets, totalSarGross };
}
