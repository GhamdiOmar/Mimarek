import "server-only";
import { db } from "@repo/db";

/**
 * Date-range params shared by every admin-analytics server action.
 * Default to month-to-date when called without args.
 */
export interface DateRangeParams {
  from: Date;
  to: Date;
}

/** Render any structure (incl. Prisma Decimal) into a JSON-safe shape. */
export function jsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Sum a Decimal-or-number array safely (Decimal serialises to string in JSON). */
export function sumDecimal(values: ReadonlyArray<unknown>): number {
  let total = 0;
  for (const v of values) {
    const n = Number(v ?? 0);
    if (!Number.isNaN(n)) total += n;
  }
  return total;
}

export { db };
