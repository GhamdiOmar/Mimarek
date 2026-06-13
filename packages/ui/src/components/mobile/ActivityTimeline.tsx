"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

export type ActivityTimelineTone =
  | "default"
  | "primary"
  | "success"
  | "info"
  | "warning"
  | "destructive";

export interface ActivityTimelineEvent {
  key: string;
  /** Inline icon — small Lucide. */
  icon?: LucideIcon;
  /** Short headline. */
  label: React.ReactNode;
  /** Pre-formatted relative time ("3h ago", "منذ ٣ ساعات"). */
  at: React.ReactNode;
  /** Optional second line (e.g. an actor name or description). */
  detail?: React.ReactNode;
  tone?: ActivityTimelineTone;
}

export interface ActivityTimelineProps {
  events: ActivityTimelineEvent[];
  className?: string;
  /** Shown when events is empty. */
  emptyState?: React.ReactNode;
}

const DOT: Record<ActivityTimelineTone, string> = {
  default: "bg-muted-foreground",
  primary: "bg-primary",
  success: "bg-success",
  info: "bg-info",
  warning: "bg-warning",
  destructive: "bg-destructive",
};

const ICON_TONE: Record<ActivityTimelineTone, string> = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success-strong",
  info: "bg-info/10 text-info",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
};

/**
 * ActivityTimeline — vertical event list with rail + dots.
 *
 * Rail is positioned at the `inline-start` edge using logical properties, so
 * the layout mirrors automatically in RTL. Each event shows its own dot;
 * events with an `icon` render the icon tile instead of a bare dot.
 */
function ActivityTimeline({
  events,
  className,
  emptyState,
}: ActivityTimelineProps) {
  if (!events.length) {
    return emptyState ? (
      <div className={cn("py-6 text-center text-sm text-muted-foreground", className)}>
        {emptyState}
      </div>
    ) : null;
  }

  return (
    <ol className={cn("relative ps-6", className)}>
      <span
        aria-hidden="true"
        className="absolute inset-y-1 start-[11px] w-[2px] rounded-full bg-border"
      />
      {events.map((ev) => {
        const tone = ev.tone ?? "default";
        const Icon = ev.icon;
        return (
          <li key={ev.key} className="relative flex gap-3 pb-4 last:pb-0">
            {Icon ? (
              <span
                className={cn(
                  "absolute -start-6 top-0 inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-background",
                  ICON_TONE[tone],
                )}
                aria-hidden="true"
              >
                <Icon className="h-3 w-3" />
              </span>
            ) : (
              <span
                className={cn(
                  "absolute -start-[18px] top-2 inline-block h-2 w-2 rounded-full",
                  DOT[tone],
                )}
                aria-hidden="true"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium text-foreground">
                  {ev.label}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                  {ev.at}
                </span>
              </div>
              {ev.detail ? (
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {ev.detail}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export { ActivityTimeline };
