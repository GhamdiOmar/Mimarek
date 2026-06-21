/**
 * @repo/zatca — Mimarek's in-house ZATCA Phase-2 (Fatoora) e-invoicing engine.
 *
 * Pure, deterministic crypto + XML + QR + network client. NO database, encryption-at-rest,
 * auth, or mutation logic — those live in the `"use server"` actions in apps/web that consume
 * this package (plan §2). Shared by Track A (SaaS billing), Track B (tenant config), and
 * Track C (tenant issuance).
 *
 * ┌─────────────────────────────────────────────────────────────────────────────────────────┐
 * │ HARD GATE (plan §5.0): NOTHING below this header beyond these TYPES ships until the P0    │
 * │ spike proves byte-identical hash / XAdES signature / QR-TLV / CSR against ZATCA's         │
 * │ official Java Fatoora SDK for all 6 document types (standard + simplified ×                │
 * │ invoice/credit/debit). The crypto/ubl/xades/qr/client/pipeline module IMPLEMENTATIONS are │
 * │ deliberately absent — they are added only after the spike is green. See README.md and     │
 * │ docs/p0-spike-recipe.md.                                                                   │
 * └─────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Planned module map (added post-spike):
 *   crypto/   secp256k1 keygen + CSR (node-forge/openssl — pinned in P0)
 *   ubl/      UBL 2.1 XML builders: invoice · credit/debit note · simplified
 *   xades/    XAdES enveloped signature + C14N + SHA-256 invoice hash (the #1 risk)
 *   qr/       QR-TLV (tags 1–9) — see ZatcaQrTagSource / D28 below
 *   client/   network client: clearance (B2B) + reporting (B2C)
 *   pipeline/ orchestration that threads the per-EGS ICV/PIH chain
 */

// ─── Engine modules (byte-matched to the Fatoora SDK; P0 gate) ────────────────
// ZATCA invoice hash (C14N 1.1 + SHA-256) — first module past the P0 gate (test/golden/standard).
export { computeInvoiceHash } from "./hash.js";
// QR-TLV codec + the deterministic tags (1–6) the EGS derives from the invoice (D28).
export { encodeQrTlv, decodeQrTlv, deterministicQrTags, type QrTlvTag } from "./qr.js";
// Certificate hash for xades:CertDigest + QR — base64(hex(sha256(base64-cert-string))).
export { computeCertHash } from "./cert.js";
// XAdES signer — produces a ZATCA-valid signed UBL invoice (gate: fatoora -validate PASS).
export { signInvoice, buildSignedProperties, type SignOptions } from "./xades.js";

// ─── Environments (plan D10) ──────────────────────────────────────────────────
export type ZatcaEnvironment = "SANDBOX" | "SIMULATION" | "PRODUCTION";

/** ZATCA document types the ENGINE produces. Non-VAT RECEIPT (plan D21) is a
 *  TenantDocument concept handled in the action layer, not by this engine. */
export type ZatcaDocumentType =
  | "TAX_INVOICE" // standard, B2B, cleared
  | "SIMPLIFIED" // B2C, reported ≤24h
  | "CREDIT_NOTE"
  | "DEBIT_NOTE";

/** The two ZATCA submission paths (plan D5). */
export type ZatcaSubmissionPath = "CLEARANCE" | "REPORTING";

// ─── QR TLV tags (plan D28) ───────────────────────────────────────────────────
/**
 * The 9 ZATCA QR-TLV tags. CRITICAL sourcing rule (D28):
 *  - SIMPLIFIED (B2C): the EGS self-generates ALL tags 1–9 at issuance.
 *  - STANDARD (B2B/cleared): tags 6–9 / the cryptographic stamp come from ZATCA's CLEARED-XML
 *    response — the EGS CANNOT self-generate tag 9 (the ZATCA cryptographic-stamp signature).
 * Final tag values per type are confirmed against the SDK in the P0 spike.
 */
export const ZatcaQrTag = {
  SellerName: 1,
  SellerVatNumber: 2,
  Timestamp: 3,
  InvoiceTotalWithVat: 4,
  VatTotal: 5,
  InvoiceXmlHash: 6,
  EcdsaSignature: 7,
  EcdsaPublicKey: 8,
  ZatcaStampSignature: 9, // standard: from ZATCA's cleared XML; never self-generated
} as const;
export type ZatcaQrTag = (typeof ZatcaQrTag)[keyof typeof ZatcaQrTag];

/** Who produced a given QR for a given document (D28) — asserted by the QR module + tests. */
export type ZatcaQrSource = "EGS_SELF_GENERATED" | "PARSED_FROM_CLEARED_XML";

// ─── Typed engine errors (plan D22) ───────────────────────────────────────────
/**
 * Discriminated error union that drives retry-vs-resubmit (D22):
 *  - `transport`  → outcome uncertain; re-POST the SAME payload (same hash/UUID/ICV). Idempotent.
 *  - `business`   → ZATCA rejected the document; correct-and-resubmit as a NEW document
 *                   (new hash/UUID/ICV/timestamp/date). The rejected doc stays invalid.
 *  - `config`     → local misconfiguration (missing/invalid CSID, key, or required field) —
 *                   never submitted.
 * Error messages MUST carry NO request payload or key material (plan D13).
 */
export type ZatcaErrorKind = "transport" | "business" | "config";

export class ZatcaError extends Error {
  readonly kind: ZatcaErrorKind;
  /** ZATCA validation/warning codes when kind === "business" (no payload echo). */
  readonly codes: readonly string[];

  constructor(kind: ZatcaErrorKind, message: string, codes: readonly string[] = []) {
    super(message);
    this.name = "ZatcaError";
    this.kind = kind;
    this.codes = codes;
  }

  /** True when D22a applies: re-POST the same payload. */
  get isRetryable(): boolean {
    return this.kind === "transport";
  }
}

// ─── Per-attempt clearance/report outcome (plan: ZatcaClearanceLog.outcome) ────
export type ZatcaClearanceOutcome =
  | "CLEARED"
  | "CLEARED_WITH_WARNINGS"
  | "REPORTED"
  | "REJECTED"
  | "TRANSPORT_ERROR";

/** Marker re-export so consumers can confirm the package resolves before the engine lands. */
export const ZATCA_ENGINE_STATUS = "P0_PENDING" as const;
