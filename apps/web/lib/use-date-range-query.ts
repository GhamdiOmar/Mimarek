"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  endOfDay,
  format,
  isSameDay,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subMonths,
} from "date-fns";
import type { DateRange, DateRangePreset } from "@repo/ui";

const ISO = "yyyy-MM-dd";

/** Today, anchored to month-start through end-of-day — MTD. */
function defaultRange(): DateRange {
  const now = new Date();
  return { from: startOfMonth(now), to: endOfDay(now) };
}

/**
 * Map a concrete range back to its matching `DateRangePicker` preset key,
 * so the picker chip reflects the URL state. Falls back to `"custom"`
 * when the range doesn't snap to a known preset boundary.
 */
function derivePreset(range: DateRange): DateRangePreset {
  if (!range.from || !range.to) return "custom";
  const now = new Date();
  const t = startOfDay(now);
  const eod = endOfDay(now);

  if (isSameDay(range.from, t) && isSameDay(range.to, eod)) return "today";

  if (
    isSameDay(range.from, startOfWeek(now, { weekStartsOn: 0 })) &&
    isSameDay(range.to, eod)
  ) {
    return "week";
  }

  if (isSameDay(range.from, startOfMonth(now)) && isSameDay(range.to, eod)) {
    return "month";
  }

  const prevMonth = subMonths(now, 1);
  if (
    isSameDay(range.from, startOfMonth(prevMonth)) &&
    isSameDay(range.to, endOfDay(startOfMonth(now)))
  ) {
    return "last-month";
  }

  if (isSameDay(range.from, startOfQuarter(now)) && isSameDay(range.to, eod)) {
    return "quarter";
  }

  if (isSameDay(range.from, startOfYear(now)) && isSameDay(range.to, eod)) {
    return "ytd";
  }

  return "custom";
}

/**
 * Read the dashboard date range from `?from=YYYY-MM-DD&to=YYYY-MM-DD`,
 * defaulting to month-to-date when either param is absent or unparseable.
 *
 * Writes both keys atomically on `setRange` via `router.replace` — back /
 * forward and shared URLs restore the range. Per AGENTS.md §6.10.1 the
 * dashboard's filter / sort / page state should be URL-synced so the page
 * is shareable; this hook covers the date dimension.
 */
export function useDateRangeQuery(): {
  range: DateRange;
  setRange: (range: DateRange) => void;
  preset: DateRangePreset;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");

  // Memoise the range on the raw query strings (stable across renders).
  // Without this, `new Date()` inside `defaultRange()` produces a fresh
  // object on every render, breaking effect dependency arrays and
  // looping anything that subscribes to `range`.
  const range = useMemo<DateRange>(() => {
    if (fromStr && toStr) {
      const from = parseISO(fromStr);
      const to = parseISO(toStr);
      if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
        return { from: startOfDay(from), to: endOfDay(to) };
      }
    }
    return defaultRange();
  }, [fromStr, toStr]);

  const setRange = useCallback(
    (next: DateRange) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.from) {
        params.set("from", format(next.from, ISO));
      } else {
        params.delete("from");
      }
      if (next.to) {
        params.set("to", format(next.to, ISO));
      } else {
        params.delete("to");
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  const preset = useMemo(() => derivePreset(range), [range]);

  return { range, setRange, preset };
}
