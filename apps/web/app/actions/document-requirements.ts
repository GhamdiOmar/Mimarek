"use server";

import { db } from "@repo/db";
import { requirePermission } from "../../lib/auth-helpers";
import type { DocCategory, ContractStatus } from "@repo/db";

// ─── Required-by-stage mapping ─────────────────────────────────────────────────
//
// Pure constant — NOT stored in DB. Maps each ContractStatus to the DocCategory
// values that must be present for the contract to be considered complete at that
// stage.
//   DRAFT     → no required docs (contract is still being prepared)
//   SENT      → LEGAL document required (permit/authority clearance before sending)
//   SIGNED    → CONTRACT document required (signed copy must be filed)
//   CANCELLED → no required docs (workflow is terminal)
//   VOID      → no required docs (workflow is terminal)
//
// NOTE: module-private — a "use server" file may only EXPORT async functions
// (Next.js Server Actions constraint). Exporting this const broke the contracts
// page's server-action bundle ("can only export async functions, found object").
const REQUIRED_DOCS_BY_STATUS: Record<ContractStatus, DocCategory[]> = {
  DRAFT:     [],
  SENT:      ["LEGAL"],
  SIGNED:    ["CONTRACT"],
  CANCELLED: [],
  VOID:      [],
};

/**
 * getMissingRequiredDocs
 *
 * Returns the list of DocCategory values that are required for the given
 * contract's current status but not yet present in the document store.
 *
 * Lookup strategy (org-scoped throughout):
 *   1. Documents linked directly via Document.contractId = contractId
 *   2. Fallback: Documents linked via Document.customerId = contract.customerId
 *      (covers docs uploaded before the contractId relation existed)
 *
 * Only categories in REQUIRED_DOCS_BY_STATUS for the contract's current status
 * are evaluated. Returns [] when all required docs are present or none required.
 */
export async function getMissingRequiredDocs(
  contractId: string,
): Promise<DocCategory[]> {
  const session = await requirePermission("contracts:read");

  // Fetch the contract (org-scoped)
  const contract = await db.contract.findFirst({
    where: {
      id: contractId,
      // Contracts don't have organizationId — scope via customer's org or unit's org.
      // The contracts action already scopes by org through customer+unit relations;
      // here we re-scope by verifying the customer belongs to the caller's org.
      customer: { organizationId: session.organizationId },
    },
    select: {
      id: true,
      status: true,
      customerId: true,
    },
  });

  if (!contract) return [];

  const required = REQUIRED_DOCS_BY_STATUS[contract.status];
  if (!required || required.length === 0) return [];

  // Fetch categories of docs linked to this contract (by contractId)
  const byContractId = await db.document.findMany({
    where: {
      contractId: contract.id,
      organizationId: session.organizationId,
    },
    select: { category: true },
  });

  // Fallback: also pick up docs linked via customerId (legacy path)
  const byCustomerId = await db.document.findMany({
    where: {
      customerId: contract.customerId,
      organizationId: session.organizationId,
      // Exclude docs already counted above to avoid duplication
      contractId: null,
    },
    select: { category: true },
  });

  const presentCategories = new Set<DocCategory>([
    ...byContractId.map((d) => d.category),
    ...byCustomerId.map((d) => d.category),
  ]);

  return required.filter((cat) => !presentCategories.has(cat));
}
