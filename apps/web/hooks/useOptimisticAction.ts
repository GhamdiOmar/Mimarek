"use client";

import * as React from "react";
import { toast } from "sonner";
import { useLanguage } from "../components/LanguageProvider";
import { sanitizeError } from "../lib/error-sanitizer";

/**
 * Optimistic-rendering primitive (AGENTS.md §6.7 "optimistic UI update, revert with toast on failure").
 *
 * Wraps React 19's `useOptimistic` so a list-backed view can reflect a mutation INSTANTLY, then reconcile
 * against the authoritative server state — and AUTO-REVERT with a sanitized toast if the action throws.
 *
 * How it works: `run()` opens a single transition and, inside it, applies the optimistic `patch`, awaits the
 * server `action`, then awaits the optional `reconcile` (the view's existing `loadData()`/`loadDeals()`
 * refetch). The optimistic value is held for the whole transition — including the refetch — so there is no
 * flash back to the old state before the authoritative data lands. On `throw`, the base state is never
 * updated, so `useOptimistic` discards the optimistic value automatically (no manual snapshot/restore); the
 * user sees `sanitizeError(e, lang)` via sonner.
 *
 * The view supplies a PURE `reducer(state, patch)` (unit-testable) and a `patch` built from client-known data
 * (the selected ids + the new status) — so no server-action signature change is required.
 *
 * @param base    the authoritative collection the view already owns (e.g. `rentInstallments`, `deals`)
 * @param reducer pure function applying a patch to the collection
 */
export function useOptimisticAction<TState, TPatch>(
  base: TState,
  reducer: (state: TState, patch: TPatch) => TState,
) {
  const [data, applyOptimistic] = React.useOptimistic(base, reducer);
  const [isPending, startTransition] = React.useTransition();
  const { lang } = useLanguage();

  /**
   * Apply `patch` optimistically, then run `action` and `reconcile` inside one transition.
   *
   * Resolves `true` as soon as the server `action` succeeds — so a caller can close its modal on
   * server-confirm without waiting for the reconcile refetch — or `false` if `action` threw, in which
   * case the base state is never touched so `useOptimistic` discards the patch (auto-revert) and a
   * sanitized toast is shown. The optimistic value stays visible until `reconcile` lands the
   * authoritative state, because the transition remains pending through the awaited reconcile.
   *
   * `reconcile` should refetch SILENTLY (without toggling a full-table loading skeleton) so the
   * optimistic row stays on screen until the authoritative data swaps in seamlessly.
   */
  const run = React.useCallback(
    (
      patch: TPatch,
      action: () => Promise<unknown>,
      reconcile?: () => Promise<unknown> | void,
    ): Promise<boolean> =>
      new Promise<boolean>((resolve) => {
        startTransition(async () => {
          applyOptimistic(patch);
          try {
            await action();
            resolve(true); // server confirmed — unblock the caller (e.g. close the modal)
            await reconcile?.(); // keep the transition pending so the optimistic value holds until base refreshes
          } catch (e: unknown) {
            // base state unchanged → useOptimistic auto-reverts the optimistic patch
            toast.error(sanitizeError(e, lang));
            resolve(false);
          }
        });
      }),
    [applyOptimistic, lang],
  );

  return { data, run, isPending };
}
