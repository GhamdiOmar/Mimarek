"use client";

import * as React from "react";
import { Input } from "../../primitives/input";
import { cn } from "../../lib/utils";

export interface CRInputProps
  extends Omit<React.ComponentProps<"input">, "onChange" | "value"> {
  /** Raw 10-digit value. */
  value?: string;
  onChange?: (raw: string) => void;
  onValidityChange?: (valid: boolean) => void;
  invalid?: boolean;
}

export function isValidCR(raw: string): boolean {
  return /^\d{10}$/.test(raw);
}

function formatDisplay(raw: string): string {
  const s = raw.slice(0, 10);
  if (s.length <= 4) return s;
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

export const CRInput = React.forwardRef<HTMLInputElement, CRInputProps>(
  (
    { value = "", onChange, onValidityChange, invalid, className, ...rest },
    ref,
  ) => {
    const display = React.useMemo(() => formatDisplay(value), [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/\D/g, "").slice(0, 10);
      onChange?.(raw);
      onValidityChange?.(isValidCR(raw));
    };

    return (
      <Input
        ref={ref}
        inputMode="numeric"
        autoComplete="off"
        dir="ltr"
        maxLength={11}
        value={display}
        onChange={handleChange}
        aria-invalid={invalid || undefined}
        className={cn("number-ltr tabular-nums tracking-wide", className)}
        {...rest}
      />
    );
  },
);
CRInput.displayName = "CRInput";
