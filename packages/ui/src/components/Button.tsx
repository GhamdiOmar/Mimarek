"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Check, X } from "lucide-react";
import { cn } from "../lib/utils";

const buttonVariants = cva(
  "inline-flex flex-nowrap items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 w-fit active:scale-[0.97] active:transition-none select-none cursor-pointer",
  {
    variants: {
      variant: {
        primary:
          "btn-primary bg-primary text-primary-foreground shadow-sm hover:bg-primary/85 active:bg-primary/75",
        secondary:
          "btn-secondary border border-border bg-card text-foreground hover:bg-muted/60 active:bg-muted/80",
        success:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/85 active:bg-secondary/75",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/85 active:bg-destructive/75",
        premium:
          "bg-accent text-primary-deep shadow-sm hover:bg-accent/85 active:bg-accent/75",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-muted/40 active:bg-muted/60",
        subtle:
          "bg-muted/50 text-foreground hover:bg-muted/80 active:bg-muted",
        ghost:
          "text-muted-foreground hover:bg-muted/50 hover:text-foreground active:bg-muted/70",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-xs rounded",
        md: "h-10 px-5 py-2",
        lg: "h-12 px-8 text-base",
        icon: "h-11 w-11 md:h-9 md:w-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  loadingText?: string;
  /** Post-action micro-feedback: "success" shows a check for ~1.5s; "error" applies a destructive ring + shake for ~1.5s */
  state?: "success" | "error";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      loadingText,
      children,
      disabled,
      state,
      ...props
    },
    ref
  ) => {
    const [feedbackState, setFeedbackState] = React.useState<
      "success" | "error" | null
    >(null);

    // Trigger feedback animation when `state` prop changes
    React.useEffect(() => {
      if (!state) return;
      setFeedbackState(state);
      const timer = setTimeout(() => setFeedbackState(null), 1500);
      return () => clearTimeout(timer);
    }, [state]);

    const Comp = asChild ? Slot : "button";

    const feedbackClasses =
      feedbackState === "error"
        ? "ring-2 ring-destructive ring-offset-1 animate-[shake_0.4s_ease-in-out]"
        : "";

    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size, className }),
          feedbackClasses
        )}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <svg
              className="animate-spin h-4 w-4 shrink-0"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            {loadingText || children}
          </>
        ) : feedbackState === "success" ? (
          <>
            <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
            {children}
          </>
        ) : feedbackState === "error" ? (
          <>
            <X className="h-4 w-4 shrink-0" aria-hidden="true" />
            {children}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
