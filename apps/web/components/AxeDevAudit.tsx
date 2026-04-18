"use client";

import * as React from "react";

/**
 * Loads @axe-core/react in development only.
 * Reports serious/critical a11y violations in the browser console.
 * Tree-shaken out of production builds.
 */
export function AxeDevAudit() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (typeof window === "undefined") return;
    let cancelled = false;
    (async () => {
      const [{ default: React }, { default: ReactDOM }, axe] = await Promise.all([
        import("react"),
        import("react-dom"),
        import("@axe-core/react"),
      ]);
      if (cancelled) return;
      axe.default(React, ReactDOM, 1000);
    })().catch(() => {
      /* dev-only — swallow failures so devs aren't blocked */
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
