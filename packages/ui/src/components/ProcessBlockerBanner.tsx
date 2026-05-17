"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, AlertCircle, X, ChevronDown } from "lucide-react";
import { cn } from "../lib/utils";

/**
 * Structurally identical to `@repo/types` `ProcessBlocker` — re-declared
 * locally to keep `@repo/ui` decoupled from `@repo/types`. Producers type
 * with `@repo/types`; shapes are assignable.
 */
interface LocalizedText {
  ar: string;
  en: string;
}
type BlockerSeverity = "warning" | "error";
export interface ProcessBlocker {
  id: string;
  severity: BlockerSeverity;
  title: LocalizedText;
  detail: LocalizedText;
  actionLabel?: LocalizedText;
  actionHref?: string;
}

export interface ProcessBlockerBannerProps {
  blockers: ProcessBlocker[];
  lang?: "ar" | "en";
  /** Called when the user dismisses the banner (trailing-edge ×). */
  onDismiss?: () => void;
  className?: string;
}

const SEVERITY_RANK: Record<BlockerSeverity, number> = {
  error: 0,
  warning: 1,
};

/** §6.11.2: warning → amber, error → red. CSS-var tints only. */
const TONE: Record<
  BlockerSeverity,
  { wrap: string; icon: React.ElementType; iconCls: string; action: string }
> = {
  warning: {
    wrap: "bg-warning/10 border-warning/30 text-warning",
    icon: AlertTriangle,
    iconCls: "text-warning",
    action: "text-warning hover:bg-warning/15",
  },
  error: {
    wrap: "bg-destructive/10 border-destructive/30 text-destructive",
    icon: AlertCircle,
    iconCls: "text-destructive",
    action: "text-destructive hover:bg-destructive/15",
  },
};

function pick(t: LocalizedText, isArabic: boolean) {
  return isArabic ? t.ar : t.en;
}

/**
 * ProcessBlockerBanner — renders lifecycle blockers under the §6.11.2 banner
 * taxonomy:
 *  - warning = amber, error = red, leading severity icon
 *  - heading bold + 1-line detail (≤2 lines total), max 1 action button
 *  - dismiss `×` on the trailing edge (auto-flips in RTL via logical layout)
 *  - never stack >2 — when there are 3+ blockers it collapses to a single
 *    "N issues" summary row that expands on click (the worst severity drives
 *    the banner color).
 *
 * No `dark:` utilities — semantic CSS vars only.
 */
function ProcessBlockerBanner({
  blockers,
  lang = "en",
  onDismiss,
  className,
}: ProcessBlockerBannerProps) {
  const isArabic = lang === "ar";
  const [expanded, setExpanded] = React.useState(false);

  if (!blockers.length) return null;

  // Worst severity drives the collapsed banner tone.
  const sorted = [...blockers].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
  );
  const worst = sorted[0]!.severity;
  const tone = TONE[worst];

  const dismissBtn = onDismiss ? (
    <button
      type="button"
      onClick={onDismiss}
      aria-label={isArabic ? "إغلاق" : "Dismiss"}
      className={cn(
        "ms-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
        "hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]",
      )}
    >
      <X className="h-4 w-4" aria-hidden="true" />
    </button>
  ) : null;

  const renderAction = (b: ProcessBlocker) =>
    b.actionLabel && b.actionHref ? (
      <Link
        href={b.actionHref}
        className={cn(
          "inline-flex h-8 shrink-0 items-center rounded-md px-3 text-xs font-semibold transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]",
          tone.action,
        )}
      >
        {pick(b.actionLabel, isArabic)}
      </Link>
    ) : null;

  // ── 1–2 blockers: render them stacked (max 2 per §6.11.2). ──
  if (blockers.length <= 2) {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        {blockers.map((b) => {
          const bt = TONE[b.severity];
          const Icon = bt.icon;
          return (
            <div
              key={b.id}
              role={b.severity === "error" ? "alert" : "status"}
              className={cn(
                "flex items-start gap-3 rounded-lg border px-4 py-3",
                bt.wrap,
              )}
            >
              <Icon
                className={cn("mt-0.5 h-5 w-5 shrink-0", bt.iconCls)}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {pick(b.title, isArabic)}
                </p>
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                  {pick(b.detail, isArabic)}
                </p>
              </div>
              {renderAction(b)}
              {dismissBtn}
            </div>
          );
        })}
      </div>
    );
  }

  // ── 3+ blockers: collapse to a single "N issues" summary row. ──
  const Icon = tone.icon;
  const summary = isArabic
    ? `${blockers.length} مشكلات`
    : `${blockers.length} issues`;

  return (
    <div
      className={cn("rounded-lg border", tone.wrap, className)}
      role={worst === "error" ? "alert" : "status"}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <Icon
          className={cn("h-5 w-5 shrink-0", tone.iconCls)}
          aria-hidden="true"
        />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 text-start text-sm font-semibold text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))] rounded-sm",
          )}
        >
          {summary}
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              expanded && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>
        {dismissBtn}
      </div>
      {expanded && (
        <ul className="border-t border-current/15 px-4 py-2">
          {sorted.map((b) => {
            const bt = TONE[b.severity];
            const BIcon = bt.icon;
            return (
              <li
                key={b.id}
                className="flex items-start gap-3 py-2 last:pb-1"
              >
                <BIcon
                  className={cn("mt-0.5 h-4 w-4 shrink-0", bt.iconCls)}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {pick(b.title, isArabic)}
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                    {pick(b.detail, isArabic)}
                  </p>
                </div>
                {renderAction(b)}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export { ProcessBlockerBanner };
