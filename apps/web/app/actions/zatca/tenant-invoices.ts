"use server";

import { db } from "@repo/db";
import { requireTenantPermission } from "../../../lib/auth-helpers";
import { serialize } from "../../../lib/serialize";
import { getReportingHealthInternal } from "../../../lib/zatca-reporting";

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

/** A single tenant document with its line items — org-ownership re-checked. */
export async function getTenantInvoice(documentId: string) {
  const { organizationId } = await requireTenantPermission("payments:read");

  const doc = await db.tenantDocument.findFirst({
    where: { id: documentId, organizationId },
    include: { lineItems: { orderBy: { sortOrder: "asc" } } },
  });
  if (!doc) return null;

  return serialize(doc);
}
