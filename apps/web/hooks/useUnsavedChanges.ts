"use client";

import { useEffect } from "react";

/**
 * Warn the user before they lose unsaved form edits (CX-007, AGENTS.md §6.7).
 *
 * Covers the high-frequency data-loss paths — tab close, refresh, back/forward,
 * and external navigation — via the native `beforeunload` prompt while `dirty`
 * is true. (Next.js App Router has no public client-side route-change blocker;
 * for in-app navigation, transactional forms live in modals/sheets and confirm
 * on explicit close, which is the per-form responsibility.)
 *
 * Usage:
 *   const dirty = form.formState.isDirty;     // react-hook-form
 *   useUnsavedChanges(dirty);
 */
export function useUnsavedChanges(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Legacy browsers require returnValue to be set to trigger the prompt.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}
