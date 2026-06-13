"use client";

import * as React from "react";
import { useLanguage } from "./LanguageProvider";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface AutoSaveIndicatorProps {
  /** Async function to persist the data */
  onSave: (data: any) => Promise<void>;
  /** The data to auto-save (triggers save on change) */
  data: any;
  /** Enable/disable auto-save (e.g., only for DRAFT records) */
  enabled?: boolean;
  /** Debounce interval in ms (default: 2000) */
  debounceMs?: number;
}

const LABELS = {
  ar: {
    idle: "",
    saving: "جاري الحفظ...",
    saved: "تم الحفظ",
    error: "فشل الحفظ",
  },
  en: {
    idle: "",
    saving: "Saving...",
    saved: "Saved",
    error: "Save failed",
  },
};

const STATUS_STYLES: Record<SaveStatus, string> = {
  idle: "hidden",
  saving: "text-muted-foreground animate-pulse",
  saved: "text-success-strong",
  error: "text-destructive",
};

const STATUS_ICONS: Record<SaveStatus, string> = {
  idle: "",
  saving: "⏳",
  saved: "✓",
  error: "✗",
};

/**
 * Auto-save indicator that debounces saves for DRAFT records.
 * Shows Saving/Saved/Error status badge.
 */
export function AutoSaveIndicator({
  onSave,
  data,
  enabled = true,
  debounceMs = 2000,
}: AutoSaveIndicatorProps) {
  const { lang } = useLanguage();
  const t = LABELS[lang];
  const [status, setStatus] = React.useState<SaveStatus>("idle");
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevDataRef = React.useRef<string>("");
  const isFirstRender = React.useRef(true);

  React.useEffect(() => {
    if (!enabled) return;

    // Skip first render (initial load isn't a "change")
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevDataRef.current = JSON.stringify(data);
      return;
    }

    const dataStr = JSON.stringify(data);
    if (dataStr === prevDataRef.current) return;
    prevDataRef.current = dataStr;

    // Clear previous timer
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      try {
        setStatus("saving");
        await onSave(data);
        setStatus("saved");
        // Reset to idle after 3 seconds
        setTimeout(() => setStatus("idle"), 3000);
      } catch {
        setStatus("error");
        // Reset to idle after 5 seconds
        setTimeout(() => setStatus("idle"), 5000);
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, enabled, debounceMs, onSave]);

  if (status === "idle") return null;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${STATUS_STYLES[status]}`}>
      <span>{STATUS_ICONS[status]}</span>
      <span>{t[status]}</span>
    </span>
  );
}
