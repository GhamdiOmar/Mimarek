/**
 * @repo/types — shared cross-package TypeScript contracts.
 *
 * Consumed directly as source: `package.json` points `main`/`types` at
 * `./src/index.ts`, so no build step / tsconfig change is required for
 * `apps/web` or `@repo/ui` to import these.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Journey Layer
 * ─────────────────────────────────────────────────────────────────────────────
 * A "journey" is the cross-record narrative of where an entity sits in its
 * lifecycle, what is blocking it, and what to do next. The stage *vocabulary*
 * here is NOT invented — it mirrors the real server-side state machines:
 *
 *   - Contract lifecycle  → `apps/web/app/actions/contracts.ts` VALID_TRANSITIONS
 *       DRAFT → SENT → SIGNED → VOID  (CANCELLED is terminal from DRAFT/SENT)
 *   - Maintenance lifecycle → `apps/web/app/actions/maintenance.ts`
 *       VALID_TRANSITIONS + computeDueDate (SLA hours by priority)
 *       OPEN → ASSIGNED → IN_PROGRESS → ON_HOLD → RESOLVED → CLOSED
 *
 * UI components in `@repo/ui` (LifecycleRail, NextActionPanel,
 * ProcessBlockerBanner, RelatedContextPanel) render these shapes; producers
 * (server actions / page loaders) map their domain state onto them.
 */

/** A bilingual string. Arabic is primary per the RTL-first design system. */
export interface LocalizedText {
  ar: string;
  en: string;
}

/**
 * One step in an entity's lifecycle rail.
 *
 * `id` should be the raw state-machine token (e.g. "SIGNED", "IN_PROGRESS")
 * so it stays traceable to VALID_TRANSITIONS — do not coin new vocabulary.
 * `status` is the *rendering* state of that step relative to where the entity
 * currently is:
 *   - `done`     — a stage already passed
 *   - `current`  — the entity's present stage (emphasized)
 *   - `upcoming` — a reachable future stage
 *   - `blocked`  — a stage that cannot be entered yet (a blocker gates it)
 */
export interface ProcessStage {
  id: string;
  label: LocalizedText;
  status: "done" | "current" | "upcoming" | "blocked";
}

/**
 * Something preventing forward progress. Maps onto the §6.11.2 banner
 * taxonomy: `warning` → amber, `error` → red.
 */
export interface ProcessBlocker {
  id: string;
  severity: "warning" | "error";
  title: LocalizedText;
  detail: LocalizedText;
  /** Optional CTA label, e.g. { ar: "تعيين فني", en: "Assign technician" }. */
  actionLabel?: LocalizedText;
  /** Where the action CTA navigates. Paired with `actionLabel`. */
  actionHref?: string;
}

/**
 * The recommended (or an alternative) move for this entity. Exactly one
 * action in a `NextBestAction[]` should have `primary: true` (§6.6 — one
 * primary affordance); the rest are visually subordinate.
 */
export interface NextBestAction {
  label: LocalizedText;
  /** Navigation target. Mutually informative with `onClick`. */
  href?: string;
  /** Client handler — used when the action mutates rather than navigates. */
  onClick?: () => void;
  /** Exactly one `true` per action list. */
  primary: boolean;
  /** Who is responsible for this action, e.g. role or person. */
  owner?: LocalizedText;
  /** ISO date string (yyyy-mm-dd) or display-ready due date. */
  dueDate?: string;
}

/**
 * A pointer to a related record in another part of the product. `kind`
 * mirrors the real domain entities so consumers can group and assign icons.
 */
export interface RelatedRecordSummary {
  kind:
    | "customer"
    | "unit"
    | "contract"
    | "reservation"
    | "invoice"
    | "maintenance"
    | "document";
  id: string;
  label: LocalizedText;
  href: string;
  /** Optional secondary line, e.g. status or amount. */
  meta?: LocalizedText;
}

/**
 * The full journey snapshot for one entity. Producers assemble this; the
 * journey-layer UI components consume slices of it.
 */
export interface JourneySummary {
  /** The subject record this journey describes (e.g. a contract id). */
  entity: string;
  stages: ProcessStage[];
  blockers: ProcessBlocker[];
  nextActions: NextBestAction[];
  related: RelatedRecordSummary[];
}

/**
 * A single actionable bucket in a role's task queue (e.g. "5 contracts
 * awaiting signature"). `severity` tints the count chip.
 */
export interface RoleTaskQueueItem {
  id: string;
  title: LocalizedText;
  count?: number;
  href: string;
  severity?: "info" | "warning" | "error";
}
