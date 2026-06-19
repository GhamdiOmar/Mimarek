"use client";

/**
 * Styled react-aria calendar internals — the inner grid shared by
 * `DateRangePicker` and `HijriDatePicker`. Replaces the former
 * react-day-picker `<Calendar>` primitive.
 *
 * Design: Mimarek tokens only (no `dark:` utilities — §6.13). Cells are
 * 44×44 (§6.6.2), tabular-nums, logical radii (RTL-safe). Nav arrows pick the
 * visual chevron from `useLocale().direction` because the react-aria
 * `previous`/`next` slots are *logical*, not visual.
 *
 * Locale + Hijri (§6.15.3): `locale` maps to `ar-SA` / `en-SA`; `hijri` appends
 * `-u-ca-islamic-umalqura`. The controlled `value` stays Gregorian-backed —
 * callers normalise back to Gregorian on change (see `lib/aria-date.ts`).
 * Hijri here is *display-only*.
 */
import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Button,
  Calendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  Heading,
  I18nProvider,
  RangeCalendar,
  useLocale,
  type CalendarProps,
  type DateValue,
  type RangeCalendarProps,
} from "react-aria-components";

import { cn } from "../lib/utils";

type UiLocale = "ar" | "en";

function localeString(locale: UiLocale, hijri?: boolean): string {
  const base = locale === "ar" ? "ar-SA" : "en-SA";
  // §6.3.4 — Western digits (0–9) by default in BOTH languages (modern Saudi
  // standard). Without `-nu-latn`, ar-SA renders Arabic-Indic numerals (١٢٣) in
  // the calendar cells, which contradicts the design system and the trigger's
  // own `ar-SA-u-nu-latn` formatting. Keep the calendar system extension first,
  // then the numbering-system extension (single `-u-` block).
  const ext = hijri ? "u-ca-islamic-umalqura-nu-latn" : "u-nu-latn";
  return `${base}-${ext}`;
}

const cellClassName = cn(
  "flex h-11 w-11 items-center justify-center rounded-md text-sm tabular-nums",
  "outline-none transition-colors cursor-default select-none",
  "data-[hovered]:bg-muted",
  "data-[selected]:bg-primary data-[selected]:text-primary-foreground",
  "data-[selection-start]:rounded-s-md data-[selection-end]:rounded-e-md",
  "data-[unavailable]:text-destructive data-[unavailable]:line-through",
  "data-[disabled]:opacity-45 data-[disabled]:pointer-events-none",
  "data-[outside-month]:text-muted-foreground/40",
  "data-[focus-visible]:ring-2 data-[focus-visible]:ring-ring data-[focus-visible]:ring-offset-2",
);

/** Logical-slot nav button — visual chevron derived from text direction. */
function NavButton({
  slot,
  prevLabel,
  nextLabel,
}: {
  slot: "previous" | "next";
  prevLabel: string;
  nextLabel: string;
}) {
  const { direction } = useLocale();
  const rtl = direction === "rtl";
  // `previous` is logically "earlier"; in RTL the earlier side is on the right.
  const isPrev = slot === "previous";
  const Icon = isPrev ? (rtl ? ChevronRight : ChevronLeft) : rtl ? ChevronLeft : ChevronRight;
  return (
    <Button
      slot={slot}
      aria-label={isPrev ? prevLabel : nextLabel}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground",
        "outline-none transition-colors cursor-default",
        "data-[hovered]:bg-muted",
        "data-[disabled]:opacity-45 data-[disabled]:pointer-events-none",
        "data-[focus-visible]:ring-2 data-[focus-visible]:ring-ring data-[focus-visible]:ring-offset-2",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}

/**
 * One month grid — reused for single + range, single + multi-month.
 * `monthOffset` (0-based) shifts a range calendar's second/third month via the
 * react-aria `CalendarGrid` `offset` duration.
 */
function MonthGrid({ monthOffset = 0 }: { monthOffset?: number }) {
  return (
    <CalendarGrid
      className="border-collapse"
      offset={monthOffset ? { months: monthOffset } : undefined}
    >
      <CalendarGridHeader>
        {(day) => (
          <CalendarHeaderCell className="h-9 w-11 text-xs font-normal text-muted-foreground">
            {day}
          </CalendarHeaderCell>
        )}
      </CalendarGridHeader>
      <CalendarGridBody>
        {(date) => <CalendarCell date={date} className={cellClassName} />}
      </CalendarGridBody>
    </CalendarGrid>
  );
}

interface CalendarChromeProps {
  locale: UiLocale;
}

function CalendarChrome({
  locale,
  children,
}: CalendarChromeProps & { children: React.ReactNode }) {
  const labels =
    locale === "ar"
      ? { prev: "الشهر السابق", next: "الشهر التالي" }
      : { prev: "Previous month", next: "Next month" };
  return (
    <>
      <header className="mb-3 flex items-center justify-between gap-2">
        <NavButton slot="previous" prevLabel={labels.prev} nextLabel={labels.next} />
        <Heading className="text-sm font-medium text-foreground" />
        <NavButton slot="next" prevLabel={labels.prev} nextLabel={labels.next} />
      </header>
      {children}
    </>
  );
}

/* ── Single-date calendar ─────────────────────────────────────────────── */

export interface AriaCalendarProps
  extends Omit<CalendarProps<DateValue>, "className"> {
  locale: UiLocale;
  hijri?: boolean;
  className?: string;
}

export function AriaCalendar({
  locale,
  hijri,
  className,
  ...props
}: AriaCalendarProps) {
  return (
    <I18nProvider locale={localeString(locale, hijri)}>
      <Calendar
        {...props}
        className={cn("inline-block w-fit p-3", className)}
      >
        <CalendarChrome locale={locale}>
          <MonthGrid />
        </CalendarChrome>
      </Calendar>
    </I18nProvider>
  );
}

/* ── Range calendar ───────────────────────────────────────────────────── */

export interface AriaRangeCalendarProps
  extends Omit<RangeCalendarProps<DateValue>, "className" | "visibleDuration"> {
  locale: UiLocale;
  hijri?: boolean;
  numberOfMonths?: number;
  className?: string;
}

export function AriaRangeCalendar({
  locale,
  hijri,
  numberOfMonths = 1,
  className,
  ...props
}: AriaRangeCalendarProps) {
  const labels =
    locale === "ar"
      ? { prev: "الشهر السابق", next: "الشهر التالي" }
      : { prev: "Previous month", next: "Next month" };
  return (
    <I18nProvider locale={localeString(locale, hijri)}>
      <RangeCalendar
        {...props}
        visibleDuration={{ months: numberOfMonths }}
        className={cn("inline-block w-fit p-3", className)}
      >
        <header className="mb-3 flex items-center justify-between gap-2">
          <NavButton slot="previous" prevLabel={labels.prev} nextLabel={labels.next} />
          <Heading className="text-sm font-medium text-foreground" />
          <NavButton slot="next" prevLabel={labels.prev} nextLabel={labels.next} />
        </header>
        <div className="flex flex-col gap-4 md:flex-row">
          {Array.from({ length: numberOfMonths }, (_, i) => (
            <MonthGrid key={i} monthOffset={i} />
          ))}
        </div>
      </RangeCalendar>
    </I18nProvider>
  );
}
