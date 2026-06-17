import "server-only";

import { db } from "@repo/db";
import { logAuditEvent } from "../audit";
import type {
  RetentionTable,
  PerTableResult,
  ExecuteRetentionResult,
} from "../../app/dashboard/admin/data-retention/types";

// ═══════════════════════════════════════════════════════════════════════════════
// Data-Retention & Destruction core (D1) — server-only, NOT a "use server" RPC
//
// PDPL/NDMO-aligned scheduled + manual destruction of time-series operational
// data. `executeRetention` is the DESTRUCTIVE core (advisory lock + chunked
// DELETE of AuditLog/ConsentLog/Notification/WebhookEvent). It lives in a
// `server-only` module so it is:
//   • un-importable from client code, AND
//   • NOT exposed as a network-reachable POST RPC (it is not a "use server"
//     export). The only callers are the GUARDED server-action wrappers in
//     `app/actions/data-retention.ts` (requirePermission billing:admin) and the
//     cron route (`app/api/cron/run-data-retention/route.ts`, gated by
//     isAuthorizedCronRequest). The core therefore takes no own permission gate.
//
// The shared retention infra (table registry, config singleton, per-table reads)
// also lives here so the action wrappers can build the overview without
// duplicating it.
// ═══════════════════════════════════════════════════════════════════════════════

// `RetentionTable` / `PerTableResult` / `ExecuteRetentionResult` now live in the
// shared plain types module (imported above) so the "use server" action wrapper
// can reference them without re-exporting a type (AGENTS.md §4). The window-key
// union below is PURELY internal to this core (TABLE_CONFIG + windowKeyFor), so
// it stays local — it crosses no module boundary.
export type RetentionWindowKey =
  | "retentionAuditLogDays"
  | "retentionConsentLogDays"
  | "retentionNotificationDays"
  | "retentionWebhookEventDays";

// Maps each retention table to the SystemConfig window field that governs it.
const TABLE_CONFIG: Record<
  RetentionTable,
  { windowKey: RetentionWindowKey }
> = {
  AuditLog: { windowKey: "retentionAuditLogDays" },
  ConsentLog: { windowKey: "retentionConsentLogDays" },
  Notification: { windowKey: "retentionNotificationDays" },
  WebhookEvent: { windowKey: "retentionWebhookEventDays" },
};

export const RETENTION_TABLES = Object.keys(TABLE_CONFIG) as RetentionTable[];

// PDPL/NDMO floor — audit & consent trails are legally-retained evidence and may
// never be configured below 730 days (2 years). Enforced server-side on save.
export const PDPL_FLOOR_DAYS = 730;

// Advisory-lock key — a single global lock so concurrent cron + manual runs
// never delete the same rows twice (one constant, repo-unique).
const ADVISORY_LOCK_KEY = 4815162342;

// Chunk size for batched deletes — bounded statement so a multi-million-row
// purge never blows the transaction/statement budget.
const BATCH = 5000;

// ─── SystemConfig singleton helpers ────────────────────────────────────────────

export const RETENTION_DEFAULTS = {
  retentionAuditLogDays: 730,
  retentionConsentLogDays: 730,
  retentionNotificationDays: 180,
  retentionWebhookEventDays: 90,
  retentionSchedulerEnabled: false,
  retentionRunHour: 3,
};

export async function readSystemConfig() {
  return db.systemConfig.upsert({
    where: { id: "system" },
    create: { id: "system", ...RETENTION_DEFAULTS },
    update: {},
  });
}

export function windowKeyFor(table: RetentionTable): RetentionWindowKey {
  return TABLE_CONFIG[table].windowKey;
}

// Per-table count + oldest createdAt — used by the overview and by each run.
export async function countTable(table: RetentionTable): Promise<number> {
  switch (table) {
    case "AuditLog":
      return db.auditLog.count();
    case "ConsentLog":
      return db.consentLog.count();
    case "Notification":
      return db.notification.count();
    case "WebhookEvent":
      return db.webhookEvent.count();
  }
}

export async function oldestCreatedAt(
  table: RetentionTable,
): Promise<Date | null> {
  const sel = { createdAt: true } as const;
  const order = { createdAt: "asc" as const };
  let row: { createdAt: Date } | null = null;
  switch (table) {
    case "AuditLog":
      row = await db.auditLog.findFirst({ select: sel, orderBy: order });
      break;
    case "ConsentLog":
      row = await db.consentLog.findFirst({ select: sel, orderBy: order });
      break;
    case "Notification":
      row = await db.notification.findFirst({ select: sel, orderBy: order });
      break;
    case "WebhookEvent":
      row = await db.webhookEvent.findFirst({ select: sel, orderBy: order });
      break;
  }
  return row?.createdAt ?? null;
}

export async function countEligible(
  table: RetentionTable,
  cutoff: Date,
): Promise<number> {
  const where = { createdAt: { lt: cutoff } } as const;
  switch (table) {
    case "AuditLog":
      return db.auditLog.count({ where });
    case "ConsentLog":
      return db.consentLog.count({ where });
    case "Notification":
      return db.notification.count({ where });
    case "WebhookEvent":
      return db.webhookEvent.count({ where });
  }
}

/**
 * Batched chunked physical delete for one table. Loops `DELETE … WHERE id IN
 * (SELECT id … LIMIT BATCH)` until a pass affects fewer than BATCH rows.
 *
 * SELF-PURGE SAFETY (AuditLog only): the AuditLog branch also requires
 * `createdAt < runStartedAt` AND `resource <> 'DataRetentionRun'` so a run never
 * deletes its own audit row nor any retention-run audit record. The other three
 * tables carry no such records, so they purge purely by cutoff.
 */
async function deleteInBatches(
  table: RetentionTable,
  cutoff: Date,
  runStartedAt: Date,
): Promise<number> {
  let totalDeleted = 0;
  // Loop until a batch deletes < BATCH rows (the tail).
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let affected = 0;
    switch (table) {
      case "AuditLog":
        affected = await db.$executeRaw`
          DELETE FROM "AuditLog"
          WHERE id IN (
            SELECT id FROM "AuditLog"
            WHERE "createdAt" < ${cutoff}
              AND "createdAt" < ${runStartedAt}
              AND "resource" <> 'DataRetentionRun'
            LIMIT ${BATCH}
          )`;
        break;
      case "ConsentLog":
        affected = await db.$executeRaw`
          DELETE FROM "ConsentLog"
          WHERE id IN (
            SELECT id FROM "ConsentLog"
            WHERE "createdAt" < ${cutoff}
            LIMIT ${BATCH}
          )`;
        break;
      case "Notification":
        affected = await db.$executeRaw`
          DELETE FROM "Notification"
          WHERE id IN (
            SELECT id FROM "Notification"
            WHERE "createdAt" < ${cutoff}
            LIMIT ${BATCH}
          )`;
        break;
      case "WebhookEvent":
        affected = await db.$executeRaw`
          DELETE FROM "WebhookEvent"
          WHERE id IN (
            SELECT id FROM "WebhookEvent"
            WHERE "createdAt" < ${cutoff}
            LIMIT ${BATCH}
          )`;
        break;
    }
    totalDeleted += affected;
    if (affected < BATCH) break;
  }
  return totalDeleted;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERNAL destruction core — server-only (no requirePermission; callers guard)
// ═══════════════════════════════════════════════════════════════════════════════

export async function executeRetention({
  trigger,
  dryRun,
  actor,
}: {
  trigger: "CRON" | "MANUAL";
  dryRun: boolean;
  actor?: { id: string; email: string; role?: string };
}): Promise<ExecuteRetentionResult> {
  // Capture the wall-clock at entry — the AuditLog self-purge boundary and the
  // per-table cutoffs are all anchored to this single instant.
  const runStartedAt = new Date();

  // (1) Acquire a Postgres advisory lock. If another sweep holds it, skip.
  const lockRows = await db.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(${ADVISORY_LOCK_KEY}) AS locked`;
  if (!lockRows[0]?.locked) {
    return { status: "SKIPPED_LOCKED" };
  }

  try {
    // (2) Read the configured windows.
    const config = await readSystemConfig();

    const perTable = {} as Record<RetentionTable, PerTableResult>;
    const cutoffs = {} as Record<RetentionTable, Date | null>;

    for (const table of RETENTION_TABLES) {
      const windowDays = config[TABLE_CONFIG[table].windowKey] as number;
      // windowDays === 0 → category disabled, skip entirely.
      if (windowDays === 0) {
        perTable[table] = { eligible: 0, deleted: 0 };
        cutoffs[table] = null;
        continue;
      }
      const cutoff = new Date(runStartedAt.getTime() - windowDays * 86400000);
      cutoffs[table] = cutoff;
      perTable[table] = {
        eligible: await countEligible(table, cutoff),
        deleted: 0,
      };
    }

    // Dry-run: report eligible counts, delete nothing, write no run row.
    if (dryRun) {
      return {
        status: "SUCCESS",
        runId: null,
        dryRun: true,
        totalDeleted: 0,
        perTable,
      };
    }

    // (3) Create the RUNNING run row, then delete in batches per table.
    const run = await db.dataRetentionRun.create({
      data: {
        trigger,
        dryRun: false,
        startedAt: runStartedAt,
        status: "RUNNING",
        triggeredById: actor?.id ?? null,
        triggeredByEmail: actor?.email ?? null,
      },
    });

    try {
      for (const table of RETENTION_TABLES) {
        const cutoff = cutoffs[table];
        if (!cutoff) continue; // disabled category
        const deleted = await deleteInBatches(table, cutoff, runStartedAt);
        perTable[table].deleted = deleted;
      }

      const totalDeleted = RETENTION_TABLES.reduce(
        (sum, t) => sum + perTable[t].deleted,
        0,
      );

      // (5) Finalize run + stamp lastRetentionRunAt (real runs only).
      await db.dataRetentionRun.update({
        where: { id: run.id },
        data: {
          status: "SUCCESS",
          finishedAt: new Date(),
          results: perTable as object,
          totalDeleted,
        },
      });

      await db.systemConfig.update({
        where: { id: "system" },
        data: { lastRetentionRunAt: new Date() },
      });

      // (6) Audit the destruction.
      logAuditEvent({
        userId: actor?.id ?? "system",
        userEmail: actor?.email ?? "system",
        userRole: actor?.role ?? "SYSTEM_ADMIN",
        action: "DELETE",
        resource: "DataRetentionRun",
        resourceId: run.id,
        metadata: { trigger, dryRun: false, totalDeleted, perTable },
        organizationId: null,
      });

      return {
        status: "SUCCESS",
        runId: run.id,
        dryRun: false,
        totalDeleted,
        perTable,
      };
    } catch (err) {
      // Mark the run FAILED so a partial sweep is visible in history.
      await db.dataRetentionRun
        .update({
          where: { id: run.id },
          data: {
            status: "FAILED",
            finishedAt: new Date(),
            error: err instanceof Error ? err.message : String(err),
            results: perTable as object,
          },
        })
        .catch(() => {});
      throw err;
    }
  } finally {
    // Always release the advisory lock.
    await db.$queryRaw`SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY})`;
  }
}
