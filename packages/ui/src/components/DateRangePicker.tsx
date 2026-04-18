"use client";

import * as React from "react";
import { CalendarRange } from "lucide-react";
import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  endOfDay,
  subMonths,
} from "date-fns";
import { Calendar } from "../primitives/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../primitives/popover";
import { Button } from "../primitives/button";
import { cn } from "../lib/utils";

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export type DateRangePreset =
  | "today"
  | "week"
  | "month"
  | "last-month"
  | "quarter"
  | "ytd"
  | "custom";

export interface DateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange, preset: DateRangePreset) => void;
  locale?: "ar" | "en";
  className?: string;
  disabled?: boolean;
}

function presetRange(preset: Exclude<DateRangePreset, "custom">): DateRange {
  const now = new Date();
  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "week":
      return { from: startOfWeek(now, { weekStartsOn: 0 }), to: endOfDay(now) };
    case "month":
      return { from: startOfMonth(now), to: endOfDay(now) };
    case "last-month": {
      const prev = subMonths(now, 1);
      return {
        from: startOfMonth(prev),
        to: endOfDay(startOfMonth(now)),
      };
    }
    case "quarter":
      return { from: startOfQuarter(now), to: endOfDay(now) };
    case "ytd":
      return { from: startOfYear(now), to: endOfDay(now) };
  }
}

function formatRange(r: DateRange | undefined, locale: "ar" | "en"): string {
  if (!r?.from) return locale === "ar" ? "اختر الفترة" : "Pick a range";
  const fmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  if (!r.to) return fmt.format(r.from);
  return `${fmt.format(r.from)} — ${fmt.format(r.to)}`;
}

export function DateRangePicker({
  value,
  onChange,
  locale,
  className,
  disabled,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const effLocale: "ar" | "en" =
    locale ??
    (typeof document !== "undefined" && document.documentElement.lang === "ar"
      ? "ar"
      : "en");

  const t = effLocale === "ar"
    ? { today: "اليوم", week: "الأسبوع", month: "الشهر", lastMonth: "الشهر الماضي", quarter: "الربع", ytd: "منذ بداية السنة", custom: "مخصص" }
    : { today: "Today", week: "This week", month: "This month", lastMonth: "Last month", quarter: "This quarter", ytd: "Year to date", custom: "Custom" };

  const presets: Array<{ key: Exclude<DateRangePreset, "custom">; label: string }> = [
    { key: "today", label: t.today },
    { key: "week", label: t.week },
    { key: "month", label: t.month },
    { key: "last-month", label: t.lastMonth },
    { key: "quarter", label: t.quarter },
    { key: "ytd", label: t.ytd },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-10 w-full justify-start gap-2 px-3 text-start font-normal",
            !value?.from && "text-muted-foreground",
            className,
          )}
        >
          <CalendarRange className="h-4 w-4 opacity-70" aria-hidden="true" />
          <span className="truncate">{formatRange(value, effLocale)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-auto flex-col gap-0 p-0 md:flex-row" align="start">
        <div className="flex flex-row flex-wrap gap-1 border-b p-2 md:w-44 md:flex-col md:border-b-0 md:border-e">
          {presets.map((p) => (
            <button
              key={p.key}
              type="button"
              className="rounded-sm px-2 py-1.5 text-start text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => {
                const r = presetRange(p.key);
                onChange?.(r, p.key);
                setOpen(false);
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <Calendar
          mode="range"
          numberOfMonths={2}
          selected={value as { from: Date | undefined; to?: Date | undefined }}
          onSelect={(range) => {
            const r: DateRange = {
              from: range?.from,
              to: range?.to,
            };
            onChange?.(r, "custom");
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
