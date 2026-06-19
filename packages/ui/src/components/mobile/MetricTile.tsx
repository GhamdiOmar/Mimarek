import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

export type MetricTone =
  | "default"
  | "blue"
  | "green"
  | "amber"
  | "red"
  | "primary";

export interface MetricTileProps {
  label: string;
  /** Big number — caller is responsible for formatting (SAR, %, etc.). */
  value: React.ReactNode;
  /** Pill text under the value (e.g., a trend). Caller composes icon + text. */
  hint?: React.ReactNode;
  tone?: MetricTone;
  icon?: LucideIcon;
  className?: string;
  onClick?: () => void;
  href?: string;
}

const TONE_CLASSES: Record<MetricTone, string> = {
  default: "bg-muted text-foreground",
  blue: "bg-info/10 text-foreground border border-info/20 dark:bg-info/10 dark:border-info/25",
  green: "bg-success/10 text-foreground border border-success/20 dark:bg-success/10 dark:border-success/25",
  amber: "bg-warning/10 text-foreground border border-warning/20 dark:bg-warning/10 dark:border-warning/25",
  red: "bg-destructive/10 text-foreground border border-destructive/20 dark:bg-destructive/10 dark:border-destructive/25",
  primary: "bg-primary/10 text-foreground border border-primary/20 dark:bg-primary/10 dark:border-primary/25",
};

/**
 * MetricTile — compact metric card sized for a 2×2 mobile grid.
 *
 * Shows a label + optional icon, a prominent value, and an optional hint pill.
 * When `href` or `onClick` is provided the tile becomes interactive with a
 * subtle lift animation.
 */
function MetricTile({
  label,
  value,
  hint,
  tone = "default",
  icon: Icon,
  className,
  onClick,
  href,
}: MetricTileProps) {
  const interactive = Boolean(href || onClick);

  const body = (
    <>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-foreground/70">
        {Icon ? (
          <Icon className="h-4 w-4" aria-hidden="true" />
        ) : null}
        <span className="truncate">{label}</span>
      </div>
      <div className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {value}
      </div>
      {hint ? (
        <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-card/60 px-2 py-1 text-[11px] font-semibold text-foreground/80">
          {hint}
        </span>
      ) : null}
    </>
  );

  const baseClasses = cn(
    "flex min-h-[100px] flex-col justify-between rounded-2xl p-4",
    TONE_CLASSES[tone],
    interactive
      ? "transition-all hover:brightness-105 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]"
      : undefined,
    className,
  );

  if (href) {
    return (
      <Link href={href} className={baseClasses}>
        {body}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(baseClasses, "text-start")}
      >
        {body}
      </button>
    );
  }

  return <div className={baseClasses}>{body}</div>;
}

export { MetricTile };
