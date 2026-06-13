"use client";

import * as React from "react";
import { ChevronRight, Check, AlertTriangle } from "lucide-react";
import { cn } from "../lib/utils";
import { StatusBadge } from "./StatusBadge";
import { DirectionalIcon } from "./DirectionalIcon";

/**
 * Structurally identical to `@repo/types` `LocalizedText` / `ProcessStage`.
 * Re-declared locally so `@repo/ui` stays decoupled from `@repo/types` (no
 * workspace-dependency or build-config change needed). Producers type their
 * data with `@repo/types`; the shapes are assignable.
 */
interface LocalizedText {
  ar: string;
  en: string;
}
type StageStatus = "done" | "current" | "upcoming" | "blocked";
export interface LifecycleStage {
  id: string;
  label: LocalizedText;
  status: StageStatus;
}

export interface LifecycleRailProps {
  /** Ordered lifecycle stages (mirror VALID_TRANSITIONS vocabulary). */
  stages: LifecycleStage[];
  lang?: "ar" | "en";
  /** Optional accessible label for the rail (e.g. "Contract lifecycle"). */
  ariaLabel?: string;
  className?: string;
}

const STATUS_BADGE: Record<
  StageStatus,
  "success" | "info" | "neutral" | "warning"
> = {
  done: "success",
  current: "info",
  upcoming: "neutral",
  blocked: "warning",
};

const STEP_DOT: Record<StageStatus, string> = {
  done: "bg-success/15 text-success-strong",
  current: "bg-primary/15 text-primary ring-2 ring-primary/40",
  upcoming: "bg-muted text-muted-foreground",
  blocked: "bg-warning/15 text-warning",
};

/**
 * LifecycleRail — horizontal, RTL-aware stage rail.
 *
 * Composes `StatusBadge` for each stage and `DirectionalIcon` for the
 * between-stage chevrons (auto-mirrors in RTL via the `.icon-directional`
 * global). Layout uses flex + logical gaps so it flips with `dir="rtl"`
 * without any `dark:` utilities or physical-side classes. The current stage
 * is emphasized with a ring + heavier weight.
 */
function LifecycleRail({
  stages,
  lang = "en",
  ariaLabel,
  className,
}: LifecycleRailProps) {
  const isArabic = lang === "ar";

  if (!stages.length) return null;

  return (
    <ol
      className={cn(
        "flex flex-wrap items-center gap-x-1 gap-y-3",
        className,
      )}
      aria-label={ariaLabel}
    >
      {stages.map((stage, i) => {
        const label = isArabic ? stage.label.ar : stage.label.en;
        const isCurrent = stage.status === "current";
        const isLast = i === stages.length - 1;
        return (
          <li
            key={stage.id}
            className="flex items-center gap-1"
            aria-current={isCurrent ? "step" : undefined}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums",
                  STEP_DOT[stage.status],
                )}
                aria-hidden="true"
              >
                {stage.status === "done" ? (
                  <Check className="h-3.5 w-3.5" />
                ) : stage.status === "blocked" ? (
                  <AlertTriangle className="h-3.5 w-3.5" />
                ) : (
                  i + 1
                )}
              </span>
              <StatusBadge
                variant={STATUS_BADGE[stage.status]}
                label={label}
                className={cn(
                  isCurrent && "font-bold",
                  stage.status === "upcoming" && "opacity-70",
                )}
              />
            </div>
            {!isLast && (
              <DirectionalIcon
                icon={ChevronRight}
                className="h-4 w-4 shrink-0 text-muted-foreground/50"
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export { LifecycleRail };
