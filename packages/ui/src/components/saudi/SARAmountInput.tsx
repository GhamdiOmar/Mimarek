"use client";

import * as React from "react";
import { Input } from "../../primitives/input";
import { RiyalIcon } from "../../icons/RiyalIcon";
import { cn } from "../../lib/utils";

export interface SARAmountInputProps
  extends Omit<React.ComponentProps<"input">, "onChange" | "value"> {
  /** Numeric amount in SAR (major units). */
  value?: number | null;
  onChange?: (amount: number | null) => void;
  /** "ar" | "en" — controls suffix rendering. Defaults to detecting document dir. */
  locale?: "ar" | "en";
  invalid?: boolean;
}

function format(n: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function parse(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export const SARAmountInput = React.forwardRef<
  HTMLInputElement,
  SARAmountInputProps
>(
  (
    { value, onChange, locale, invalid, className, ...rest },
    ref,
  ) => {
    const [focused, setFocused] = React.useState(false);
    const [draft, setDraft] = React.useState<string>("");

    React.useEffect(() => {
      if (!focused) setDraft(value == null ? "" : format(value));
    }, [value, focused]);

    const effectiveLocale: "ar" | "en" =
      locale ??
      (typeof document !== "undefined" && document.documentElement.lang === "ar"
        ? "ar"
        : "en");

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      setDraft(next);
      onChange?.(parse(next));
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setFocused(false);
      const n = parse(e.target.value);
      setDraft(n == null ? "" : format(n));
      rest.onBlur?.(e);
    };

    return (
      <div className="relative">
        <Input
          ref={ref}
          inputMode="decimal"
          dir="ltr"
          value={draft}
          onFocus={(e) => {
            setFocused(true);
            setDraft(value == null ? "" : String(value));
            rest.onFocus?.(e);
          }}
          onBlur={handleBlur}
          onChange={handleChange}
          aria-invalid={invalid || undefined}
          className={cn("number-ltr tabular-nums pe-14", className)}
          {...rest}
        />
        <span
          className="pointer-events-none absolute inset-y-0 end-3 flex items-center gap-1 text-xs text-muted-foreground"
          aria-hidden="true"
        >
          {effectiveLocale === "ar" ? (
            <>
              <RiyalIcon className="h-3.5 w-3.5" />
              <span>ر.س</span>
            </>
          ) : (
            <>
              <RiyalIcon className="h-3.5 w-3.5" />
              <span>SAR</span>
            </>
          )}
        </span>
      </div>
    );
  },
);
SARAmountInput.displayName = "SARAmountInput";
