"use client";

import * as React from "react";
import Link from "next/link";
import {
  User,
  Building2,
  FileText,
  CalendarCheck,
  Receipt,
  Wrench,
  File,
  Link2,
  ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";
import { ResponsiveDialog } from "./mobile/ResponsiveDialog";
import { EmptyState } from "./EmptyState";
import { DirectionalIcon } from "./DirectionalIcon";

/**
 * Structurally identical to `@repo/types` `RelatedRecordSummary` —
 * re-declared locally to keep `@repo/ui` decoupled from `@repo/types`.
 * Producers type with `@repo/types`; shapes are assignable.
 */
interface LocalizedText {
  ar: string;
  en: string;
}
type RelatedKind =
  | "customer"
  | "unit"
  | "contract"
  | "reservation"
  | "invoice"
  | "maintenance"
  | "document";
export interface RelatedRecord {
  kind: RelatedKind;
  id: string;
  label: LocalizedText;
  href: string;
  meta?: LocalizedText;
}

export interface RelatedContextPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  records: RelatedRecord[];
  lang?: "ar" | "en";
  /** Panel title. Defaults to "Related records" / "السجلات المرتبطة". */
  title?: LocalizedText;
  className?: string;
}

const KIND_META: Record<
  RelatedKind,
  { icon: LucideIcon; label: LocalizedText }
> = {
  customer: { icon: User, label: { ar: "العملاء", en: "Customers" } },
  unit: { icon: Building2, label: { ar: "الوحدات", en: "Units" } },
  contract: { icon: FileText, label: { ar: "العقود", en: "Contracts" } },
  reservation: {
    icon: CalendarCheck,
    label: { ar: "الحجوزات", en: "Reservations" },
  },
  invoice: { icon: Receipt, label: { ar: "الفواتير", en: "Invoices" } },
  maintenance: {
    icon: Wrench,
    label: { ar: "الصيانة", en: "Maintenance" },
  },
  document: { icon: File, label: { ar: "المستندات", en: "Documents" } },
};

// Stable display order of groups.
const KIND_ORDER: RelatedKind[] = [
  "customer",
  "unit",
  "contract",
  "reservation",
  "invoice",
  "maintenance",
  "document",
];

function pick(t: LocalizedText | undefined, isArabic: boolean) {
  if (!t) return undefined;
  return isArabic ? t.ar : t.en;
}

/**
 * RelatedContextPanel — a 480px right/left drawer on desktop and a swipe
 * bottom sheet on mobile (both via `ResponsiveDialog`). Lists related
 * records grouped by `kind`, each row a link to the record. Uses the
 * `<EmptyState>` 5-element primitive when there are no related records.
 *
 * Desktop width is pinned to the §6.4.2 drawer size (480px) by overriding
 * the dialog content max-width; the mobile bottom-sheet path is untouched.
 * CSS-var colors only, logical spacing, RTL-safe.
 */
function RelatedContextPanel({
  open,
  onOpenChange,
  records,
  lang = "en",
  title,
  className,
}: RelatedContextPanelProps) {
  const isArabic = lang === "ar";
  const panelTitle =
    pick(title, isArabic) ?? (isArabic ? "السجلات المرتبطة" : "Related records");

  // Group records by kind, preserving KIND_ORDER.
  const groups = React.useMemo(() => {
    const map = new Map<RelatedKind, RelatedRecord[]>();
    for (const r of records) {
      const arr = map.get(r.kind);
      if (arr) arr.push(r);
      else map.set(r.kind, [r]);
    }
    return KIND_ORDER.filter((k) => map.has(k)).map((k) => ({
      kind: k,
      items: map.get(k)!,
    }));
  }, [records]);

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={panelTitle}
      contentClassName="sm:max-w-[480px]"
    >
      <div className={cn("max-h-[70vh] overflow-y-auto", className)}>
        {records.length === 0 ? (
          <EmptyState
            compact
            icon={<Link2 className="h-10 w-10" aria-hidden="true" />}
            title={
              isArabic ? "لا توجد سجلات مرتبطة" : "No related records"
            }
            description={
              isArabic
                ? "ستظهر هنا السجلات المرتبطة بهذا العنصر عند ربطها."
                : "Linked records across the product will appear here."
            }
          />
        ) : (
          <div className="flex flex-col gap-5 py-1">
            {groups.map((group) => {
              const meta = KIND_META[group.kind];
              const GroupIcon = meta.icon;
              return (
                <section key={group.kind}>
                  <h4 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <GroupIcon
                      className="h-3.5 w-3.5"
                      aria-hidden="true"
                    />
                    {pick(meta.label, isArabic)}
                    <span className="tabular-nums">
                      ({group.items.length})
                    </span>
                  </h4>
                  <ul className="flex flex-col gap-1.5">
                    {group.items.map((r) => (
                      <li key={`${r.kind}-${r.id}`}>
                        <Link
                          href={r.href}
                          className={cn(
                            "group flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5 transition-colors",
                            "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]",
                          )}
                        >
                          <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                            aria-hidden="true"
                          >
                            <GroupIcon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">
                              {pick(r.label, isArabic)}
                            </p>
                            {r.meta && (
                              <p className="truncate text-xs text-muted-foreground">
                                {pick(r.meta, isArabic)}
                              </p>
                            )}
                          </div>
                          <DirectionalIcon
                            icon={ChevronRight}
                            className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5"
                            aria-hidden="true"
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </ResponsiveDialog>
  );
}

export { RelatedContextPanel };
