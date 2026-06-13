import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        /* Domain-specific */
        available: "bg-secondary/10 text-secondary border-transparent",
        reserved: "bg-accent/10 text-accent border-transparent",
        sold: "bg-primary/10 text-primary border-transparent",
        rented: "bg-secondary/10 text-secondary border-transparent",
        maintenance: "bg-warning/10 text-warning border-transparent",
        overdue: "bg-destructive/10 text-destructive border-transparent",
        draft: "bg-muted text-muted-foreground border-transparent",
        /* Generic semantic */
        success: "bg-success/10 text-success-strong border-transparent",
        info: "bg-info/10 text-info border-transparent",
        warning: "bg-warning/10 text-warning border-transparent",
        pending: "bg-accent/10 text-accent border-transparent",
        error: "bg-destructive/10 text-destructive border-transparent",
        /* Neutral */
        default: "bg-muted text-muted-foreground border-transparent",
        outline: "border border-border text-muted-foreground bg-transparent",
        /* Dot variant — no background, just dot + text */
        dot: "bg-transparent text-muted-foreground border-transparent",
      },
      size: {
        sm: "px-2 py-0.5 text-[10px] rounded",
        md: "px-2.5 py-0.5 text-xs rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dotColor?: string;
}

function Badge({ className, variant, size, dotColor, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {variant === "dot" && (
        <span
          className={cn("h-1.5 w-1.5 rounded-full shrink-0", dotColor || "bg-muted-foreground")}
          aria-hidden="true"
        />
      )}
      {props.children}
    </div>
  );
}

export { Badge, badgeVariants };
