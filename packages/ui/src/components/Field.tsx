"use client";

import * as React from "react";
import { cn } from "../lib/utils";

/**
 * Field — governed form field that guarantees an accessible name (fixes axe
 * `label`, QA-FE-01).
 *
 * The repo's recurring a11y bug is a `<label>` that carries a class but NO
 * `htmlFor`, sitting next to a control with NO `id` — so the two are never
 * associated and axe flags `label` / `select-name`. `Field` removes that whole
 * class of bug: it mints a stable id with `React.useId()` and wires the visible
 * `<label htmlFor={id}>` to the control's `id={id}` for you. It also injects
 * `aria-invalid` (when `error`) and `aria-describedby` (pointing at the hint
 * and/or error elements) into the control.
 *
 * The control is supplied via a render prop so the wiring is explicit and the
 * caller can spread it onto ANY control (input, textarea, native select, a
 * Saudi primitive, etc.):
 *
 * ```tsx
 * <Field label={t("National ID", "رقم الهوية")} required error={errors.nid} hint={t("10 digits", "10 أرقام")}>
 *   {(field) => <Input {...field} value={nid} onChange={(e) => setNid(e.target.value)} />}
 * </Field>
 * ```
 *
 * `field` = `{ id, "aria-invalid"?, "aria-describedby"? }`. Spread it onto the
 * control; do not override `id`.
 *
 * For a labelled NATIVE `<select>`, prefer `<SelectField>` (a thin wrapper over
 * this) so the migration from a raw `<select>` stays near-mechanical.
 */

export interface FieldRenderProps {
  /** Stable id minted by Field — wire to the control's `id` (do not override). */
  id: string;
  /** Present only when `error` is set. */
  "aria-invalid"?: true;
  /** Composed from the hint id and/or error id, when either exists. */
  "aria-describedby"?: string;
}

export interface FieldProps {
  /** Visible label text (required). Pass bilingual text from the caller's `t()`. */
  label: string;
  /** Error message — rendered in a `role="alert"` region and sets `aria-invalid`. */
  error?: string;
  /** Helper/hint text shown under the control when there is no error. */
  hint?: string;
  /** Appends the `*` required marker to the label. */
  required?: boolean;
  /** Extra classes on the field wrapper. */
  className?: string;
  /** Render prop receiving the wired control props. */
  children: (field: FieldRenderProps) => React.ReactNode;
}

function Field({ label, error, hint, required, className, children }: FieldProps) {
  const id = React.useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  // Only describe the control by elements that actually render: the error
  // (when present) and/or the hint (always available when provided, but hidden
  // while an error shows — keep both ids if both have content so SRs can still
  // reach the hint if the consumer chooses to show it).
  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  const fieldProps: FieldRenderProps = {
    id,
    ...(error ? { "aria-invalid": true as const } : {}),
    ...(describedBy ? { "aria-describedby": describedBy } : {}),
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive ms-0.5">*</span>}
      </label>
      {children(fieldProps)}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

export { Field };
