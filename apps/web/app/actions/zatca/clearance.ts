"use server";

import { db } from "@repo/db";
import { requirePermission } from "../../../lib/auth-helpers";
import { logAuditEvent } from "../../../lib/audit";
import { revalidatePath } from "next/cache";
import { ROUTES } from "../../../lib/routes";
import { clearSubscriptionInvoiceInternal, createCreditNoteInternal } from "../../../lib/zatca-clearance";

/**
 * Platform ZATCA clearance actions (Track A) — `zatca:admin` (SYSTEM_ONLY). The actual
 * orchestration lives in lib/zatca-clearance (server-only, unguarded); these are the thin
 * guarded + audited entry points the admin UI calls.
 */

/** Clear a SaaS invoice now, or transport-retry it (re-POST the stored payload) if PENDING. */
export async function clearInvoiceNow(invoiceId: string) {
  const session = await requirePermission("zatca:admin");
  const inv = await db.invoice.findUnique({
    where: { id: invoiceId },
    select: { zatcaStatus: true, xmlContent: true },
  });
  const isRetry = inv?.zatcaStatus === "PENDING" && !!inv.xmlContent;
  const result = await clearSubscriptionInvoiceInternal(invoiceId, { isRetry });
  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "UPDATE",
    resource: "Invoice",
    resourceId: invoiceId,
    organizationId: session.organizationId,
    metadata: { zatca: result.outcome, retry: isRetry },
  });
  revalidatePath(ROUTES.adminZatca);
  revalidatePath(ROUTES.adminPayments);
  return result;
}

/** Issue + clear a credit note for a cleared SaaS invoice (cancellation / refund, D11/D22b). */
export async function createInvoiceCreditNote(originalInvoiceId: string, reason: string) {
  const session = await requirePermission("zatca:admin");
  if (!reason?.trim()) throw new Error("A reason is required for a credit note.");
  const { creditNoteId, result } = await createCreditNoteInternal(originalInvoiceId, reason.trim());
  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "CREATE",
    resource: "Invoice",
    resourceId: creditNoteId,
    organizationId: session.organizationId,
    metadata: { creditNoteFor: originalInvoiceId, zatca: result.outcome },
  });
  revalidatePath(ROUTES.adminZatca);
  revalidatePath(ROUTES.adminPayments);
  return { creditNoteId, result };
}
