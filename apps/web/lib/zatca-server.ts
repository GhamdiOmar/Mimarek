import "server-only";

import { db, type Prisma, type ZatcaEgsUnit, type Invoice, type Organization } from "@repo/db";
import {
  buildInvoice,
  signInvoice,
  computeInvoiceHash,
  createZatcaClient,
  decodeQrTlv,
  type ZatcaInvoiceInput,
  type ZatcaParty,
  type ZatcaAddress,
  type ZatcaEnvironment,
  type ZatcaCredentials,
} from "@repo/zatca";
import { decryptZatca } from "./zatca-crypto";

/**
 * Server-only ZATCA helpers shared by the onboarding + clearance actions (Track A).
 * NEVER returns decrypted secrets to a client — the encrypted EGS columns are only
 * read internally here; every client-facing DTO uses {@link EGS_PUBLIC_SELECT}.
 */

// ZATCA genesis PIH (base64 of the hex SHA-256 of "0") — the seed for the first document.
export const GENESIS_PIH =
  "NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==";

/**
 * Prisma `select` allowlist for any EGS data returned to the client (D13). It
 * EXCLUDES every secret column (privateKeyPem, csrPem, compliance/production
 * token+secret, certificateBase64). Use this in actions that serialize an EGS.
 */
export const EGS_PUBLIC_SELECT = {
  id: true,
  organizationId: true,
  environment: true,
  status: true,
  egsSerialNumber: true,
  commonName: true,
  vatNumber: true,
  crNumber: true,
  legalNameAr: true,
  legalNameEn: true,
  invoiceTypeFlags: true,
  industryCategory: true,
  lastIcv: true,
  onboardedAt: true,
  revokedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ZatcaEgsUnitSelect;

/** The single active platform-seller EGS (Mimarek SaaS billing) for an environment. */
export async function getActivePlatformEgs(
  environment: ZatcaEnvironment = "SANDBOX",
): Promise<ZatcaEgsUnit | null> {
  return db.zatcaEgsUnit.findFirst({
    where: { organizationId: null, environment, status: "ACTIVE" },
  });
}

/** Any platform EGS row for an environment (regardless of status) — for the admin summary. */
export async function getPlatformEgs(environment: ZatcaEnvironment = "SANDBOX"): Promise<ZatcaEgsUnit | null> {
  return db.zatcaEgsUnit.findFirst({ where: { organizationId: null, environment } });
}

/** Decrypted production (or compliance-fallback) credentials + signing material for an EGS. */
export interface EgsSigningContext {
  credentials: ZatcaCredentials;
  privateKeyPem: string;
  certificateBase64: string;
}

/**
 * Decrypt the EGS signing material. Prefers the PRODUCTION CSID (clearance/reporting);
 * falls back to the COMPLIANCE CSID (compliance-invoice checks) when production isn't issued.
 * Throws if the EGS has no usable credentials.
 */
export function getEgsSigningContext(egs: ZatcaEgsUnit): EgsSigningContext {
  if (!egs.privateKeyPem) throw new Error("EGS has no private key — onboarding incomplete.");
  const privateKeyPem = decryptZatca(egs.privateKeyPem);

  // The CSID cert (base64-DER string) the signer embeds. binarySecurityToken from the
  // CSID response is base64(base64-DER), so the signer's certificateBase64 = decoded once.
  const tokenEnc = egs.productionToken ?? egs.complianceToken;
  const secretEnc = egs.productionSecret ?? egs.complianceSecret;
  if (!tokenEnc || !secretEnc) throw new Error("EGS has no CSID credentials — onboarding incomplete.");
  const binarySecurityToken = decryptZatca(tokenEnc);
  const secret = decryptZatca(secretEnc);

  const certificateBase64 = egs.certificateBase64
    ? decryptZatca(egs.certificateBase64)
    : Buffer.from(binarySecurityToken, "base64").toString("utf8");

  return { credentials: { binarySecurityToken, secret }, privateKeyPem, certificateBase64 };
}

// NOTE: ICV/PIH reservation + chain advance are done INSIDE a single `$transaction`
// with `SELECT … FOR UPDATE` on the EGS row in lib/zatca-clearance.ts, so the reserve
// (read PIH) and the advance (write the new hash) are atomic w.r.t. concurrent
// clearances and the chain cannot fork (H1). A two-step UPDATE..RETURNING then a
// separate hash-commit was racy and was removed.

// ─── Address / party mapping ──────────────────────────────────────────────────

type AddressJson = Record<string, unknown> | null | undefined;

function s(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

/** Map a stored national-address JSON to a ZATCA UBL address (ZATCA-valid fallbacks). */
export function toZatcaAddress(addr: AddressJson): ZatcaAddress {
  const a = (addr ?? {}) as Record<string, unknown>;
  return {
    street: s(a.streetName ?? a.street, "Olaya"),
    building: s(a.buildingNumber ?? a.building, "0000"),
    citySubdivision: s(a.district ?? a.citySubdivision, "Al Olaya"),
    city: s(a.city, "Riyadh"),
    postalZone: s(a.postalCode ?? a.postalZone, "00000"),
  };
}

/** Seller party = the EGS's own tax identity (Mimarek PropTech Co. for the platform EGS). */
export function buildSellerFromEgs(egs: ZatcaEgsUnit): ZatcaParty {
  return {
    registrationName: egs.legalNameEn ?? egs.legalNameAr ?? egs.commonName,
    vatNumber: egs.vatNumber,
    crn: egs.crNumber ?? undefined,
    address: toZatcaAddress(egs.nationalAddress as AddressJson),
  };
}

/** Buyer party = the billed tenant organization. */
export function buildBuyerFromOrg(org: Pick<Organization, "name" | "vatNumber" | "crNumber" | "nationalAddress">): ZatcaParty {
  return {
    registrationName: org.name,
    vatNumber: org.vatNumber ?? undefined,
    crn: org.crNumber ?? undefined,
    address: toZatcaAddress(org.nationalAddress as AddressJson),
  };
}

// ─── Invoice → engine input ───────────────────────────────────────────────────

function nowParts(): { issueDate: string; issueTime: string } {
  const iso = new Date().toISOString(); // deterministic-enough for sandbox; UTC
  return { issueDate: iso.slice(0, 10), issueTime: iso.slice(11, 19) };
}

/**
 * Build the engine input for a Track-A SaaS invoice. The single line uses the NET
 * (post-discount) amount so the cleared document reconciles with the Invoice header
 * regardless of any coupon (the discount is a taxable-base allowance; VAT is on net).
 */
export function buildSubscriptionInvoiceInput(args: {
  invoice: Pick<Invoice, "uuid" | "subtotal" | "discountAmount" | "documentType" | "invoiceNumber">;
  seller: ZatcaParty;
  buyer: ZatcaParty;
  icv: number;
  pih: string;
  lineName: string;
  docType?: "invoice" | "credit-note" | "debit-note";
  billingReferenceId?: string;
  reason?: string;
}): ZatcaInvoiceInput {
  const { issueDate, issueTime } = nowParts();
  const net = Number(args.invoice.subtotal) - Number(args.invoice.discountAmount ?? 0);
  return {
    id: args.invoice.invoiceNumber,
    uuid: args.invoice.uuid,
    issueDate,
    issueTime,
    docType: args.docType ?? "invoice",
    icv: args.icv,
    pih: args.pih,
    seller: args.seller,
    buyer: args.buyer,
    lines: [{ name: args.lineName, quantity: 1, unitPrice: Math.max(net, 0), vatPercent: 15 }],
    billingReferenceId: args.billingReferenceId,
    reason: args.reason,
  };
}

// ─── Cleared-XML QR extraction (D28) ──────────────────────────────────────────

/**
 * Parse the QR TLV out of ZATCA's cleared XML (standard/clearance). The EGS cannot
 * self-generate tag 9 (the ZATCA cryptographic stamp); for standard invoices the
 * canonical QR is the one inside the cleared document's
 * `<cac:AdditionalDocumentReference><cbc:ID>QR</cbc:ID>…<cbc:EmbeddedDocumentBinaryObject>`.
 * Returns the base64 QR string, or null if not found.
 */
export function parseQrFromClearedXml(clearedXmlBase64: string): string | null {
  let xml: string;
  try {
    xml = Buffer.from(clearedXmlBase64, "base64").toString("utf8");
  } catch {
    return null;
  }
  const m = xml.match(/<cbc:ID>QR<\/cbc:ID>[\s\S]*?<cbc:EmbeddedDocumentBinaryObject[^>]*>([^<]+)</);
  const qr = m?.[1]?.trim();
  if (!qr) return null;
  // Sanity-check it is decodable TLV; return as-is on success.
  try {
    decodeQrTlv(qr);
    return qr;
  } catch {
    return qr; // still return the raw value — decode is a best-effort guard only
  }
}

// Re-export the engine pieces the actions need, so callers import from one module.
export { buildInvoice, signInvoice, computeInvoiceHash, createZatcaClient };
