import "server-only";

import type { Customer } from "@repo/db";

/**
 * ZATCA Track C (R4) buyer routing + the D18 data gate.
 *
 * A money movement is routed to a STANDARD (B2B, cleared) document only when the buyer is a
 * COMPANY whose tax identity is complete: a valid 15-digit VAT, a 10-digit CR, a name, and a
 * complete national address. An INDIVIDUAL (or a buyer with no valid VAT) → SIMPLIFIED (B2C,
 * reported). A COMPANY with INCOMPLETE data is HELD (not cleared) — never silently downgraded
 * (Omar's decision) — and the tenant is asked to complete the buyer's data.
 */

const VAT_RE = /^3\d{13}3$/; // 15 digits, starts + ends with 3 (ZATCA)
const CR_RE = /^\d{10}$/; // 10-digit Commercial Registration

export type BuyerFields = Pick<
  Customer,
  "customerKind" | "vatNumber" | "crNumber" | "companyNameAr" | "companyNameEn" | "name" | "nameArabic" | "address"
>;

export function isValidBuyerVat(vat: string | null | undefined): boolean {
  return typeof vat === "string" && VAT_RE.test(vat.trim());
}

/** A COMPANY buyer intends a standard B2B cleared invoice; everyone else gets a simplified one. */
export function isCompanyBuyer(c: Pick<BuyerFields, "customerKind">): boolean {
  return c.customerKind === "COMPANY";
}

function addressComplete(address: unknown): boolean {
  if (!address || typeof address !== "object") return false;
  const a = address as Record<string, unknown>;
  // The five ZATCA UBL address fields must carry real values (not rely on toZatcaAddress fallbacks).
  return ["city", "district", "streetName", "buildingNumber", "postalCode"].every(
    (k) => typeof a[k] === "string" && (a[k] as string).trim().length > 0,
  );
}

/**
 * The hard DATA GATE (D18): a STANDARD/B2B cleared invoice needs a valid VAT + CR + a buyer
 * name + a complete national address. Returns the missing field keys so the held-document
 * notification can tell the tenant exactly what to complete.
 */
export function validateBuyerForStandardClearance(c: BuyerFields): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!isValidBuyerVat(c.vatNumber)) missing.push("vatNumber");
  if (!c.crNumber || !CR_RE.test(c.crNumber.trim())) missing.push("crNumber");
  if (!(c.companyNameEn?.trim() || c.companyNameAr?.trim() || c.name?.trim())) missing.push("companyName");
  if (!addressComplete(c.address)) missing.push("address");
  return { valid: missing.length === 0, missing };
}
