"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * URL-synchronised state primitive.
 *
 * Reads a single query-string key on render, writes it on `setValue` via
 * `router.replace` (no navigation, no scroll). Returning `null` from
 * `serialize` removes the key.
 *
 * The URL is the source of truth — back/forward and shared links restore
 * state without extra wiring. Callers should memoise `parse` / `serialize`
 * if they depend on closed-over state.
 *
 * @example
 *   const [tab, setTab] = useQueryState<string>(
 *     "tab",
 *     (s) => s ?? "overview",
 *     (v) => (v === "overview" ? null : v),
 *   );
 */
export function useQueryState<T>(
  key: string,
  parse: (raw: string | null) => T,
  serialize: (value: T) => string | null,
): [T, (value: T) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const value = parse(searchParams.get(key));

  const setValue = useCallback(
    (next: T) => {
      const params = new URLSearchParams(searchParams.toString());
      const serialised = serialize(next);
      if (serialised === null) {
        params.delete(key);
      } else {
        params.set(key, serialised);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [key, pathname, router, searchParams, serialize],
  );

  return [value, setValue];
}
