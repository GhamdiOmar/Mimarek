import { db, Prisma } from "@repo/db";
import { headers } from "next/headers";

export type AuditAction =
  | "CREATE"
  | "READ"
  | "UPDATE"
  | "DELETE"
  | "READ_PII"
  | "EXPORT"
  | "LOGIN"
  | "LOGOUT"
  | "PASSWORD_CHANGE"
  | "PASSWORD_RESET_REQUEST"
  | "PASSWORD_RESET"
  | "REGISTER"
  | "EMAIL_VERIFICATION_REQUEST"
  | "EMAIL_VERIFIED"
  // Marketplace lifecycle (cross-org B2B trading)
  | "MARKETPLACE_LISTING_PUBLISHED"
  | "MARKETPLACE_LISTING_UPDATED"
  | "MARKETPLACE_LISTING_UNPUBLISHED"
  | "MARKETPLACE_LISTING_SUSPENDED"
  | "MARKETPLACE_LISTING_EXPIRED"
  | "MARKETPLACE_INQUIRY_CREATED"
  | "MARKETPLACE_INQUIRY_WITHDRAWN"
  | "MARKETPLACE_INQUIRY_CONVERTED"
  | "MARKETPLACE_TRANSFER_STARTED"
  | "MARKETPLACE_TRANSFER_COMPLETED"
  | "MARKETPLACE_TRANSFER_FAILED"
  // Marketplace P3 conveyance (reserve-and-buy rails — moderation, REGA, deed, kill-switch)
  | "MARKETPLACE_LISTING_SUBMITTED"
  | "MARKETPLACE_LISTING_APPROVED"
  | "MARKETPLACE_LISTING_REJECTED"
  | "ORG_REGA_SUBMITTED"
  | "ORG_REGA_VERIFIED"
  | "ORG_REGA_REJECTED"
  | "DEED_PROOF_SUBMITTED"
  | "DEED_PROOF_VERIFIED"
  | "DEED_PROOF_REJECTED"
  | "MARKETPLACE_CONVEYANCE_TOGGLED"
  | "MARKETPLACE_TRANSFER_BLOCKED"
  | "MAINTENANCE_BLOCKED_NOT_OWNER";

export interface AuditEventParams {
  userId: string;
  userEmail: string;
  userRole: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  organizationId: string | null;
  /** RED: record state before mutation (for UPDATE/DELETE) */
  before?: Record<string, unknown>;
  /** RED: record state after mutation (for CREATE/UPDATE) */
  after?: Record<string, unknown>;
}

/**
 * Compute field-level diff between before and after snapshots.
 * Returns array of {field, oldValue, newValue} for changed fields.
 */
function computeFieldChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): Array<{ field: string; oldValue: unknown; newValue: unknown }> {
  const changes: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    const oldVal = before[key];
    const newVal = after[key];
    // Simple JSON comparison for deep equality
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({ field: key, oldValue: oldVal ?? null, newValue: newVal ?? null });
    }
  }

  return changes;
}

/**
 * Shared audit writer — does the work and LETS ERRORS THROW (SEC-015).
 * This is the single source of truth for *how* an audit row is written; the two
 * public entry points below choose the error-handling contract:
 *   - `logAuditEvent`      — fire-and-forget (swallow), for routine reads/writes.
 *   - `logAuditEventAwait` — await + propagate, for security-critical mutations.
 *
 * RED Enhancement: When `before` and/or `after` are provided, stores
 * changeSnapshot and auto-computes fieldChanges diff.
 */
async function writeAuditLog(params: AuditEventParams): Promise<void> {
  let ipAddress: string | null = null;
  try {
    const h = await headers();
    ipAddress =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      h.get("x-real-ip") ??
      null;
  } catch {
    // Headers may not be available in some contexts
  }

  // Build change tracking data when before/after provided
  let changeSnapshot: object | undefined;
  let fieldChanges: Array<{ field: string; oldValue: unknown; newValue: unknown }> | undefined;

  if (params.before || params.after) {
    changeSnapshot = {
      ...(params.before ? { before: params.before } : {}),
      ...(params.after ? { after: params.after } : {}),
    };
  }

  if (params.before && params.after) {
    fieldChanges = computeFieldChanges(params.before, params.after);
  }

  await db.auditLog.create({
    data: {
      userId: params.userId,
      userEmail: params.userEmail,
      userRole: params.userRole,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId,
      metadata: params.metadata as Prisma.InputJsonValue,
      changeSnapshot: changeSnapshot as Prisma.InputJsonValue,
      fieldChanges: fieldChanges as Prisma.InputJsonValue,
      ipAddress,
      organizationId: params.organizationId,
    },
  });
}

/**
 * Log an audit event (fire-and-forget).
 * Never throws — swallows errors so it never blocks the main request.
 *
 * Use this for routine reads/writes (incl. READ_PII on a list/detail render):
 * a page must not 500 because the audit store hiccupped. For security-critical
 * MUTATIONS that must fail closed, use `logAuditEventAwait` instead (SEC-015).
 */
export function logAuditEvent(params: AuditEventParams): void {
  void writeAuditLog(params).catch((e) =>
    console.error("[Audit] Failed to log event:", e),
  );
}

/**
 * Log an audit event and AWAIT it (fail-closed) — SEC-015.
 * Propagates the underlying error so the calling mutation aborts if the
 * security-critical audit record could not be durably written. Reserve this for
 * the highest-stakes mutations (deed-proof verification, conveyance kill-switch,
 * billing plan/subscription changes); routine reads stay fire-and-forget.
 */
export async function logAuditEventAwait(params: AuditEventParams): Promise<void> {
  await writeAuditLog(params);
}
