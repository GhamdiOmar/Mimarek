"use server";

import { db } from "@repo/db";
import { revalidatePath } from "next/cache";
import { ROUTES } from "../../lib/routes";
import { requirePermission } from "../../lib/auth-helpers";
import { logAuditEvent } from "../../lib/audit";
import {
  executeRetention,
  readSystemConfig,
  countTable,
  oldestCreatedAt,
  countEligible,
  windowKeyFor,
  RETENTION_TABLES,
  RETENTION_DEFAULTS,
  PDPL_FLOOR_DAYS,
} from "../../lib/server/data-retention-core";
import type {
  ExecuteRetentionResult,
  RetentionTableStat,
  RetentionRunDTO,
  RetentionOverview,
} from "../dashboard/admin/data-retention/types";

// ═══════════════════════════════════════════════════════════════════════════════
// Data-Retention & Destruction — PUBLIC server actions (system-only)
//
// The destructive core (`executeRetention`) + the shared retention infra now
// live in the `server-only` module `lib/server/data-retention-core.ts`, so the
// core is NOT a network-reachable "use server" RPC (QA C-1). This file keeps ONLY
// the three GUARDED async wrappers, each gating on the system-only `billing:admin`
// permission (§8 platform-staff surface):
//   • runDataRetention   — trigger a sweep (dry-run preview or real destruction)
//   • getRetentionOverview — read the dashboard model
//   • saveRetentionConfig  — persist windows + scheduler settings
// ═══════════════════════════════════════════════════════════════════════════════

// All shared retention types (RetentionTable, ExecuteRetentionResult, and the
// serialized DTOs: RetentionConfigDTO / RetentionTableStat / RetentionRunDTO /
// RetentionOverview) live in the plain module
// `app/dashboard/admin/data-retention/types.ts`. This file is "use server", so
// it may ONLY export async functions (AGENTS.md §4) — it imports those types for
// its own annotations and never re-exports them.

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC server actions — system-only (billing:admin)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Trigger a retention sweep from the admin console. `dryRun=true` previews
 * eligible counts; `dryRun=false` performs the destruction.
 */
export async function runDataRetention(
  dryRun: boolean,
): Promise<ExecuteRetentionResult> {
  const s = await requirePermission("billing:admin");
  return executeRetention({
    trigger: "MANUAL",
    dryRun,
    actor: { id: s.userId, email: s.email, role: s.role },
  });
}

/**
 * Read the full retention dashboard model: config, per-table stats, last run.
 */
export async function getRetentionOverview(): Promise<RetentionOverview> {
  await requirePermission("billing:admin");

  const config = await readSystemConfig();
  const now = Date.now();

  const tables: RetentionTableStat[] = [];
  for (const table of RETENTION_TABLES) {
    const windowDays = config[windowKeyFor(table)] as number;
    const rowCount = await countTable(table);
    const oldest = await oldestCreatedAt(table);
    let eligibleNow = 0;
    if (windowDays > 0) {
      const cutoff = new Date(now - windowDays * 86400000);
      eligibleNow = await countEligible(table, cutoff);
    }
    tables.push({
      table,
      rowCount,
      oldestCreatedAt: oldest ? oldest.toISOString() : null,
      windowDays,
      eligibleNow,
    });
  }

  const lastRunRow = await db.dataRetentionRun.findFirst({
    where: { dryRun: false },
    orderBy: { startedAt: "desc" },
  });

  return {
    config: {
      retentionAuditLogDays: config.retentionAuditLogDays,
      retentionConsentLogDays: config.retentionConsentLogDays,
      retentionNotificationDays: config.retentionNotificationDays,
      retentionWebhookEventDays: config.retentionWebhookEventDays,
      retentionSchedulerEnabled: config.retentionSchedulerEnabled,
      retentionRunHour: config.retentionRunHour,
      lastRetentionRunAt: config.lastRetentionRunAt
        ? config.lastRetentionRunAt.toISOString()
        : null,
    },
    tables,
    lastRun: lastRunRow
      ? {
          id: lastRunRow.id,
          trigger: lastRunRow.trigger,
          dryRun: lastRunRow.dryRun,
          status: lastRunRow.status,
          startedAt: lastRunRow.startedAt.toISOString(),
          finishedAt: lastRunRow.finishedAt
            ? lastRunRow.finishedAt.toISOString()
            : null,
          totalDeleted: lastRunRow.totalDeleted,
          results:
            (lastRunRow.results as RetentionRunDTO["results"]) ?? null,
          triggeredByEmail: lastRunRow.triggeredByEmail,
        }
      : null,
  };
}

/**
 * Persist the retention windows + scheduler settings. CLAMPS audit & consent
 * windows to the PDPL/NDMO 730-day floor server-side (the UI also validates, but
 * this is the authoritative enforcement). Other windows accept 0 (= disabled).
 */
export async function saveRetentionConfig(input: {
  retentionAuditLogDays: number;
  retentionConsentLogDays: number;
  retentionNotificationDays: number;
  retentionWebhookEventDays: number;
  retentionSchedulerEnabled: boolean;
  retentionRunHour: number;
}): Promise<{ success: true }> {
  const session = await requirePermission("billing:admin");

  // Coerce to safe integers, clamp PDPL-protected windows, bound run-hour 0..23.
  const clampFloor = (v: number, floor: number) =>
    Math.max(floor, Math.trunc(Number.isFinite(v) ? v : floor));
  const clampMin0 = (v: number) =>
    Math.max(0, Math.trunc(Number.isFinite(v) ? v : 0));

  const data = {
    retentionAuditLogDays: clampFloor(input.retentionAuditLogDays, PDPL_FLOOR_DAYS),
    retentionConsentLogDays: clampFloor(input.retentionConsentLogDays, PDPL_FLOOR_DAYS),
    retentionNotificationDays: clampMin0(input.retentionNotificationDays),
    retentionWebhookEventDays: clampMin0(input.retentionWebhookEventDays),
    retentionSchedulerEnabled: Boolean(input.retentionSchedulerEnabled),
    retentionRunHour: Math.min(23, Math.max(0, Math.trunc(input.retentionRunHour) || 0)),
  };

  await db.systemConfig.upsert({
    where: { id: "system" },
    create: { id: "system", ...RETENTION_DEFAULTS, ...data },
    update: data,
  });

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "UPDATE",
    resource: "SystemConfig",
    resourceId: "system",
    metadata: { section: "data-retention", ...data },
    organizationId: null,
  });

  revalidatePath(ROUTES.adminDataRetention);
  return { success: true };
}
