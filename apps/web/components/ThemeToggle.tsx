"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@repo/ui/lib/utils";
import { useLanguage } from "./LanguageProvider";

/**
 * ThemeToggle — sliding sun/moon pill (v4.11 Phase 3).
 *
 * Retokenized from the 21st.dev reference to Mimaric tokens (no zinc/hardcoded
 * colors). Built on the Radix Switch primitive so it carries real `role="switch"`
 * + keyboard semantics (§6.6.6 — not a hand-rolled role="switch" button); the
 * shared `<Switch>` can't host icons, so this specialized theme control uses the
 * same Radix base directly. Thumb slides toward the trailing edge in both LTR/RTL.
 *
 * `checked` = light mode. Uses `resolvedTheme` so it reflects the OS theme when
 * the user is on "system".
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const { lang } = useLanguage();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  // Avoid hydration mismatch — reserve the same footprint until mounted.
  if (!mounted) return <div className="h-8 w-16 shrink-0" aria-hidden="true" />;

  const isDark = resolvedTheme === "dark";

  return (
    <SwitchPrimitive.Root
      checked={!isDark}
      onCheckedChange={(checked) => setTheme(checked ? "light" : "dark")}
      aria-label={
        isDark
          ? lang === "ar"
            ? "التبديل إلى الوضع الفاتح"
            : "Switch to light mode"
          : lang === "ar"
            ? "التبديل إلى الوضع الداكن"
            : "Switch to dark mode"
      }
      className={cn(
        "relative inline-flex h-8 w-16 shrink-0 cursor-pointer items-center rounded-full border border-border bg-muted/60 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      {/* Faint track icons signal the two states (centered on the inline edges) */}
      <Moon className="pointer-events-none absolute start-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" aria-hidden="true" />
      <Sun className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" aria-hidden="true" />
      {/*
        Thumb is absolutely positioned and slid via the LOGICAL `inset-inline-start`
        property so it stays inside the track in BOTH LTR and RTL — the previous
        `ms-1` + physical `translate-x` approach left the thumb hanging ~14px off the
        leading edge in RTL. `-translate-y-1/2` handles vertical centering only.
        Dark → start edge (4px); light → trailing edge (track 4rem − thumb 1.5rem − 4px).
      */}
      <SwitchPrimitive.Thumb
        style={{ insetInlineStart: isDark ? "0.25rem" : "calc(100% - 1.75rem)" }}
        className={cn(
          "absolute top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-card text-foreground shadow-sm ring-1 ring-border transition-[inset-inline-start] duration-300",
        )}
      >
        {isDark ? (
          <Moon className="h-4 w-4 text-primary" aria-hidden="true" />
        ) : (
          <Sun className="h-4 w-4 text-accent" aria-hidden="true" />
        )}
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  );
}
