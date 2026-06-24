"use server";

import { db } from "@repo/db";
import { requireTenantPermission } from "../../../lib/auth-helpers";
import { logAuditEvent } from "../../../lib/audit";
import { revalidatePath } from "next/cache";
import { ROUTES } from "../../../lib/routes";
import { serialize } from "../../../lib/serialize";
import { getReportingHealthInternal } from "../../../lib/zatca-reporting";
import { reissueHeldDocumentInternal } from "../../../lib/zatca-issuance";
import { buildLegalPdfA3 } from "../../../lib/zatca-pdfa";

/**
 * Tenant ZATCA documents surface (Track C / R4b) — `payments:read`, TENANT audience. Every
 * action calls `requireTenantPermission("payments:read")` IN ITS OWN BODY (QA-SEC-01 AST guard
 * needs it inline) and is strictly org-scoped; the detail fetch re-checks row ownership before
 * returning (cross-org isolation, §8). Returns only display columns — no key/secret material.
 */

const LIST_SELECT = {
  id: true,
  documentNumber: true,
  documentType: true,
  kind: true,
  chargeType: true,
  buyerName: true,
  buyerVatNumber: true,
  subtotal: true,
  vatAmount: true,
  total: true,
  status: true,
  zatcaStatus: true,
  needsBuyerData: true,
  issuedAt: true,
  zatcaClearedAt: true,
} as const;

/** The tenant org's issued ZATCA documents + its reporting health (page header KPIs). */
export async function getTenantInvoices() {
  const { organizationId } = await requireTenantPermission("payments:read");

  const [documents, health] = await Promise.all([
    db.tenantDocument.findMany({
      where: { organizationId },
      select: LIST_SELECT,
      orderBy: { issuedAt: "desc" },
      take: 500,
    }),
    getReportingHealthInternal(organizationId),
  ]);

  return { documents: serialize(documents), health };
}

/**
 * Resolve the tenant document (tax invoice / receipt) issued for a given rent installment — used
 * to cross-link a payment row to its invoice. `payments:read`, TENANT audience, strictly
 * org-scoped. Returns `null` when no document exists (residential receipts and not-ZATCA-enabled
 * orgs simply have none — the caller hides the link). Most recent issuance wins.
 */
export async function getInvoiceForInstallment(rentInstallmentId: string) {
  const { organizationId } = await requireTenantPermission("payments:read");

  const doc = await db.tenantDocument.findFirst({
    where: { rentInstallmentId, organizationId },
    select: { id: true, documentNumber: true, zatcaStatus: true, documentType: true, needsBuyerData: true },
    orderBy: { issuedAt: "desc" },
  });
  return doc ? serialize(doc) : null;
}

/**
 * Batch variant of `getInvoiceForInstallment` — resolve the issued document (id + number +
 * status) for a set of rent installments in ONE query, so the payments table can show a "tax
 * invoice" link per row without an N+1 fan-out. `payments:read`, TENANT audience, org-scoped.
 * Returns a record keyed by `rentInstallmentId`; installments with no document are simply absent.
 */
export async function getInvoicesForInstallments(rentInstallmentIds: string[]) {
  const { organizationId } = await requireTenantPermission("payments:read");
  if (rentInstallmentIds.length === 0) return {};

  const docs = await db.tenantDocument.findMany({
    where: { organizationId, rentInstallmentId: { in: rentInstallmentIds } },
    select: { id: true, documentNumber: true, zatcaStatus: true, documentType: true, rentInstallmentId: true },
    orderBy: { issuedAt: "desc" },
  });

  // Most-recent-wins per installment (findMany is ordered desc; first seen is newest).
  const map: Record<string, { id: string; documentNumber: string; zatcaStatus: string; documentType: string }> = {};
  for (const d of docs) {
    if (d.rentInstallmentId && !map[d.rentInstallmentId]) {
      map[d.rentInstallmentId] = {
        id: d.id,
        documentNumber: d.documentNumber,
        zatcaStatus: d.zatcaStatus,
        documentType: d.documentType,
      };
    }
  }
  return map;
}

/** A single tenant document with its line items — org-ownership re-checked. */
export async function getTenantInvoice(documentId: string) {
  const { organizationId } = await requireTenantPermission("payments:read");

  const doc = await db.tenantDocument.findFirst({
    where: { id: documentId, organizationId },
    include: {
      lineItems: { orderBy: { sortOrder: "asc" } },
      // Seller identity for the printed document — EGS public fields only (no key/secret material).
      egsUnit: {
        select: {
          legalNameAr: true,
          legalNameEn: true,
          vatNumber: true,
          crNumber: true,
          nationalAddress: true,
          environment: true,
        },
      },
      organization: { select: { name: true, nameArabic: true, logoUrl: true } },
    },
  });
  if (!doc) return null;

  return serialize(doc);
}

/**
 * Re-issue a HELD document after its buyer's VAT/CR/address have been completed. `finance:write`
 * (a money/issuance mutation), org-ownership re-checked. Returns `{ ok, missing }` — when the
 * buyer is still incomplete the document stays HELD and the missing fields are returned.
 */
export async function reissueHeldDocument(documentId: string) {
  const session = await requireTenantPermission("finance:write");

  const owned = await db.tenantDocument.findFirst({
    where: { id: documentId, organizationId: session.organizationId },
    select: { id: true },
  });
  if (!owned) throw new Error("Document not found.");

  const result = await reissueHeldDocumentInternal(documentId);

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "UPDATE",
    resource: "TenantDocument",
    resourceId: documentId,
    organizationId: session.organizationId,
    metadata: { reissue: result.outcome, missing: result.missing ?? [] },
  });

  revalidatePath(ROUTES.invoices);
  return {
    ok: result.outcome !== "HELD",
    outcome: result.outcome,
    missing: result.missing ?? [],
  };
}

/**
 * Build the ZATCA "legal copy" PDF (a human-readable A4 summary with the cleared/reported e-invoice
 * UBL XML embedded — PDF/A-3 structure best-effort, see `zatca-pdfa.ts`). `payments:read`, TENANT
 * audience; org-scoped inside `buildLegalPdfA3`. Returns the bytes base64-encoded for the client to
 * trigger a download. Only CLEARED/REPORTED documents have legal XML — others throw.
 */
export async function downloadLegalPdf(documentId: string): Promise<{ base64: string; filename: string }> {
  const session = await requireTenantPermission("payments:read");

  const bytes = await buildLegalPdfA3(documentId, session.organizationId);
  return {
    base64: Buffer.from(bytes).toString("base64"),
    filename: `${documentId}.pdf`,
  };
}
