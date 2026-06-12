import { startOfDay, endOfDay } from "date-fns";

export interface DateRangeWindow {
  from: Date;
  to: Date;
}

/**
 * Parse a dashboard date range from URL search params (`?from=YYYY-MM-DD&to=…`)
 * into a concrete window, aligned with the client `useDateRangeQuery` hook
 * (startOfDay(from) → endOfDay(to)). Returns undefined when absent/unparseable
 * so callers fall back to their own default (e.g. month-to-date).
 *
 * Server-side counterpart of `lib/use-date-range-query.ts`: the Server
 * Component reads the same params the picker writes, so the URL is the single
 * source of truth for the date dimension (§6.10.1) and the page is shareable.
 */
export function parseRangeParams(params: {
  from?: string | string[];
  to?: string | string[];
}): DateRangeWindow | undefined {
  const fromStr = Array.isArray(params.from) ? params.from[0] : params.from;
  const toStr = Array.isArray(params.to) ? params.to[0] : params.to;
  if (!fromStr || !toStr) return undefined;
  const from = new Date(fromStr);
  const to = new Date(toStr);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return undefined;
  return { from: startOfDay(from), to: endOfDay(to) };
}
