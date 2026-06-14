"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

import { cn } from "../../lib/utils";

export interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  /** Render `title` as a visually-hidden Radix DialogTitle (a11y name only, no visible heading). */
  srOnlyTitle?: boolean;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  side?: "bottom" | "top";
}

export function BottomSheet({
  open,
  onOpenChange,
  title,
  srOnlyTitle,
  description,
  children,
  footer,
  className,
  side = "bottom",
}: BottomSheetProps) {
  const isBottom = side === "bottom";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-mobile-sheet bg-overlay/60 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-x-0 z-mobile-sheet flex max-h-[90vh] flex-col overflow-hidden",
            "bg-card shadow-2xl",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "duration-200",
            isBottom
              ? [
                  "bottom-0 rounded-t-2xl border-t border-border pb-safe-bottom",
                  "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
                ]
              : [
                  "top-0 rounded-b-2xl border-b border-border",
                  "data-[state=open]:slide-in-from-top data-[state=closed]:slide-out-to-top",
                ],
            className,
          )}
        >
          {isBottom ? (
            <div
              aria-hidden="true"
              className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30"
            />
          ) : null}

          {title ? (
            <DialogPrimitive.Title
              className={cn(
                srOnlyTitle
                  ? "sr-only"
                  : "mt-2 mb-1 text-center text-base font-semibold text-foreground px-4",
              )}
            >
              {title}
            </DialogPrimitive.Title>
          ) : null}

          {description ? (
            <DialogPrimitive.Description className="mb-3 text-center text-sm text-muted-foreground px-4">
              {description}
            </DialogPrimitive.Description>
          ) : null}

          <div className="flex-1 overflow-y-auto px-4 pb-4">{children}</div>

          {footer ? (
            <div className="sticky bottom-0 mt-3 border-t border-border bg-card px-4 pt-3 pb-4">
              {footer}
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
