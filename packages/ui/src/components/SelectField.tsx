"use client";

import * as React from "react";
import { cn } from "../lib/utils";
import { Field } from "./Field";

/**
 * SelectField — governed wrapper over a NATIVE `<select>` that guarantees an
 * accessible name (fixes axe `select-name`, QA-FE-03).
 *
 * There are ~63 raw `<select>` sites in `apps/web`, almost all of the shape
 * "a `<label>` with no `htmlFor` next to a `<select>` with no `id`". Rewriting
 * them to the Radix `Select` would change value/onChange/`<option>` semantics
 * across all of them — high migration risk. This wrapper instead KEEPS native
 * `<select>` semantics and only adds the label association + a11y wiring, so the
 * migration is a near-mechanical swap:
 *
 * Before:
 * ```tsx
 * <div className="space-y-1.5">
 *   <label className="...">Source</label>
 *   <select value={v} onChange={onChange} className="...">{options}</select>
 * </div>
 * ```
 * After:
 * ```tsx
 * <SelectField label="Source" value={v} onChange={onChange}>{options}</SelectField>
 * ```
 *
 * `value` / `defaultValue` / `onChange` / `disabled` / `name` / `required` and
 * the `<option>` children all pass through to the native `<select>` UNCHANGED.
 *
 * Label-less case (e.g. a toolbar/filter select with no visible label): omit
 * `label` and pass `aria-label` instead — it is forwarded to the `<select>` so
 * the control still has an accessible name:
 * ```tsx
 * <SelectField aria-label="Filter by priority" value={p} onChange={onChange}>…</SelectField>
 * ```
 */

const nativeSelectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/30";

export interface SelectFieldProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /**
   * Visible label text. Omit ONLY for a label-less inline/toolbar select, in
   * which case you MUST pass `aria-label` for the accessible name.
   */
  label?: string;
  /** Error message — rendered in a `role="alert"` region; sets `aria-invalid`. */
  error?: string;
  /** Helper/hint text under the control when there is no error. */
  hint?: string;
  /** Appends the `*` required marker to the label (also forward `required` to gate submission). */
  requiredMark?: boolean;
  /** Classes applied to the `<select>` element. */
  className?: string;
  /** Classes applied to the field wrapper (label + control + messages). */
  wrapperClassName?: string;
}

const SelectField = React.forwardRef<HTMLSelectElement, SelectFieldProps>(
  (
    {
      label,
      error,
      hint,
      requiredMark,
      className,
      wrapperClassName,
      children,
      ...rest
    },
    ref
  ) => {
    // Label-less path: no visible label, so render the bare native <select> and
    // rely on the caller-provided aria-label (forwarded via ...rest).
    if (!label) {
      return (
        <select
          ref={ref}
          className={cn(nativeSelectClass, className)}
          {...rest}
        >
          {children}
        </select>
      );
    }

    return (
      <Field
        label={label}
        error={error}
        hint={hint}
        required={requiredMark}
        className={wrapperClassName}
      >
        {(field) => (
          // Spread `rest` FIRST, then `field`, so Field's useId()-minted `id`
          // (and aria-invalid/aria-describedby) always win over any caller-passed
          // `id` — otherwise the <label htmlFor> ↔ <select id> association breaks.
          <select
            ref={ref}
            {...rest}
            {...field}
            className={cn(nativeSelectClass, className)}
          >
            {children}
          </select>
        )}
      </Field>
    );
  }
);
SelectField.displayName = "SelectField";

export { SelectField };

/* ─────────────────────────────────────────────────────────────────────────
 * DEMO — Field + SelectField + compound Alert (v4.29.0 a11y primitives)
 * (kept as a comment so it ships no runtime; copy into a page to exercise.)
 *
 * import {
 *   Field, SelectField, Input, Button,
 *   Alert, AlertIcon, AlertContent, AlertTitle, AlertDescription, AlertToolbar,
 * } from "@repo/ui";
 * import { AlertTriangle } from "lucide-react";
 *
 * // 1) Field — guaranteed label association + error/hint a11y wiring
 * <Field
 *   label={t("National ID", "رقم الهوية")}
 *   required
 *   hint={t("10 digits starting with 1 or 2", "10 أرقام تبدأ بـ 1 أو 2")}
 *   error={nidError}
 * >
 *   {(field) => (
 *     <Input {...field} value={nid} onChange={(e) => setNid(e.target.value)} inputMode="numeric" />
 *   )}
 * </Field>
 *
 * // 2) SelectField — labelled native select (the ~63-site migration target)
 * <SelectField
 *   label={t("Source", "المصدر")}
 *   value={source}
 *   onChange={(e) => setSource(e.target.value)}
 * >
 *   <option value="">{t("Select source", "اختر المصدر")}</option>
 *   <option value="WEBSITE">{t("Website", "الموقع")}</option>
 * </SelectField>
 *
 * // 2b) SelectField — label-less toolbar filter: pass aria-label instead
 * <SelectField
 *   aria-label={t("Filter by priority", "تصفية حسب الأولوية")}
 *   value={priority}
 *   onChange={(e) => setPriority(e.target.value)}
 *   className="h-9 w-auto"
 * >
 *   <option value="">{t("All priorities", "كل الأولويات")}</option>
 * </SelectField>
 *
 * // 3) Alert — compound API with icon, content, action + governed dismiss
 * <Alert variant="warning" className="flex items-start gap-3">
 *   <AlertIcon icon={AlertTriangle} />
 *   <AlertContent>
 *     <AlertTitle>{t("Trial ending", "انتهاء التجربة")}</AlertTitle>
 *     <AlertDescription>
 *       {t("Your trial ends in 3 days.", "تنتهي تجربتك خلال 3 أيام.")}
 *     </AlertDescription>
 *   </AlertContent>
 *   <AlertToolbar onDismiss={() => setOpen(false)} dismissLabel={t("Dismiss", "إغلاق")}>
 *     <Button size="sm" variant="primary">{t("Upgrade", "الترقية")}</Button>
 *   </AlertToolbar>
 * </Alert>
 * ───────────────────────────────────────────────────────────────────────── */
