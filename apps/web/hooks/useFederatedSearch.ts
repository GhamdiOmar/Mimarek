"use client";

import * as React from "react";
import { globalSearch } from "../app/actions/search";
import type { SearchGroup } from "../lib/search-types";

const DEBOUNCE_MS = 200;
const SPINNER_AFTER_MS = 500;

/** Pure digits → require 3 chars before firing (a 2-digit phone fragment is noise). */
function minLengthFor(q: string): number {
  return /^\d+$/.test(q) ? 3 : 2;
}

export interface FederatedSearchState {
  groups: SearchGroup[];
  /** A request is in flight (debounce elapsed, awaiting the server action). */
  loading: boolean;
  /** Loading AND it has stalled past ~500ms — show a spinner, not before. */
  showSpinner: boolean;
  /** Friendly flag; the raw exception is swallowed (never surfaced). */
  error: boolean;
  /** True the moment the query passes the min-length gate (drives empty-vs-idle). */
  isSearching: boolean;
}

/**
 * Federated record search hook (CX-002). Shared by Cmd-K, the top-bar dropdown,
 * and the mobile search sheet.
 *
 * - Debounces 200ms; min length 2 (3 for pure-digit queries).
 * - Monotonic sequence token drops stale responses. Server Actions can't be
 *   AbortController-cancelled, so the seq token is the correctness guard.
 * - Spinner only after a ~500ms stall (avoids flicker on fast responses).
 * - Never throws — a failed call sets `error` and clears results.
 */
export function useFederatedSearch(
  rawQuery: string,
  lang: "ar" | "en",
): FederatedSearchState {
  const [groups, setGroups] = React.useState<SearchGroup[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [showSpinner, setShowSpinner] = React.useState(false);
  const [error, setError] = React.useState(false);

  const seqRef = React.useRef(0);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const spinnerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = React.useRef<string>("");

  const q = rawQuery.trim();
  const isSearching = q.length >= minLengthFor(q);

  React.useEffect(() => {
    const clearTimers = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (spinnerRef.current) clearTimeout(spinnerRef.current);
    };

    // Below the threshold: reset everything and bump the seq so any in-flight
    // response is ignored.
    if (!isSearching) {
      clearTimers();
      seqRef.current += 1;
      lastQueryRef.current = "";
      setGroups([]);
      setLoading(false);
      setShowSpinner(false);
      setError(false);
      return;
    }

    // Short-circuit if the (query, lang) pair is unchanged — but re-run when the
    // language flips so bilingual titles/subtitles refresh for the same query.
    const cacheKey = `${q}::${lang}`;
    if (cacheKey === lastQueryRef.current) return;
    lastQueryRef.current = cacheKey;

    clearTimers();
    setError(false);

    debounceRef.current = setTimeout(() => {
      const seq = ++seqRef.current;
      setLoading(true);
      setShowSpinner(false);
      spinnerRef.current = setTimeout(() => {
        if (seqRef.current === seq) setShowSpinner(true);
      }, SPINNER_AFTER_MS);

      globalSearch(q, lang)
        .then((res) => {
          if (seqRef.current !== seq) return; // stale response — drop it
          setGroups(res.groups);
          setError(false);
        })
        .catch(() => {
          if (seqRef.current !== seq) return;
          setGroups([]);
          setError(true);
        })
        .finally(() => {
          if (seqRef.current !== seq) return;
          if (spinnerRef.current) clearTimeout(spinnerRef.current);
          setLoading(false);
          setShowSpinner(false);
        });
    }, DEBOUNCE_MS);

    return clearTimers;
  }, [q, lang, isSearching]);

  // Clear timers on unmount.
  React.useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (spinnerRef.current) clearTimeout(spinnerRef.current);
    };
  }, []);

  return { groups, loading, showSpinner, error, isSearching };
}
