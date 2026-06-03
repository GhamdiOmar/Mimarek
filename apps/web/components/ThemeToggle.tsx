"use client";

import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { IconButton } from "@repo/ui";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="w-8 h-8" />;

  const isDark = theme === "dark";

  return (
    <IconButton
      icon={isDark ? Sun : Moon}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      variant="ghost"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    />
  );
}
