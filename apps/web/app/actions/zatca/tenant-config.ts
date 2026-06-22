"use server";

import { db, type Prisma, type UnitType, type ZatcaChargeType, type VatCategory } from "@repo/db";
import { requirePermission } from "../../../lib/auth-helpers";
import { logAuditEvent } from "../../../lib/audit";
import { serialize } from "../../../lib/serialize";
import { revalidatePath } from "next/cache";
import { ROUTES } from "../../../lib/routes";
import { getTenantEgs } from "../../../lib/zatca-server";

/**
 * Track-B tenant ZATCA config (R3): branch metadata + tax mapping. Every exported
 * action calls `requirePermission("zatca:config")` IN ITS OWN BODY — the QA-SEC-01
 * AST guard (mimaric/require-action-guard) inspects each function body, so the guard
 * must be inline, NOT behind a shared wrapper. All actions are strictly org-scoped and
 * re-check row ownership before any mutate (cross-org isolation, §8).
 *
 * OrgZatcaTaxConfig stores configured INTENT only — the resolver that reads it to
 * classify a document line (issueDocumentForCharge) is R4. ZatcaBranch is metadata-only
 * in R3 (per-branch CSR/issuance is R4).
 */

const UNIT_TYPES: readonly string[] = ["APARTMENT", "VILLA", "OFFICE", "RETAIL", "WAREHOUSE", "PARKING"];
const CHARGE_TYPES: readonly string[] = ["RENT", "SERVICE_FEE", "DEPOSIT", "SALE", "OTHER"];
const VAT_CATEGORIES: readonly string[] = ["STANDARD", "ZERO", "EXEMPT", "OUT_OF_SCOPE"];

// The recommended starting map (KSA real-estate VAT treatment). Surfaced when the org
// has not yet saved its own; not persisted until the tenant saves. R5 tax-advisor review.
const DEFAULT_TAX_MAP = [
  { unitType: "APARTMENT", chargeType: "RENT", vatCategory: "EXEMPT", vatRate: null, eInvoiceEnabled: false },
  { unitType: "VILLA", chargeType: "RENT", vatCategory: "EXEMPT", vatRate: null, eInvoiceEnabled: false },
  { unitType: "OFFICE", chargeType: "RENT", vatCategory: "STANDARD", vatRate: 0.15, eInvoiceEnabled: true },
  { unitType: "RETAIL", chargeType: "RENT", vatCategory: "STANDARD", vatRate: 0.15, eInvoiceEnabled: true },
  { unitType: "WAREHOUSE", chargeType: "RENT", vatCategory: "STANDARD", vatRate: 0.15, eInvoiceEnabled: true },
  { unitType: "PARKING", chargeType: "RENT", vatCategory: "STANDARD", vatRate: 0.15, eInvoiceEnabled: true },
  { unitType: null, chargeType: "SERVICE_FEE", vatCategory: "STANDARD", vatRate: 0.15, eInvoiceEnabled: true },
  { unitType: null, chargeType: "SALE", vatCategory: "OUT_OF_SCOPE", vatRate: null, eInvoiceEnabled: false },
  { unitType: null, chargeType: "DEPOSIT", vatCategory: "OUT_OF_SCOPE", vatRate: null, eInvoiceEnabled: false },
] as const;

interface BranchInput {
  name: string;
  nameEn?: string;
  locationCode?: string;
  locationAddress?: Record<string, unknown> | null;
}

interface TaxRowInput {
  unitType: string | null;
  chargeType: string | null;
  vatCategory: string;
  vatRate: number | null;
  eInvoiceEnabled: boolean;
}

// ─── Branches (D15 — metadata-only in R3) ─────────────────────────────────────

/** List the tenant org's ZATCA branches. */
export async function getTenantBranches() {
  const { organizationId } = await requirePermission("zatca:config");
  if (!organizationId) throw new Error("An organization context is required.");
  const branches = await db.zatcaBranch.findMany({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
  });
  return serialize(branches);
}

/** Create a branch under the org's EGS (requires the org to have onboarded an EGS). */
export async function createTenantBranch(input: BranchInput) {
  const session = await requirePermission("zatca:config");
  const organizationId = session.organizationId;
  if (!organizationId) throw new Error("An organization context is required.");

  const name = input?.name?.trim();
  if (!name) throw new Error("A branch name is required.");

  const egs = await getTenantEgs(organizationId, "SANDBOX");
  if (!egs) throw new Error("Connect your organization to ZATCA before adding branches.");

  const branch = await db.zatcaBranch.create({
    data: {
      organizationId,
      egsUnitId: egs.id,
      name,
      nameEn: input.nameEn?.trim() || null,
      locationCode: input.locationCode?.trim() || null,
      locationAddress: (input.locationAddress ?? undefined) as Prisma.InputJsonValue | undefined,
      isActive: true,
    },
  });

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "CREATE",
    resource: "ZatcaBranch",
    resourceId: branch.id,
    organizationId,
  });

  revalidatePath(ROUTES.settingsZatca);
  return serialize(branch);
}

/** Update a branch — re-checks org ownership before mutating (cross-org isolation). */
export async function updateTenantBranch(id: string, input: BranchInput) {
  const session = await requirePermission("zatca:config");
  const organizationId = session.organizationId;
  if (!organizationId) throw new Error("An organization context is required.");

  const existing = await db.zatcaBranch.findUnique({ where: { id } });
  if (!existing || existing.organizationId !== organizationId) throw new Error("Branch not found.");

  const name = input?.name?.trim();
  if (!name) throw new Error("A branch name is required.");

  const branch = await db.zatcaBranch.update({
    where: { id },
    data: {
      name,
      nameEn: input.nameEn?.trim() || null,
      locationCode: input.locationCode?.trim() || null,
      locationAddress: (input.locationAddress ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "UPDATE",
    resource: "ZatcaBranch",
    resourceId: branch.id,
    organizationId,
  });

  revalidatePath(ROUTES.settingsZatca);
  return serialize(branch);
}

/** Delete a branch — re-checks org ownership first. */
export async function deleteTenantBranch(id: string) {
  const session = await requirePermission("zatca:config");
  const organizationId = session.organizationId;
  if (!organizationId) throw new Error("An organization context is required.");

  const existing = await db.zatcaBranch.findUnique({ where: { id } });
  if (!existing || existing.organizationId !== organizationId) throw new Error("Branch not found.");

  await db.zatcaBranch.delete({ where: { id } });

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "DELETE",
    resource: "ZatcaBranch",
    resourceId: id,
    organizationId,
  });

  revalidatePath(ROUTES.settingsZatca);
  return { ok: true };
}

// ─── Tax mapping (D16 — configured intent; R4 reads it) ───────────────────────

/**
 * The org's tax-mapping config. Returns persisted rows, or the recommended default
 * map (un-persisted, `id: null`) when the org has none yet — so the page always shows
 * a sensible starting point the tenant can edit and save.
 */
export async function getTenantTaxConfig() {
  const { organizationId } = await requirePermission("zatca:config");
  if (!organizationId) throw new Error("An organization context is required.");

  const rows = await db.orgZatcaTaxConfig.findMany({
    where: { organizationId },
    orderBy: [{ unitType: "asc" }, { chargeType: "asc" }],
  });

  if (rows.length > 0) {
    // Normalize the Decimal vatRate (serializes to a string) to a plain number|null so
    // the UI contract matches the default rows + saveTenantTaxConfig's input.
    const configs = rows.map((r) => ({ ...r, vatRate: r.vatRate == null ? null : Number(r.vatRate) }));
    return serialize({ configs, isDefault: false });
  }

  const defaults = DEFAULT_TAX_MAP.map((d) => ({
    id: null as string | null,
    organizationId,
    branchId: null,
    notes: null,
    isActive: true,
    ...d,
  }));
  return serialize({ configs: defaults, isDefault: true });
}

/**
 * Replace the org's tax-mapping config (atomic delete-and-recreate inside a tx —
 * avoids the nullable-composite-unique upsert trap; the form owns the whole set).
 * R3 is org-wide only (branchId = null); per-branch overrides are a later extension.
 */
export async function saveTenantTaxConfig(rows: TaxRowInput[]) {
  const session = await requirePermission("zatca:config");
  const organizationId = session.organizationId;
  if (!organizationId) throw new Error("An organization context is required.");
  if (!Array.isArray(rows)) throw new Error("Invalid tax configuration.");

  const data = rows.map((r) => {
    if (r.unitType !== null && !UNIT_TYPES.includes(r.unitType)) throw new Error("Invalid unit type.");
    if (r.chargeType !== null && !CHARGE_TYPES.includes(r.chargeType)) throw new Error("Invalid charge type.");
    if (!VAT_CATEGORIES.includes(r.vatCategory)) throw new Error("Invalid VAT category.");
    if (r.vatRate !== null && (typeof r.vatRate !== "number" || r.vatRate < 0 || r.vatRate > 1)) {
      throw new Error("VAT rate must be a fraction between 0 and 1 (e.g. 0.15).");
    }
    return {
      organizationId,
      branchId: null,
      unitType: (r.unitType as UnitType | null) ?? null,
      chargeType: (r.chargeType as ZatcaChargeType | null) ?? null,
      vatCategory: r.vatCategory as VatCategory,
      vatRate: r.vatRate,
      eInvoiceEnabled: Boolean(r.eInvoiceEnabled),
    };
  });

  await db.$transaction([
    db.orgZatcaTaxConfig.deleteMany({ where: { organizationId } }),
    db.orgZatcaTaxConfig.createMany({ data }),
  ]);

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "UPDATE",
    resource: "OrgZatcaTaxConfig",
    resourceId: organizationId,
    organizationId,
    metadata: { rows: data.length },
  });

  revalidatePath(ROUTES.settingsZatca);
  return serialize({ ok: true, count: data.length });
}
