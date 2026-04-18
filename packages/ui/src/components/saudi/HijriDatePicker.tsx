"use client";

import * as React from "react";
import { CalendarDays } from "lucide-react";
import { Calendar } from "../../primitives/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../primitives/popover";
import { Button } from "../../primitives/button";
import { cn } from "../../lib/utils";

export interface HijriDatePickerProps {
  value?: Date | null;
  onChange?: (date: Date | null) => void;
  /** "ar" | "en" — default pulls from document.documentElement.lang. */
  locale?: "ar" | "en";
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

type Calendar = "greg" | "hijri";

function formatGreg(d: Date, locale: "ar" | "en"): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

function formatHijri(d: Date, locale: "ar" | "en"): string {
  const lc = locale === "ar" ? "ar-SA-u-ca-islamic" : "en-US-u-ca-islamic";
  return new Intl.DateTimeFormat(lc, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

export function HijriDatePicker({
  value,
  onChange,
  locale,
  placeholder,
  disabled,
  className,
  id,
}: HijriDatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [cal, setCal] = React.useState<Calendar>("greg");

  const effectiveLocale: "ar" | "en" =
    locale ??
    (typeof document !== "undefined" && document.documentElement.lang === "ar"
      ? "ar"
      : "en");

  const displayPrimary = value
    ? cal === "hijri"
      ? formatHijri(value, effectiveLocale)
      : formatGreg(value, effectiveLocale)
    : placeholder ?? (effectiveLocale === "ar" ? "اختر تاريخًا" : "Pick a date");

  const displaySecondary = value
    ? cal === "hijri"
      ? formatGreg(value, effectiveLocale)
      : formatHijri(value, effectiveLocale)
    : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-10 w-full justify-start gap-2 px-3 text-start font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarDays className="h-4 w-4 opacity-70" aria-hidden="true" />
          <span className="truncate">{displayPrimary}</span>
          {displaySecondary && (
            <span className="ms-auto truncate text-xs text-muted-foreground">
              {displaySecondary}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex items-center gap-1 border-b bg-muted/40 px-2 py-1 text-xs">
          <button
            type="button"
            onClick={() => setCal("greg")}
            className={cn(
              "rounded-sm px-2 py-1 transition-colors",
              cal === "greg"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {effectiveLocale === "ar" ? "ميلادي" : "Gregorian"}
          </button>
          <button
            type="button"
            onClick={() => setCal("hijri")}
            className={cn(
              "rounded-sm px-2 py-1 transition-colors",
              cal === "hijri"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {effectiveLocale === "ar" ? "هجري" : "Hijri"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange?.(null);
                setOpen(false);
              }}
              className="ms-auto rounded-sm px-2 py-1 text-muted-foreground hover:text-foreground"
            >
              {effectiveLocale === "ar" ? "مسح" : "Clear"}
            </button>
          )}
        </div>
        <Calendar
          mode="single"
          selected={value ?? undefined}
          onSelect={(d) => {
            onChange?.(d ?? null);
            if (d) setOpen(false);
          }}
        />
        {value && (
          <div className="border-t px-3 py-2 text-xs text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">
                {effectiveLocale === "ar" ? "ميلادي: " : "Gregorian: "}
              </span>
              {formatGreg(value, effectiveLocale)}
            </div>
            <div>
              <span className="font-medium text-foreground">
                {effectiveLocale === "ar" ? "هجري: " : "Hijri: "}
              </span>
              {formatHijri(value, effectiveLocale)}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
