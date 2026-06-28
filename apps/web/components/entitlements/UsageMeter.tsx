"use client";

import * as React from "react";
import { useLanguage } from "../LanguageProvider";

/**
 * UsageMeter — a usage-vs-limit bar for plan LIMIT entitlements (§6.8 usage cues).
 *
 * Neutral track + a fill colored by ratio: <80% primary, ≥80% warning,
 * ≥100% destructive. `limit = null` (or non-finite) renders an "Unlimited"
 * value and no bar. RTL-safe: the fill grows from the inline-start edge
 * (`start-0`); numbers stay LTR + tabular. `label` is the already-resolved
 * (bilingual) metric name supplied by the caller.
 */
export function UsageMeter({
  current,
  limit,
  label,
  className = "",
}: {
  current: number;
  limit: number | null;
  label: string;
  className?: string;
}) {
  const { t } = useLanguage();
  const unlimited = limit === null || !Number.isFinite(limit);
  const pct = unlimited || (limit ?? 0) <= 0 ? 0 : Math.min(100, Math.round((current / (limit as number)) * 100));
  const remaining = unlimited ? Infinity : Math.max(0, (limit as number) - current);
  const fillColor = pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-warning" : "bg-primary";

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground tabular-nums" dir="ltr">
          {unlimited ? (
            t("غير محدود", "Unlimited")
          ) : (
            <>
              {current.toLocaleString("en-US")} / {(limit as number).toLocaleString("en-US")}
            </>
          )}
        </span>
      </div>
      {!unlimited && (
        <>
          <div
            className="relative h-2 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={current}
            aria-valuemin={0}
            aria-valuemax={limit as number}
            aria-label={label}
          >
            <div
              className={`absolute inset-y-0 start-0 rounded-full transition-[width] ${fillColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            {pct >= 100
              ? t("تم بلوغ الحد الأقصى", "Limit reached")
              : t(`متبقٍ ${remaining.toLocaleString("en-US")}`, `${remaining.toLocaleString("en-US")} remaining`)}
          </p>
        </>
      )}
    </div>
  );
}
