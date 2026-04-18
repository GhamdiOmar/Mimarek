"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";
import { formatDistanceToNow } from "date-fns";
import { arSA, enUS } from "date-fns/locale";

export type KPIAccent =
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "destructive"
  | "info"
  | "accent";

export interface KPIDelta {
  /** Signed percentage (-100..+∞) or absolute number. Caller decides. */
  value: number;
  direction?: "up" | "down" | "flat";
  /** True when "up" is good (revenue). False when "down" is good (churn). Default true. */
  isGoodIfUp?: boolean;
  /** Suffix for the delta pill. Defaults to "%". */
  unit?: "%" | "";
}

/**
 * KPI tier per CLAUDE.md § 6.8 / § 6.9.1 — controls visual weight.
 * - `hero`: page's North Star metric. 1.3× standard scale, stronger accent
 *   bar (6px), optional secondary insight line, denser sparkline.
 *   **Use exactly ONE per dashboard.**
 * - `standard`: default 8-field anatomy.
 * - `utility`: compact metadata tile. No sparkline, no accent bar,
 *   smaller value type. For secondary rows and filter panels.
 */
export type KPITier = "hero" | "standard" | "utility";

export interface KPICardProps {
  /** Noun-phrase label, e.g. "Monthly Revenue". */
  label: string;
  /** Big number — formatted string or React node. */
  value: React.ReactNode;
  /** Trailing unit, e.g. "SAR", "%", "days". */
  unit?: string;
  /** Optional single-line caption under the delta. */
  subtitle?: string;
  /** Short icon for category cue. Accepts Lucide icon or a rendered node. */
  icon?: LucideIcon | React.ReactNode;
  /** Colored left accent bar + icon tint. */
  accent?: KPIAccent;
  /** @deprecated use `accent`. Retained for legacy callers. */
  accentColor?: KPIAccent;
  /**
   * Visual tier — drives size, accent weight, and sparkline density.
   * Defaults to `"standard"`. Use `"hero"` for exactly one North Star metric
   * per dashboard; `"utility"` for compact secondary metrics.
   */
  tier?: KPITier;
  /**
   * Hero-only: one-line insight under the value (e.g. "+12 leases vs. same
   * week last year"). Ignored on standard/utility tiers.
   */
  secondaryInsight?: string;
  /** Delta vs comparison period. Accepts the new object shape or the legacy {value,label,direction}. */
  delta?: KPIDelta;
  /** Legacy alias — `trend={{value, label, direction}}`. Mapped to `delta` + `subtitle`. */
  trend?:
    | number[]
    | { value: number; label?: string; direction?: "up" | "down" | "flat" };
  /** Human-readable period, e.g. "vs. last month". */
  comparisonPeriod?: string;
  /** Click target — renders the whole card as a link. */
  href?: string;
  /** Controls click handler when href is not used. */
  onClick?: () => void;
  /** Last-refresh timestamp — renders "X ago". */
  lastUpdated?: Date | string | number;
  /** Locale for the "ago" phrase and delta tooltip. */
  locale?: "ar" | "en";
  loading?: boolean;
  /** @deprecated use `tier="utility"`. Retained for legacy callers. */
  compact?: boolean;
  className?: string;
}

const BORDER: Record<KPIAccent, string> = {
  primary: "border-s-primary",
  secondary: "border-s-secondary",
  success: "border-s-success",
  warning: "border-s-warning",
  destructive: "border-s-destructive",
  info: "border-s-info",
  accent: "border-s-accent",
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

function sparkPath(points: number[], w: number, h: number): string {
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

function resolveDirection(d?: KPIDelta): "up" | "down" | "flat" {
  if (!d) return "flat";
  if (d.direction) return d.direction;
  if (d.value > 0) return "up";
  if (d.value < 0) return "down";
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

export function KPICard({
  label,
  value,
  unit,
  subtitle,
  icon,
  accent,
  accentColor,
  tier,
  secondaryInsight,
  delta,
  trend,
  comparisonPeriod,
  href,
  onClick,
  lastUpdated,
  locale,
  loading = false,
  compact = false,
  className,
}: KPICardProps) {
  const resolvedAccent: KPIAccent = accent ?? accentColor ?? "primary";
  const resolvedTier: KPITier = tier ?? (compact ? "utility" : "standard");
  const isHero = resolvedTier === "hero";
  const isUtility = resolvedTier === "utility";

  // Normalise legacy trend shape.
  let sparkline: number[] | undefined;
  let legacyDelta: KPIDelta | undefined;
  let legacyLabel: string | undefined;
  if (Array.isArray(trend)) {
    sparkline = trend;
  } else if (trend && typeof trend === "object") {
    legacyDelta = {
      value: trend.value,
      direction: trend.direction,
    };
    legacyLabel = trend.label;
  }
  const finalDelta = delta ?? legacyDelta;
  const finalSubtitle = subtitle ?? legacyLabel;
  const isLucide = typeof icon === "function";
  const IconNode = isLucide ? (icon as LucideIcon) : null;

  const padding = isHero ? "p-7" : isUtility ? "p-3" : "p-6";
  const borderSide = isUtility
    ? ""
    : isHero
      ? "border-s-[6px]"
      : "border-s-4";

  if (loading) {
    return (
      <div
        className={cn(
          "rounded-lg border border-border bg-card shadow-card",
          borderSide,
          padding,
          className,
        )}
      >
        <div className="space-y-3">
          <div className={cn("animate-pulse rounded bg-muted", isUtility ? "h-2.5 w-16" : "h-3 w-24")} />
          <div className={cn("animate-pulse rounded bg-muted", isHero ? "h-12 w-48" : isUtility ? "h-5 w-20" : "h-8 w-32")} />
          {!isUtility && <div className="h-8 w-full animate-pulse rounded bg-muted" />}
        </div>
      </div>
    );
  }

  const direction = resolveDirection(finalDelta);
  const isGoodIfUp = finalDelta?.isGoodIfUp ?? true;
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

  const interactive = Boolean(href || onClick);
  const valueClass = isHero
    ? "text-[clamp(36px,4vw,48px)] leading-[1.1]"
    : isUtility
      ? "text-xl"
      : "text-3xl";
  const labelClass = isHero
    ? "text-sm"
    : isUtility
      ? "text-[11px]"
      : "text-xs";
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <span
            className={cn("block font-medium text-muted-foreground", labelClass)}
          >
            {label}
          </span>
          <div
            className={cn(
              "mt-1.5 flex items-baseline gap-1.5 font-bold text-card-foreground tabular-nums",
              valueClass,
            )}
          >
            <span dir="ltr" className="inline-block">{value}</span>
            {unit && (
              <span
                className={cn(
                  "font-normal text-muted-foreground",
                  isHero ? "text-base" : "text-sm",
                )}
              >
                {unit}
              </span>
            )}
          </div>
          {isHero && secondaryInsight && (
            <p className="mt-1.5 text-sm text-muted-foreground leading-snug">
              {secondaryInsight}
            </p>
          )}
          {finalDelta && (
            <div className={cn("flex items-center gap-2", isHero ? "mt-3" : "mt-2")}>
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full font-semibold tabular-nums",
                  isHero
                    ? "px-2 py-0.5 text-xs"
                    : "px-1.5 py-0.5 text-[11px]",
                  deltaTone(direction, isGoodIfUp),
                )}
              >
                {deltaIcon}
                <span className="number-ltr">
                  {Math.abs(finalDelta.value)}
                  {finalDelta.unit ?? "%"}
                </span>
              </span>
              {comparisonPeriod && (
                <span
                  className={cn(
                    "text-muted-foreground",
                    isHero ? "text-xs" : "text-[11px]",
                  )}
                >
                  {comparisonPeriod}
                </span>
              )}
            </div>
          )}
          {finalSubtitle && !isUtility && (
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              {finalSubtitle}
            </p>
          )}
        </div>
        {icon && !isUtility && (
          <span
            className={cn(
              "flex shrink-0 items-center justify-center rounded-full",
              isHero ? "h-12 w-12" : "h-10 w-10",
              ICON_BG[resolvedAccent],
            )}
            aria-hidden="true"
          >
            {IconNode ? (
              <IconNode className={isHero ? "h-6 w-6" : "h-5 w-5"} />
            ) : (
              (icon as React.ReactNode)
            )}
          </span>
        )}
      </div>

      {sparkline && sparkline.length >= 2 && !isUtility && (
        <svg
          viewBox={isHero ? "0 0 100 48" : "0 0 100 32"}
          preserveAspectRatio="none"
          className={cn("w-full", isHero ? "mt-4 h-12" : "mt-3 h-8")}
          aria-hidden="true"
        >
          <path
            d={sparkPath(sparkline, 100, isHero ? 48 : 32)}
            fill="none"
            stroke={STROKE[resolvedAccent]}
            strokeWidth={isHero ? 2 : 1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}

      {ago && !isUtility && (
        <div className="mt-2 text-[11px] text-muted-foreground">{ago}</div>
      )}
    </>
  );

  const classes = cn(
    "block rounded-lg border border-border bg-card transition-shadow duration-200",
    isHero ? "shadow-md" : "shadow-card",
    borderSide,
    !isUtility && BORDER[resolvedAccent],
    interactive && "hover:shadow-elevation-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
    padding,
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(classes, "text-start w-full")}
        style={{ display: "block" }}
      >
        {body}
      </button>
    );
  }
  return <div className={classes}>{body}</div>;
}
