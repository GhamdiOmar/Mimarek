import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

export type DataCardTone =
  | "default"
  | "blue"
  | "green"
  | "amber"
  | "red"
  | "primary";

export interface DataCardProps {
  title: React.ReactNode;
  /** Metadata row(s). Pass a string, JSX, or an array joined with ` · `. */
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  /** Soft background tone for the icon tile. */
  iconTone?: DataCardTone;
  /** Trailing slot for status badge, timestamp, amount, chevron, etc. */
  trailing?: React.ReactNode;
  /** If set, wraps the whole card in a next/link. */
  href?: string;
  /** If set, wraps the whole card in a <button>. */
  onClick?: () => void;
  className?: string;
  /** Show the bottom 1px divider typical of list items. Defaults to true. */
  divider?: boolean;
}

const TONE_CLASSES: Record<DataCardTone, string> = {
  default: "bg-muted text-muted-foreground",
  blue: "bg-info/10 text-info dark:bg-info/15",
  green: "bg-success/10 text-success-strong dark:bg-success/15",
  amber: "bg-warning/10 text-warning dark:bg-warning/15",
  red: "bg-destructive/10 text-destructive dark:bg-destructive/15",
  primary: "bg-primary/10 text-primary dark:bg-primary/15",
};

/** Joins subtitle entries with a middle-dot separator when given an array. */
function renderSubtitle(subtitle: React.ReactNode): React.ReactNode {
  if (Array.isArray(subtitle)) {
    const parts = subtitle.filter(
      (p) => p !== null && p !== undefined && p !== false && p !== "",
    );
    return parts.map((part, idx) => (
      <React.Fragment key={idx}>
        {idx > 0 ? (
          <span aria-hidden="true" className="mx-1.5">
            ·
          </span>
        ) : null}
        {part}
      </React.Fragment>
    ));
  }
  return subtitle;
}

/**
 * DataCard — the universal "table row as card" primitive for mobile lists.
 *
 * Consists of a 42×42 tinted icon tile, a title + subtitle column, and a
 * trailing slot. If `href` or `onClick` is provided the whole card becomes
 * interactive with a subtle hover surface that extends beyond the content.
 */
function DataCard({
  title,
  subtitle,
  icon: Icon,
  iconTone = "default",
  trailing,
  href,
  onClick,
  className,
  divider = true,
}: DataCardProps) {
  const interactive = Boolean(href || onClick);

  const content = (
    <div
      className={cn(
        "flex items-start gap-3 py-3",
        divider ? "border-b border-border" : undefined,
      )}
    >
      {Icon ? (
        <span
          className={cn(
            "flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl",
            TONE_CLASSES[iconTone],
          )}
          aria-hidden="true"
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
      ) : null}

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-foreground">
          {title}
        </div>
        {subtitle ? (
          <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {renderSubtitle(subtitle)}
          </div>
        ) : null}
      </div>

      {trailing ? (
        <div className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
          {trailing}
        </div>
      ) : null}
    </div>
  );

  const interactiveClasses = cn(
    "-mx-2 block rounded-lg px-2 transition-colors hover:bg-muted/30",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={interactiveClasses}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(interactiveClasses, "w-full text-start")}
      >
        {content}
      </button>
    );
  }

  return <div className={cn(className, !interactive && undefined)}>{content}</div>;
}

export { DataCard };
