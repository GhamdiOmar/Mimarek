"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { arSA, enUS } from "date-fns/locale";
import { cn } from "../lib/utils";

export interface LastUpdatedAgoProps {
  /** Last-refresh timestamp. */
  timestamp: Date | string | number;
  /** Refresh interval in ms for the "ago" phrase. Default 60 000. */
  tickMs?: number;
  /** Optional refresh handler — renders a button if provided. */
  onRefresh?: () => void | Promise<void>;
  locale?: "ar" | "en";
  className?: string;
}

export function LastUpdatedAgo({
  timestamp,
  tickMs = 60_000,
  onRefresh,
  locale,
  className,
}: LastUpdatedAgoProps) {
  const [, setTick] = React.useState(0);
  const [refreshing, setRefreshing] = React.useState(false);

  React.useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), tickMs);
    return () => window.clearInterval(id);
  }, [tickMs]);

  const effLocale: "ar" | "en" =
    locale ??
    (typeof document !== "undefined" && document.documentElement.lang === "ar"
      ? "ar"
      : "en");

  const ago = formatDistanceToNow(new Date(timestamp), {
    addSuffix: true,
    locale: effLocale === "ar" ? arSA : enUS,
  });

  const label = effLocale === "ar" ? `آخر تحديث ${ago}` : `Updated ${ago}`;

  const handleClick = async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const inner = (
    <>
      <RefreshCw
        className={cn("h-3.5 w-3.5 opacity-70", refreshing && "animate-spin")}
        aria-hidden="true"
      />
      <span>{label}</span>
    </>
  );

  const base = "inline-flex items-center gap-1.5 text-xs text-muted-foreground";

  if (onRefresh) {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={refreshing}
        className={cn(
          base,
          "rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          className,
        )}
        style={{ display: "inline-flex" }}
      >
        {inner}
      </button>
    );
  }

  return <span className={cn(base, className)}>{inner}</span>;
}
