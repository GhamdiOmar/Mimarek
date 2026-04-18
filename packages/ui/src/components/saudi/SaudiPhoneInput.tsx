"use client";

import * as React from "react";
import { Input } from "../../primitives/input";
import { cn } from "../../lib/utils";

export interface SaudiPhoneInputProps
  extends Omit<React.ComponentProps<"input">, "onChange" | "value"> {
  /** E.164 value: +9665XXXXXXXX */
  value?: string;
  onChange?: (e164: string) => void;
  onValidityChange?: (valid: boolean) => void;
  invalid?: boolean;
}

/** Normalise local (05XXXXXXXX / 5XXXXXXXX / 9665…) to E.164 `+9665XXXXXXXX`. Returns empty on invalid. */
export function toE164Saudi(input: string): string {
  const digits = input.replace(/\D/g, "");
  let local = digits;
  if (digits.startsWith("966")) local = digits.slice(3);
  else if (digits.startsWith("0")) local = digits.slice(1);
  if (!/^5\d{8}$/.test(local)) return "";
  return `+966${local}`;
}

export function isValidSaudiPhone(e164: string): boolean {
  return /^\+9665\d{8}$/.test(e164);
}

function formatDisplay(e164: string): string {
  if (!isValidSaudiPhone(e164)) return e164;
  const rest = e164.slice(4); // 5XXXXXXXX
  return `+966 ${rest.slice(0, 2)} ${rest.slice(2, 5)} ${rest.slice(5)}`;
}

export const SaudiPhoneInput = React.forwardRef<
  HTMLInputElement,
  SaudiPhoneInputProps
>(
  (
    { value = "", onChange, onValidityChange, invalid, className, ...rest },
    ref,
  ) => {
    const [raw, setRaw] = React.useState<string>(value);

    React.useEffect(() => {
      setRaw(value);
    }, [value]);

    const display = isValidSaudiPhone(raw) ? formatDisplay(raw) : raw;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      const e164 = toE164Saudi(next);
      const stored = e164 || next.replace(/[^\d+ ]/g, "");
      setRaw(stored);
      onChange?.(e164);
      onValidityChange?.(isValidSaudiPhone(e164));
    };

    return (
      <Input
        ref={ref}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        dir="ltr"
        value={display}
        onChange={handleChange}
        aria-invalid={invalid || undefined}
        className={cn("number-ltr tabular-nums", className)}
        {...rest}
      />
    );
  },
);
SaudiPhoneInput.displayName = "SaudiPhoneInput";
