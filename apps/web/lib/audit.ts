import { db } from "@repo/db";
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
  | "REGISTER";

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
 * Log an audit event (fire-and-forget).
 * Never throws — catches errors internally so it never blocks the main request.
 *
 * RED Enhancement: When `before` and/or `after` are provided, stores
 * changeSnapshot and auto-computes fieldChanges diff.
 */
export function logAuditEvent(params: AuditEventParams): void {
  // Fire-and-forget: run async but don't await
  void (async () => {
    try {
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
          metadata: params.metadata as any,
          changeSnapshot: changeSnapshot as any,
          fieldChanges: fieldChanges as any,
          ipAddress,
          organizationId: params.organizationId,
        },
      });
    } catch (error) {
      console.error("[Audit] Failed to log event:", error);
    }
  })();
}
