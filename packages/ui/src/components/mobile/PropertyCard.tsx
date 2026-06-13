"use client";

import * as React from "react";
import Link from "next/link";
import {
  Building2,
  Home as HomeIcon,
  Warehouse,
  Store,
  MapPin,
  Bed,
  Bath,
  Square,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

export type PropertyCardType =
  | "apartment"
  | "villa"
  | "warehouse"
  | "retail"
  | "office"
  | "other";

export type PropertyCardStatus =
  | "available"
  | "reserved"
  | "sold"
  | "rented"
  | "maintenance";

export interface PropertyCardProps {
  title: React.ReactNode;
  /** Logical unit type — drives the fallback icon. */
  type?: PropertyCardType;
  /** Explicit icon override. */
  icon?: LucideIcon;
  /** Pre-formatted price — caller composes SAR + number. */
  price?: React.ReactNode;
  /** Secondary line below price (e.g. "/ month" for rentals). */
  priceSuffix?: React.ReactNode;
  location?: React.ReactNode;
  bedrooms?: number | null;
  bathrooms?: number | null;
  areaSqm?: number | null;
  status?: PropertyCardStatus;
  lang?: "ar" | "en";
  href?: string;
  onClick?: () => void;
  className?: string;
}

const TYPE_ICON: Record<PropertyCardType, LucideIcon> = {
  apartment: Building2,
  villa: HomeIcon,
  warehouse: Warehouse,
  retail: Store,
  office: Building2,
  other: Building2,
};

const STATUS_STYLE: Record<
  PropertyCardStatus,
  { cls: string; label: { ar: string; en: string } }
> = {
  available: {
    cls: "bg-success/10 text-success-strong",
    label: { ar: "متاحة", en: "Available" },
  },
  reserved: {
    cls: "bg-warning/10 text-warning",
    label: { ar: "محجوزة", en: "Reserved" },
  },
  sold: {
    cls: "bg-primary/10 text-primary",
    label: { ar: "مباعة", en: "Sold" },
  },
  rented: {
    cls: "bg-info/10 text-info",
    label: { ar: "مؤجرة", en: "Rented" },
  },
  maintenance: {
    cls: "bg-destructive/10 text-destructive",
    label: { ar: "صيانة", en: "Maintenance" },
  },
};

/**
 * PropertyCard — text-only property row for mobile unit lists.
 *
 * Leading 64px tinted icon tile (placeholder for image), title + location,
 * amenity pills (bed/bath/area), trailing status chip + price.
 */
function PropertyCard({
  title,
  type = "other",
  icon,
  price,
  priceSuffix,
  location,
  bedrooms,
  bathrooms,
  areaSqm,
  status,
  lang = "en",
  href,
  onClick,
  className,
}: PropertyCardProps) {
  const Icon = icon ?? TYPE_ICON[type];
  const interactive = Boolean(href || onClick);
  const statusMeta = status ? STATUS_STYLE[status] : null;
  const isArabic = lang === "ar";

  const body = (
    <div className="flex items-stretch gap-3">
      <span
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
        aria-hidden="true"
      >
        <Icon className="h-7 w-7" />
      </span>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-foreground">
              {title}
            </div>
            {location ? (
              <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{location}</span>
              </div>
            ) : null}
          </div>
          {statusMeta ? (
            <span
              className={cn(
                "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                statusMeta.cls,
              )}
            >
              {isArabic ? statusMeta.label.ar : statusMeta.label.en}
            </span>
          ) : null}
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            {bedrooms != null ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-muted/70 px-1.5 py-0.5 tabular-nums">
                <Bed className="h-3 w-3" aria-hidden="true" />
                {bedrooms}
              </span>
            ) : null}
            {bathrooms != null ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-muted/70 px-1.5 py-0.5 tabular-nums">
                <Bath className="h-3 w-3" aria-hidden="true" />
                {bathrooms}
              </span>
            ) : null}
            {areaSqm != null ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-muted/70 px-1.5 py-0.5 tabular-nums">
                <Square className="h-3 w-3" aria-hidden="true" />
                {areaSqm}
                <span className="text-[9px] text-muted-foreground/70">
                  {isArabic ? "م²" : "m²"}
                </span>
              </span>
            ) : null}
          </div>

          {price ? (
            <div className="text-end">
              <div className="text-sm font-bold text-primary number-ltr">
                {price}
              </div>
              {priceSuffix ? (
                <div className="text-[10px] text-muted-foreground">
                  {priceSuffix}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  const baseClasses = cn(
    "block rounded-2xl border border-border bg-card p-3",
    interactive
      ? "transition-all active:scale-[0.99] hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]"
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
        className={cn(baseClasses, "w-full text-start")}
      >
        {body}
      </button>
    );
  }
  return <div className={baseClasses}>{body}</div>;
}

export { PropertyCard };
