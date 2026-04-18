import * as React from "react";
import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { cn } from "../lib/utils";

/**
 * EmptyState — 5-element formula per CLAUDE.md § 6.12:
 *   1. `icon` (optional illustration above the title)
 *   2. `title` — contextual, subject-specific (e.g. "No contracts yet", not "No data")
 *   3. `description` — one-line value statement: what this surface helps the user accomplish
 *   4. `action` — primary CTA (the create/import verb as a Button)
 *   5. `secondaryAction` — optional lateral path (e.g. "Import from Ejar")
 *   6. `helpHref` + `helpLabel` — optional deep-link to help article
 *
 * Works for every § 6.12 state variant via the `variant` prop; compact variant
 * keeps the component viable inside cards/panels.
 */
export interface EmptyStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: React.ReactNode;
  /** Contextual, subject-specific title. Required. */
  title: React.ReactNode;
  /**
   * One-line value statement — what this surface helps the user accomplish.
   * e.g. "Track every lease and sale from draft to signed."
   */
  description?: React.ReactNode;
  /** Primary CTA — typically a `<Button>` with a verb label. */
  action?: React.ReactNode;
  /** Optional secondary action — lateral path. */
  secondaryAction?: React.ReactNode;
  /** Optional help-article link target (deep-link to /dashboard/help#anchor). */
  helpHref?: string;
  /** Optional help-article link label, e.g. "Learn about contracts". */
  helpLabel?: React.ReactNode;
  /**
   * Which § 6.12 state this represents. Used for default icon tint only —
   * caller still supplies the icon + copy.
   */
  variant?: "default" | "first-time" | "filtered" | "error" | "offline";
  compact?: boolean;
}

const VARIANT_ICON_TONE: Record<NonNullable<EmptyStateProps["variant"]>, string> = {
  default: "text-muted-foreground/40",
  "first-time": "text-primary/50",
  filtered: "text-muted-foreground/40",
  error: "text-destructive/60",
  offline: "text-warning/60",
};

function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  helpHref,
  helpLabel,
  variant = "default",
  compact = false,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-6 px-4" : "py-16 px-6",
        className,
      )}
      {...props}
    >
      {icon && (
        <div
          className={cn(
            VARIANT_ICON_TONE[variant],
            compact ? "mb-2" : "mb-4",
          )}
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      <h3
        className={cn(
          "font-semibold text-foreground",
          compact ? "text-sm mb-0.5" : "text-base mb-1",
        )}
      >
        {title}
      </h3>
      {description && (
        <p
          className={cn(
            "text-muted-foreground max-w-sm leading-relaxed",
            compact ? "text-xs mb-2" : "text-sm mb-4",
          )}
        >
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div
          className={cn(
            "flex flex-wrap items-center justify-center gap-2",
            compact ? "mt-1" : "mt-2",
          )}
        >
          {action}
          {secondaryAction}
        </div>
      )}
      {helpHref && helpLabel && (
        <Link
          href={helpHref}
          className={cn(
            "inline-flex items-center gap-1.5 font-medium text-primary hover:underline",
            compact ? "mt-2 text-[11px]" : "mt-4 text-xs",
          )}
        >
          <HelpCircle
            className={compact ? "h-3 w-3" : "h-3.5 w-3.5"}
            aria-hidden="true"
          />
          {helpLabel}
        </Link>
      )}
    </div>
  );
}

export { EmptyState };
