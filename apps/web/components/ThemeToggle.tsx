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
      {/* Faint track icons signal the two states */}
      <Moon className="pointer-events-none absolute start-2 h-4 w-4 text-muted-foreground/50" aria-hidden="true" />
      <Sun className="pointer-events-none absolute end-2 h-4 w-4 text-muted-foreground/50" aria-hidden="true" />
      <SwitchPrimitive.Thumb
        className={cn(
          "z-10 ms-1 flex h-6 w-6 items-center justify-center rounded-full bg-card text-foreground shadow-sm ring-1 ring-border transition-transform duration-300",
          isDark ? "translate-x-0" : lang === "ar" ? "-translate-x-8" : "translate-x-8",
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
