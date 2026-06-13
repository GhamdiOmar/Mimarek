"use client";

import * as React from "react";
import Link from "next/link";
import { Phone, MessageCircle } from "lucide-react";
import { cn } from "../../lib/utils";

export type CustomerCardStatus =
  | "hot"
  | "warm"
  | "cold"
  | "converted"
  | "churned"
  | "neutral";

export interface CustomerCardProps {
  name: string;
  /** Last activity timestamp or description. */
  lastActivity?: React.ReactNode;
  status?: CustomerCardStatus;
  /** E.164 phone (e.g. "+9665…") — used to build tel:/wa.me links. */
  phone?: string | null;
  /** Explicit override for the "call" link. Takes precedence over `phone`. */
  callHref?: string;
  /** Explicit override for WhatsApp. Takes precedence over `phone`. */
  chatHref?: string;
  href?: string;
  onClick?: () => void;
  lang?: "ar" | "en";
  className?: string;
}

const STATUS: Record<
  CustomerCardStatus,
  { cls: string; label: { ar: string; en: string } }
> = {
  hot: {
    cls: "bg-destructive/10 text-destructive",
    label: { ar: "عميل ساخن", en: "Hot Lead" },
  },
  warm: {
    cls: "bg-warning/10 text-warning",
    label: { ar: "عميل دافئ", en: "Warm" },
  },
  cold: {
    cls: "bg-info/10 text-info",
    label: { ar: "عميل بارد", en: "Cold" },
  },
  converted: {
    cls: "bg-success/10 text-success-strong",
    label: { ar: "محوّل", en: "Converted" },
  },
  churned: {
    cls: "bg-muted text-muted-foreground",
    label: { ar: "منسحب", en: "Churned" },
  },
  neutral: {
    cls: "bg-muted text-muted-foreground",
    label: { ar: "", en: "" },
  },
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0] ?? "";
  const last = parts[parts.length - 1] ?? "";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

function sanitizePhoneForWa(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

/**
 * CustomerCard — customer / lead row for mobile CRM lists.
 *
 * Avatar + name + status badge + last-activity line; trailing pair of
 * compact call + WhatsApp icon buttons.
 */
function CustomerCard({
  name,
  lastActivity,
  status,
  phone,
  callHref,
  chatHref,
  href,
  onClick,
  lang = "en",
  className,
}: CustomerCardProps) {
  const isArabic = lang === "ar";
  const statusMeta = status ? STATUS[status] : null;
  const statusLabel =
    statusMeta && (isArabic ? statusMeta.label.ar : statusMeta.label.en);

  const resolvedCall = callHref ?? (phone ? `tel:${phone}` : null);
  const resolvedChat =
    chatHref ?? (phone ? `https://wa.me/${sanitizePhoneForWa(phone)}` : null);

  const body = (
    <div className="flex w-full items-center gap-3">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
        aria-hidden="true"
      >
        {initialsOf(name)}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">
            {name}
          </span>
          {statusMeta && statusLabel ? (
            <span
              className={cn(
                "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                statusMeta.cls,
              )}
            >
              {statusLabel}
            </span>
          ) : null}
        </div>
        {lastActivity ? (
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {lastActivity}
          </div>
        ) : null}
      </div>
    </div>
  );

  const interactive = Boolean(href || onClick);
  const rowClasses = cn(
    "flex items-center gap-2 rounded-xl border border-border bg-card p-3",
    className,
  );

  const mainInteractive = cn(
    "flex-1 min-w-0",
    interactive
      ? "rounded-lg transition-colors active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]"
      : undefined,
  );

  const mainNode = href ? (
    <Link href={href} className={mainInteractive}>
      {body}
    </Link>
  ) : onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={cn(mainInteractive, "w-full justify-start text-start")}
    >
      {body}
    </button>
  ) : (
    <div className={mainInteractive}>{body}</div>
  );

  const iconBtn =
    "inline-flex h-11 w-11 md:h-9 md:w-9 shrink-0 items-center justify-center rounded-full bg-muted/70 text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]";

  return (
    <div className={rowClasses}>
      {mainNode}
      {resolvedCall ? (
        <a
          href={resolvedCall}
          aria-label={isArabic ? "اتصال" : "Call"}
          className={iconBtn}
          onClick={(e) => e.stopPropagation()}
        >
          <Phone className="h-4 w-4" aria-hidden="true" />
        </a>
      ) : null}
      {resolvedChat ? (
        <a
          href={resolvedChat}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={isArabic ? "واتساب" : "WhatsApp"}
          className={iconBtn}
          onClick={(e) => e.stopPropagation()}
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
        </a>
      ) : null}
    </div>
  );
}

export { CustomerCard };
