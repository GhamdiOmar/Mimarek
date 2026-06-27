/**
 * Federated record-search types (CX-002).
 *
 * Lives in a plain (non-`"use server"`) module because `app/actions/search.ts`
 * is a Server Action file — it may export ONLY async functions (AGENTS §4). The
 * search action, the `useFederatedSearch` hook, and the three search surfaces
 * (Cmd-K, top-bar dropdown, mobile sheet) all share these shapes.
 *
 * PII contract: a `SearchHit` NEVER carries raw phone/email/national-ID. Any
 * contact value is pre-masked (`maskedPii`, e.g. `***4567`) and MUST be rendered
 * inside `dir="ltr"` / `.number-ltr` at the call site (AGENTS §6.15.3).
 */

export type SearchEntityType =
  | "customer"
  | "unit"
  | "contract"
  | "reservation"
  | "payment"
  | "maintenance";

export interface SearchHit {
  /** Stable record id — used (with `type`) as the non-PII cmdk item `value`. */
  id: string;
  type: SearchEntityType;
  /** Localized primary label (e.g. customer name, unit number). Never PII. */
  title: string;
  /** Localized secondary line (e.g. building, status). Never raw PII. */
  subtitle?: string;
  /** Pre-masked contact token (e.g. `***4567`). Render inside dir="ltr". */
  maskedPii?: string;
  /** Destination route. Never 404s — falls back to the entity list with `?q=`. */
  href: string;
}

export interface SearchGroup {
  type: SearchEntityType;
  hits: SearchHit[];
  /** True when more than the rendered cap matched — surfaces a "See all" item. */
  hasMore: boolean;
}

export interface SearchResult {
  groups: SearchGroup[];
}
