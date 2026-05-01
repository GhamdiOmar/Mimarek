"use client";

import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "../../lib/utils";

export interface FABProps {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  href?: string;
  className?: string;
  position?: "end" | "start";
}

const baseClasses = cn(
  "fixed bottom-[calc(theme(height.mobile-bottomnav)+env(safe-area-inset-bottom)+1rem)]",
  "z-mobile-fab inline-flex h-14 w-14 items-center justify-center rounded-full",
  "bg-primary text-primary-foreground shadow-lg",
  "transition-all duration-150",
  "hover:bg-primary/90 hover:shadow-xl",
  "active:scale-95",
  "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 focus:ring-offset-background",
);

export function FAB({
  icon: Icon,
  label,
  onClick,
  href,
  className,
  position = "end",
}: FABProps) {
  const positionClass = position === "end" ? "end-4" : "start-4";
  const mergedClassName = cn(baseClasses, positionClass, className);

  if (href) {
    return (
      <Link
        href={href}
        aria-label={label}
        className={mergedClassName}
        onClick={onClick}
        style={{ touchAction: "manipulation" }}
      >
        <Icon className="h-6 w-6" aria-hidden="true" />
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={mergedClassName}
      style={{ display: "inline-flex", touchAction: "manipulation" }}
    >
      <Icon className="h-6 w-6" aria-hidden="true" />
    </button>
  );
}
