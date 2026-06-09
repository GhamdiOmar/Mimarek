import * as React from "react";
import { cn } from "../lib/utils";

export interface PageIntroProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  badge?: string;
  actions?: React.ReactNode;
}

function PageIntro({
  title,
  description,
  badge,
  actions,
  children,
  className,
  ...props
}: PageIntroProps) {
  return (
    <div
      className={cn(
        // v4.11 "Outlined Precision": flat enterprise header — no glass.
        "rounded-lg border border-border bg-card card-quiet p-6 relative",
        className
      )}
      {...props}
    >
      {badge && (
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-primary/15 text-primary border border-primary/20 mb-4">
          {badge}
        </span>
      )}
      <h1 className="text-3xl font-bold text-foreground">{title}</h1>
      {description && (
        <p className="mt-3 text-sm text-muted-foreground max-w-2xl leading-relaxed">
          {description}
        </p>
      )}
      {actions && (
        <div className="flex items-center gap-2 mt-5 flex-wrap">
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

export { PageIntro };
