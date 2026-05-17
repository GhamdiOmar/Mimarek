"use client";

import * as React from "react";
import Link from "next/link";
import { User, CalendarClock } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./Button";

/**
 * Structurally identical to `@repo/types` `NextBestAction` — re-declared
 * locally to keep `@repo/ui` decoupled from `@repo/types` (no workspace-dep
 * change). Producers type with `@repo/types`; shapes are assignable.
 */
interface LocalizedText {
  ar: string;
  en: string;
}
export interface NextAction {
  label: LocalizedText;
  href?: string;
  onClick?: () => void;
  primary: boolean;
  owner?: LocalizedText;
  dueDate?: string;
}

export interface NextActionPanelProps {
  /**
   * Candidate actions. Exactly one should have `primary: true` (§6.6 — one
   * primary affordance per surface). The primary renders as the prominent
   * button; the rest render visually subordinate (link buttons).
   */
  actions: NextAction[];
  lang?: "ar" | "en";
  /** Optional eyebrow label, e.g. "Recommended next step". */
  heading?: LocalizedText;
  className?: string;
}

const DEFAULT_HEADING: LocalizedText = {
  ar: "الخطوة التالية الموصى بها",
  en: "Recommended next step",
};

function pick(t: LocalizedText | undefined, isArabic: boolean) {
  if (!t) return undefined;
  return isArabic ? t.ar : t.en;
}

/**
 * NextActionPanel — surfaces the single recommended action plus subordinate
 * alternatives. Enforces §6.6 (max one primary button): the first action
 * with `primary: true` becomes the prominent CTA; any further actions render
 * as low-emphasis `link`/`ghost` buttons. Owner + due date are shown as
 * muted metadata. CSS-var colors only, logical spacing, RTL-safe.
 */
function NextActionPanel({
  actions,
  lang = "en",
  heading,
  className,
}: NextActionPanelProps) {
  const isArabic = lang === "ar";

  if (!actions.length) return null;

  const primaryIdx = actions.findIndex((a) => a.primary);
  const primary = primaryIdx >= 0 ? actions[primaryIdx] : actions[0];
  const secondary = actions.filter((a) => a !== primary);

  const head = pick(heading, isArabic) ?? pick(DEFAULT_HEADING, isArabic);
  const primaryLabel = pick(primary?.label, isArabic) ?? "";
  const owner = pick(primary?.owner, isArabic);

  const renderActionButton = (
    action: NextAction,
    kind: "primary" | "secondary",
  ) => {
    const label = pick(action.label, isArabic) ?? "";
    const variant = kind === "primary" ? "primary" : "link";
    const size = kind === "primary" ? "md" : "sm";
    if (action.href) {
      return (
        <Button asChild variant={variant} size={size}>
          <Link href={action.href}>{label}</Link>
        </Button>
      );
    }
    return (
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={action.onClick}
      >
        {label}
      </Button>
    );
  };

  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-card p-4 shadow-card",
        "border-s-4 border-s-primary",
        className,
      )}
      aria-label={head}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {head}
      </p>

      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-foreground">
            {primaryLabel}
          </h3>
          {(owner || primary?.dueDate) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {owner && (
                <span className="inline-flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" aria-hidden="true" />
                  {owner}
                </span>
              )}
              {primary?.dueDate && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  />
                  <span dir="ltr" className="tabular-nums">
                    {primary.dueDate}
                  </span>
                </span>
              )}
            </div>
          )}
        </div>

        {primary && (
          <div className="shrink-0">
            {renderActionButton(primary, "primary")}
          </div>
        )}
      </div>

      {secondary.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3">
          {secondary.map((action, idx) => (
            <React.Fragment key={`${pick(action.label, isArabic)}-${idx}`}>
              {renderActionButton(action, "secondary")}
            </React.Fragment>
          ))}
        </div>
      )}
    </section>
  );
}

export { NextActionPanel };
