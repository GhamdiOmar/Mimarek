"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { arSA, enUS } from "date-fns/locale";
import { cn } from "../../lib/utils";
import type { KPIAccent, KPIDelta, KPITier } from "../KPICard";

export type { KPIAccent, KPIDelta, KPITier } from "../KPICard";

export type MobileKPITone =
  | "default"
  | "primary"
  | "green"
  | "amber"
  | "red"
  | "blue";

/** Legacy delta shape — kept for callers that still pass a pre-formatted string. */
export interface MobileKPIDelta {
  label: string;
  direction: "up" | "down" | "flat";
}

export interface MobileKPICardProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  subtitle?: string;
  icon?: LucideIcon;
  /** Shared accent token. Takes precedence over `tone`. */
  accent?: KPIAccent;
  /** Legacy colour token. Mapped to `accent` internally. */
  tone?: MobileKPITone;
  /**
   * Visual tier. Defaults to `"standard"`. `"hero"` renders the card full-width
   * with a larger value + taller sparkline; `"utility"` is compact (no spark,
   * small value).
   */
  tier?: KPITier;
  /** Hero-only: one-line insight under the value. */
  secondaryInsight?: string;
  /** Shared KPIDelta (numeric value + direction) OR legacy {label, direction}. */
  delta?: KPIDelta | MobileKPIDelta;
  /** Shared name for the sparkline series. `sparkline` is kept as an alias. */
  trend?: number[];
  /** Legacy alias for `trend`. */
  sparkline?: number[];
  comparisonPeriod?: string;
  lastUpdated?: Date | string | number;
  locale?: "ar" | "en";
  href?: string;
  onClick?: () => void;
  loading?: boolean;
  className?: string;
}

const TONE_TO_ACCENT: Record<MobileKPITone, KPIAccent> = {
  default: "primary",
  primary: "primary",
  green: "success",
  amber: "warning",
  red: "destructive",
  blue: "info",
};

const ICON_BG: Record<KPIAccent, string> = {
  primary: "bg-primary/10 text-primary",
  secondary: "bg-secondary/10 text-secondary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
  accent: "bg-accent/10 text-accent",
};

const STROKE: Record<KPIAccent, string> = {
  primary: "hsl(var(--primary))",
  secondary: "hsl(var(--secondary))",
  success: "hsl(var(--success))",
  warning: "hsl(var(--warning))",
  destructive: "hsl(var(--destructive))",
  info: "hsl(var(--info))",
  accent: "hsl(var(--accent))",
};

function buildSparklinePath(points: number[], w: number, h: number): string {
  if (points.length < 2) return "";
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const stepX = w / (points.length - 1);
  return points
    .map((p, i) => {
      const x = i * stepX;
      const y = h - ((p - min) / span) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function isKPIDelta(d: KPIDelta | MobileKPIDelta): d is KPIDelta {
  return (
    typeof (d as KPIDelta).value === "number" &&
    typeof (d as MobileKPIDelta).label !== "string"
  );
}

function resolveDirection(
  d: KPIDelta | MobileKPIDelta | undefined,
): "up" | "down" | "flat" {
  if (!d) return "flat";
  if (d.direction) return d.direction;
  if (isKPIDelta(d)) {
    if (d.value > 0) return "up";
    if (d.value < 0) return "down";
  }
  return "flat";
}

function deltaTone(direction: "up" | "down" | "flat", isGoodIfUp: boolean) {
  if (direction === "flat") return "bg-muted text-muted-foreground";
  const good =
    (direction === "up" && isGoodIfUp) ||
    (direction === "down" && !isGoodIfUp);
  return good
    ? "bg-success/10 text-success"
    : "bg-destructive/10 text-destructive";
}

/**
 * MobileKPICard — hero metric card for the mobile Home grid.
 * Shares the `KPIAccent` / `KPIDelta` type shape with desktop `KPICard`.
 * Legacy `tone=` and legacy delta `{label, direction}` shapes still accepted.
 */
function MobileKPICard({
  label,
  value,
  unit,
  subtitle,
  icon: Icon,
  accent,
  tone = "primary",
  tier,
  secondaryInsight,
  delta,
  trend,
  sparkline,
  comparisonPeriod,
  lastUpdated,
  locale,
  href,
  onClick,
  loading = false,
  className,
}: MobileKPICardProps) {
  const resolvedAccent: KPIAccent = accent ?? TONE_TO_ACCENT[tone];
  const resolvedTier: KPITier = tier ?? "standard";
  const isHero = resolvedTier === "hero";
  const isUtility = resolvedTier === "utility";
  const interactive = Boolean(href || onClick);
  const series = trend ?? sparkline;

  if (loading) {
    return (
      <div
        className={cn(
          "flex flex-col rounded-2xl border border-border bg-card",
          isUtility ? "p-3" : isHero ? "p-5" : "p-4",
          className,
        )}
      >
        <div className="space-y-2">
          <div className={cn("animate-pulse rounded bg-muted", isUtility ? "h-2.5 w-16" : "h-3 w-20")} />
          <div className={cn("animate-pulse rounded bg-muted", isHero ? "h-10 w-40" : isUtility ? "h-5 w-20" : "h-7 w-28")} />
          {!isUtility && <div className={cn("animate-pulse rounded bg-muted", isHero ? "h-10 w-full" : "h-8 w-full")} />}
        </div>
      </div>
    );
  }

  const direction = resolveDirection(delta);
  const isGoodIfUp =
    delta && isKPIDelta(delta) ? (delta.isGoodIfUp ?? true) : true;

  const effLocale: "ar" | "en" =
    locale ??
    (typeof document !== "undefined" && document.documentElement.lang === "ar"
      ? "ar"
      : "en");

  const ago =
    lastUpdated != null
      ? formatDistanceToNow(new Date(lastUpdated), {
          addSuffix: true,
          locale: effLocale === "ar" ? arSA : enUS,
        })
      : null;

  const deltaIcon =
    direction === "up" ? (
      <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
    ) : direction === "down" ? (
      <ArrowDownRight className="h-3 w-3" aria-hidden="true" />
    ) : (
      <Minus className="h-3 w-3" aria-hidden="true" />
    );

  const deltaLabel = (() => {
    if (!delta) return null;
    if (isKPIDelta(delta)) {
      return (
        <span className="number-ltr">
          {Math.abs(delta.value)}
          {delta.unit ?? "%"}
        </span>
      );
    }
    return <span className="number-ltr">{delta.label}</span>;
  })();

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {Icon ? (
            <span
              className={cn(
                "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                ICON_BG[resolvedAccent],
              )}
              aria-hidden="true"
            >
              <Icon className="h-4 w-4" />
            </span>
          ) : null}
          <span className="truncate text-xs font-medium text-muted-foreground">
            {label}
          </span>
        </div>
        {delta ? (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
              deltaTone(direction, isGoodIfUp),
            )}
          >
            {deltaIcon}
            {deltaLabel}
          </span>
        ) : null}
      </div>

      <div
        className={cn(
          "mt-2 flex items-baseline gap-1.5 font-bold tracking-tight text-foreground tabular-nums",
          isHero ? "text-[clamp(28px,6vw,36px)]" : isUtility ? "text-lg" : "text-2xl",
        )}
      >
        <span dir="ltr" className="inline-block">
          {value}
        </span>
        {unit ? (
          <span
            className={cn(
              "font-normal text-muted-foreground",
              isHero ? "text-sm" : "text-xs",
            )}
          >
            {unit}
          </span>
        ) : null}
      </div>

      {isHero && secondaryInsight ? (
        <p className="mt-1 text-xs text-muted-foreground leading-snug">
          {secondaryInsight}
        </p>
      ) : null}

      {comparisonPeriod && !isUtility ? (
        <div className="mt-1 text-[11px] text-muted-foreground">
          {comparisonPeriod}
        </div>
      ) : null}

      {subtitle && !isUtility ? (
        <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
          {subtitle}
        </p>
      ) : null}

      {series && series.length >= 2 && !isUtility ? (
        <svg
          viewBox={isHero ? "0 0 100 40" : "0 0 100 32"}
          preserveAspectRatio="none"
          className={cn("w-full", isHero ? "mt-2 h-10" : "mt-2 h-8")}
          aria-hidden="true"
        >
          <path
            d={buildSparklinePath(series, 100, isHero ? 40 : 32)}
            fill="none"
            stroke={STROKE[resolvedAccent]}
            strokeWidth={isHero ? 2 : 1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : !isUtility ? (
        <div className="mt-2 h-8" aria-hidden="true" />
      ) : null}

      {ago && !isUtility ? (
        <div className="mt-1 text-[10px] text-muted-foreground">{ago}</div>
      ) : null}
    </>
  );

  const baseClasses = cn(
    "flex flex-col rounded-2xl border border-border bg-card",
    isUtility ? "p-3" : isHero ? "p-5" : "p-4",
    interactive
      ? "transition-all active:scale-[0.98] hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]"
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
        style={{ display: "flex" }}
      >
        {body}
      </button>
    );
  }
  return <div className={baseClasses}>{body}</div>;
}

export { MobileKPICard };
