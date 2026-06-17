"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, CheckCircle2 } from "lucide-react";
import { cn } from "../lib/utils";
import { DirectionalIcon } from "./DirectionalIcon";
import { EmptyState } from "./EmptyState";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../primitives/card";
import type { LocalizedText } from "../lib/localized-text";

/**
 * `RoleTaskQueueItem` is structurally identical to `@repo/types`
 * `RoleTaskQueueItem`; `LocalizedText` is `@repo/ui`'s own copy (see
 * `../lib/localized-text`) so the package stays decoupled from `@repo/types`.
 * Producers type their data with `@repo/types`; the shapes are assignable.
 */

type ItemSeverity = "info" | "warning" | "error";

export interface RoleTaskQueueItem {
  id: string;
  title: LocalizedText;
  count?: number;
  href: string;
  severity?: ItemSeverity;
}

export interface RoleTaskQueueProps {
  items: RoleTaskQueueItem[];
  lang?: "ar" | "en";
  heading?: LocalizedText;
  className?: string;
}

// Severity ordering: error → warning → info
const SEVERITY_RANK: Record<ItemSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2,
};

// CSS-var tints only — NO dark: utilities
const CHIP: Record<
  ItemSeverity,
  { wrap: string; text: string }
> = {
  error:   { wrap: "bg-destructive/10", text: "text-destructive" },
  warning: { wrap: "bg-warning/10",     text: "text-warning" },
  info:    { wrap: "bg-info/10",         text: "text-info" },
};

function pick(t: LocalizedText, isArabic: boolean) {
  return isArabic ? t.ar : t.en;
}

/**
 * RoleTaskQueue — a sorted, role-scoped list of actionable buckets.
 *
 * Each row links to `item.href`, shows a bilingual title + an optional
 * severity-tinted count chip, and a trailing `DirectionalIcon` chevron
 * (auto-flips in RTL via the `.icon-directional` global).
 *
 * Items are sorted error → warning → info; zero-count items must be filtered
 * out by the producer (not rendered here — the component accepts only what it
 * should display). Empty state renders "All caught up" / "لا مهام عاجلة"
 * using the existing `EmptyState` primitive in compact mode.
 *
 * Design constraints obeyed:
 * - No `dark:` utilities — CSS-var semantic tokens only.
 * - Logical props only (ms-, me-, ps-, pe-, start-, end-) — no ml/mr/left/right.
 * - ≥44px touch targets per row.
 * - `aria-label` on the icon-only chevron is intentionally omitted because
 *   the entire row `<Link>` has a descriptive accessible label.
 */
function RoleTaskQueue({
  items,
  lang = "en",
  heading,
  className,
}: RoleTaskQueueProps) {
  const isArabic = lang === "ar";

  const sorted = React.useMemo(
    () =>
      [...items].sort((a, b) => {
        const ra = SEVERITY_RANK[a.severity ?? "info"];
        const rb = SEVERITY_RANK[b.severity ?? "info"];
        return ra - rb;
      }),
    [items],
  );

  const headingText = heading
    ? pick(heading, isArabic)
    : isArabic
      ? "قائمة المهام"
      : "Task Queue";

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{headingText}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {sorted.length === 0 ? (
          <EmptyState
            compact
            icon={<CheckCircle2 className="h-8 w-8" />}
            variant="default"
            title={
              isArabic ? "لا مهام عاجلة" : "All caught up"
            }
            description={
              isArabic
                ? "لا توجد مهام تستدعي الانتباه الآن."
                : "No pending actions need your attention right now."
            }
          />
        ) : (
          <ul role="list" className="divide-y divide-border">
            {sorted.map((item) => {
              const severity = item.severity ?? "info";
              const chip = CHIP[severity];

              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className={cn(
                      // ≥44px touch target via min-h
                      "group flex min-h-[44px] items-center gap-3 px-4 py-3",
                      "transition-colors hover:bg-muted/40",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset",
                      "focus-visible:ring-[hsl(var(--primary))]",
                    )}
                    aria-label={
                      item.count != null
                        ? `${pick(item.title, isArabic)} (${item.count})`
                        : pick(item.title, isArabic)
                    }
                  >
                    {/* Title */}
                    <span className="min-w-0 flex-1 text-sm font-medium text-foreground truncate">
                      {pick(item.title, isArabic)}
                    </span>

                    {/* Count chip — only when count is provided */}
                    {item.count != null && (
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center justify-center",
                          "min-w-[24px] rounded-full px-2 py-0.5",
                          "text-xs font-semibold tabular-nums",
                          chip.wrap,
                          chip.text,
                        )}
                        aria-hidden="true"
                      >
                        {item.count.toLocaleString("en-US")}
                      </span>
                    )}

                    {/* Trailing directional chevron */}
                    <DirectionalIcon
                      icon={ChevronRight}
                      className={cn(
                        "h-4 w-4 shrink-0 text-muted-foreground/50",
                        "transition-transform group-hover:translate-x-0.5",
                        isArabic && "group-hover:-translate-x-0.5",
                      )}
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export { RoleTaskQueue };
