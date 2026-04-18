"use client";

import * as React from "react";
import { Input } from "../../primitives/input";
import { cn } from "../../lib/utils";

export interface NationalIdInputProps
  extends Omit<React.ComponentProps<"input">, "onChange" | "value"> {
  /** Raw 10-digit value (no spaces). */
  value?: string;
  /** Fires with raw 10-digit value on every change. */
  onChange?: (raw: string) => void;
  /** Emits true when value is a full 10 digits starting with 1 or 2. */
  onValidityChange?: (valid: boolean) => void;
  invalid?: boolean;
}

/** Validate Saudi National ID / Iqama (10 digits, starts with 1 or 2, Luhn-style check). */
export function isValidSaudiId(raw: string): boolean {
  if (!/^[12]\d{9}$/.test(raw)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let d = parseInt(raw[i]!, 10);
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

function formatDisplay(raw: string): string {
  const s = raw.slice(0, 10);
  if (s.length <= 4) return s;
  if (s.length <= 7) return `${s.slice(0, 4)} ${s.slice(4)}`;
  return `${s.slice(0, 4)} ${s.slice(4, 7)} ${s.slice(7)}`;
}

export const NationalIdInput = React.forwardRef<
  HTMLInputElement,
  NationalIdInputProps
>(
  (
    { value = "", onChange, onValidityChange, invalid, className, ...rest },
    ref,
  ) => {
    const display = React.useMemo(() => formatDisplay(value), [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/\D/g, "").slice(0, 10);
      onChange?.(raw);
      onValidityChange?.(isValidSaudiId(raw));
    };

    return (
      <Input
        ref={ref}
        inputMode="numeric"
        autoComplete="off"
        dir="ltr"
        maxLength={12}
        value={display}
        onChange={handleChange}
        aria-invalid={invalid || undefined}
        className={cn("number-ltr tabular-nums tracking-wide", className)}
        {...rest}
      />
    );
  },
);
NationalIdInput.displayName = "NationalIdInput";
