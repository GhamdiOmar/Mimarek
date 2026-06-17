// ═══════════════════════════════════════════════════════════════════════════════
// Data-Retention & Destruction (D1) — SHARED TYPES (plain module, NO directive)
//
// This is a plain TypeScript types module — it carries NO "use server" and NO
// "server-only" directive. It is the single home for every retention type that
// crosses a module boundary (core ↔ action ↔ page), so that neither the
// "use server" action file nor the "server-only" core file has to re-export a
// type (which Turbopack mis-emits as a runtime binding from a "use server" file
// → ReferenceError; AGENTS.md §4: a "use server" file may ONLY export async
// functions). Pure type declarations have zero runtime footprint, so they are
// safe to import from both client and server modules.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Core domain types (the four time-series tables purged by retention) ────────

// Per-table physical Postgres table names (Prisma maps model → table 1:1 here;
// all four use mixed-case identifiers that MUST stay double-quoted in raw SQL).
export type RetentionTable =
  | "AuditLog"
  | "ConsentLog"
  | "Notification"
  | "WebhookEvent";

// Per-table eligible/deleted counts produced by a sweep.
export type PerTableResult = { eligible: number; deleted: number };

// Result returned by the destructive core (`executeRetention`) and surfaced to
// the page via the `runDataRetention` server action.
export type ExecuteRetentionResult =
  | { status: "SKIPPED_LOCKED" }
  | {
      status: "SUCCESS";
      runId: string | null;
      dryRun: boolean;
      totalDeleted: number;
      perTable: Record<RetentionTable, PerTableResult>;
    };

// ─── Serialized DTO shapes returned to the client by the action wrappers ────────

export interface RetentionConfigDTO {
  retentionAuditLogDays: number;
  retentionConsentLogDays: number;
  retentionNotificationDays: number;
  retentionWebhookEventDays: number;
  retentionSchedulerEnabled: boolean;
  retentionRunHour: number;
  lastRetentionRunAt: string | null;
}

export interface RetentionTableStat {
  table: RetentionTable;
  rowCount: number;
  oldestCreatedAt: string | null;
  windowDays: number;
  eligibleNow: number;
}

export interface RetentionRunDTO {
  id: string;
  trigger: string;
  dryRun: boolean;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  totalDeleted: number;
  results: Record<string, { eligible: number; deleted: number }> | null;
  triggeredByEmail: string | null;
}

export interface RetentionOverview {
  config: RetentionConfigDTO;
  tables: RetentionTableStat[];
  lastRun: RetentionRunDTO | null;
}
