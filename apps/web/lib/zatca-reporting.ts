import "server-only";

import { db } from "@repo/db";
import { clearTenantDocumentInternal } from "./zatca-issuance";

/**
 * ZATCA Track C (R4b) — the B2C reporting RECOVERY sweep + reporting-health metric.
 *
 * Documents are reported/cleared at issuance time (lib/zatca-issuance.ts). When that first
 * pass hits a transport error the document is parked at `zatcaStatus = PENDING` with its signed
 * payload stored. This sweep re-submits every parked document (idempotent — it re-POSTs the SAME
 * stored payload via `clearTenantDocumentInternal({ isRetry: true })`, which also short-circuits
 * any document that has since reached a terminal state).
 *
 * UNGUARDED internal (L26): the cron route guards with the cron secret; the admin action guards
 * with `zatca:admin`. SANDBOX-only (L25).
 */

const STUCK_HOURS = 12;
const DEFAULT_SWEEP_LIMIT = 50;

export interface ReportingSweepSummary {
  scanned: number;
  reported: number;
  cleared: number;
  stillPending: number;
  rejected: number;
  errors: number;
}

/** Re-submit every PENDING tenant document with a stored payload (B2C report + B2B transport-retry). */
export async function runReportingSweepInternal(opts?: { limit?: number }): Promise<ReportingSweepSummary> {
  const take = opts?.limit ?? DEFAULT_SWEEP_LIMIT;
  const pending = await db.tenantDocument.findMany({
    where: { zatcaStatus: "PENDING", documentType: { not: "RECEIPT" }, xmlContent: { not: null } },
    select: { id: true },
    orderBy: { zatcaSubmittedAt: "asc" },
    take,
  });

  const summary: ReportingSweepSummary = {
    scanned: pending.length,
    reported: 0,
    cleared: 0,
    stillPending: 0,
    rejected: 0,
    errors: 0,
  };

  for (const doc of pending) {
    try {
      const res = await clearTenantDocumentInternal(doc.id, { isRetry: true });
      if (res.outcome === "REPORTED") summary.reported++;
      else if (res.outcome === "CLEARED") summary.cleared++;
      else if (res.outcome === "REJECTED") summary.rejected++;
      else summary.stillPending++; // TRANSPORT_ERROR / SKIPPED — leave parked for the next sweep
    } catch (e) {
      console.error("[zatca] reporting sweep: document failed (non-blocking)", doc.id, e);
      summary.errors++;
    }
  }

  return summary;
}

export interface ReportingHealth {
  cleared: number;
  reported: number;
  pending: number;
  rejected: number;
  held: number;
  /** PENDING (submitted) documents older than 12h — the stuck-reporting alarm condition. */
  stuckOver12h: number;
}

/**
 * Reporting health for tenant documents. `organizationId = null` → platform-wide aggregate
 * (admin surface); a string → that org only (tenant surface). Counts the document lifecycle plus
 * the >12h stuck-reporting alarm condition.
 */
export async function getReportingHealthInternal(organizationId: string | null): Promise<ReportingHealth> {
  const orgWhere = organizationId ? { organizationId } : {};
  const stuckBefore = new Date(Date.now() - STUCK_HOURS * 3_600_000);

  const [grouped, held, stuckOver12h] = await Promise.all([
    db.tenantDocument.groupBy({ by: ["zatcaStatus"], where: orgWhere, _count: { _all: true } }),
    db.tenantDocument.count({ where: { ...orgWhere, needsBuyerData: true } }),
    db.tenantDocument.count({
      where: {
        ...orgWhere,
        zatcaStatus: "PENDING",
        documentType: { not: "RECEIPT" },
        zatcaSubmittedAt: { lt: stuckBefore },
      },
    }),
  ]);

  const count = (status: string) => grouped.find((g) => g.zatcaStatus === status)?._count._all ?? 0;

  return {
    cleared: count("CLEARED"),
    reported: count("REPORTED"),
    pending: count("PENDING"),
    rejected: count("REJECTED"),
    held,
    stuckOver12h,
  };
}
