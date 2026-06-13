"use client";

import * as React from "react";
import Link from "next/link";
import { Check, X, CheckCircle2, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

export type ApprovalRowState = "pending" | "approved" | "rejected";

export interface ApprovalRowProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Pre-formatted trailing amount / count. */
  amount?: React.ReactNode;
  icon?: LucideIcon;
  state?: ApprovalRowState;
  onApprove?: () => void;
  onReject?: () => void;
  /** Optional detail href — tapping anywhere on the non-button area navigates. */
  href?: string;
  lang?: "ar" | "en";
  className?: string;
  /** Disables approve/reject buttons while a mutation is in flight. */
  busy?: boolean;
}

/**
 * ApprovalRow — list row with inline Approve/Reject icon buttons.
 *
 * While `state` is pending, shows two 32px circular buttons (Check + X).
 * After action, collapses to a single-tone status chip.
 */
function ApprovalRow({
  title,
  subtitle,
  amount,
  icon: Icon,
  state = "pending",
  onApprove,
  onReject,
  href,
  lang = "en",
  className,
  busy = false,
}: ApprovalRowProps) {
  const isArabic = lang === "ar";

  const content = (
    <div className="flex min-w-0 flex-1 items-start gap-3">
      {Icon ? (
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
          aria-hidden="true"
        >
          <Icon className="h-5 w-5" />
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-foreground">
          {title}
        </div>
        {subtitle ? (
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {subtitle}
          </div>
        ) : null}
        {amount ? (
          <div className="mt-1 text-sm font-bold text-foreground number-ltr">
            {amount}
          </div>
        ) : null}
      </div>
    </div>
  );

  const mainNode = href ? (
    <Link href={href} className="min-w-0 flex-1">
      {content}
    </Link>
  ) : (
    <div className="min-w-0 flex-1">{content}</div>
  );

  const buttonBase =
    "inline-flex h-11 w-11 md:h-9 md:w-9 shrink-0 items-center justify-center rounded-full transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))] disabled:opacity-50 disabled:pointer-events-none";

  let trailing: React.ReactNode;
  if (state === "pending") {
    trailing = (
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          aria-label={isArabic ? "رفض" : "Reject"}
          onClick={onReject}
          disabled={busy}
          className={cn(
            buttonBase,
            "bg-destructive/10 text-destructive hover:bg-destructive/15",
          )}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={isArabic ? "موافقة" : "Approve"}
          onClick={onApprove}
          disabled={busy}
          className={cn(
            buttonBase,
            "bg-success/10 text-success hover:bg-success/15",
          )}
        >
          <Check className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    );
  } else if (state === "approved") {
    trailing = (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-[11px] font-semibold text-success">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        {isArabic ? "تمت الموافقة" : "Approved"}
      </span>
    );
  } else {
    trailing = (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-[11px] font-semibold text-destructive">
        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
        {isArabic ? "مرفوض" : "Rejected"}
      </span>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border bg-card p-3",
        className,
      )}
    >
      {mainNode}
      {trailing}
    </div>
  );
}

export { ApprovalRow };
