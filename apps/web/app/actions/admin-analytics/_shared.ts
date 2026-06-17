import "server-only";
import { db } from "@repo/db";
import { serialize } from "../../../lib/serialize";

/**
 * Date-range params shared by every admin-analytics server action.
 * Default to month-to-date when called without args.
 */
export interface DateRangeParams {
  from: Date;
  to: Date;
}

/**
 * Render any structure (incl. Prisma Decimal) into a JSON-safe shape.
 * Thin alias over the shared `serialize()` seam (lib/serialize.ts) — keep the
 * `jsonSafe` name its admin-analytics callers already use, but route through
 * the single seam rather than inlining JSON.parse(JSON.stringify(...)).
 */
export function jsonSafe<T>(value: T): T {
  return serialize(value);
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
