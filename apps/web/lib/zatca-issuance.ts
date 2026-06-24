import "server-only";

import {
  db,
  Prisma,
  type ZatcaClearanceOutcome,
  type ZatcaChargeType,
  type UnitType,
  type VatCategory,
  type Customer,
} from "@repo/db";
import { ZatcaError } from "@repo/zatca";
import { getNextSequenceValue } from "./sequence";
import { notifyAdmins, notifyPlatformStaff } from "./create-notification";
import { resolveZatcaEnvironment } from "./zatca-env";
import {
  getTenantEgs,
  getEgsSigningContext,
  GENESIS_PIH,
  buildSellerFromEgs,
  buildBuyerFromCustomer,
  buildTenantDocumentInput,
  parseQrFromClearedXml,
  buildInvoice,
  signInvoice,
  computeInvoiceHash,
  createZatcaClient,
} from "./zatca-server";
import { isCompanyBuyer, validateBuyerForStandardClearance } from "./buyer-routing";

/**
 * ZATCA Track C (R4) tenant issuance — the single `issueDocumentForCharge` classifier that
 * routes EVERY money movement to the right document so none silently skips, plus the
 * clearance/report engine (generalized from R2 `clearSubscriptionInvoiceInternal`) and
 * credit notes.
 *
 * SERVER-ONLY, UNGUARDED INTERNAL — every caller guards at its own call site (L26). The
 * money-movement hooks call this best-effort (try/catch); an issuance failure must NEVER
 * roll back the payment. SANDBOX-only (L25).
 *
 * Amount convention: the collected `amount` is treated as VAT-INCLUSIVE (the document total),
 * with the net + VAT back-computed so the document reconciles with the payment. The exact VAT
 * treatment + the tax-mapping defaults are an R5 external-tax-advisor item — R4a ships the
 * mechanism in sandbox, not legal-production correctness.
 */

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const DEFAULT_VAT_RATE = 0.15;
const TENANT_LINK = "/dashboard/settings/zatca";
const ADMIN_LINK = "/dashboard/admin/zatca";

export type IssuanceOutcome = ZatcaClearanceOutcome | "RECEIPT" | "HELD" | "SKIPPED";
export interface IssuanceResult {
  outcome: IssuanceOutcome;
  documentId?: string;
  codes?: string[];
}

// Discriminated charge input — one variant per money-receipt source. (Reversals route through
// createTenantCreditNote from the reverse hook; receipts/sale flows that have no payment site
// today are deferred — see the plan §3.)
export type ChargeInput =
  | { kind: "RENT_INSTALLMENT"; organizationId: string; rentInstallmentId: string; amount: number; sourceKey: string }
  | { kind: "CONTRACT_INSTALLMENT"; organizationId: string; paymentPlanInstallmentId: string; amount: number; sourceKey: string };

interface TaxClass {
  vatCategory: VatCategory;
  vatRate: number;
  eInvoiceEnabled: boolean;
}

/** No-config safe defaults (the table the R5 tax advisor signs off). */
function defaultTax(unitType: UnitType | null, chargeType: ZatcaChargeType): TaxClass {
  if (chargeType === "SALE" || chargeType === "DEPOSIT") {
    return { vatCategory: "OUT_OF_SCOPE", vatRate: 0, eInvoiceEnabled: false };
  }
  if (chargeType === "RENT" && (unitType === "APARTMENT" || unitType === "VILLA")) {
    return { vatCategory: "EXEMPT", vatRate: 0, eInvoiceEnabled: false }; // residential lease, VATEX-SA-30
  }
  return { vatCategory: "STANDARD", vatRate: DEFAULT_VAT_RATE, eInvoiceEnabled: true };
}

function lineDescription(chargeType: ZatcaChargeType): { en: string; ar: string } {
  switch (chargeType) {
    case "RENT":
      return { en: "Lease rent", ar: "إيجار" };
    case "SALE":
      return { en: "Property sale installment", ar: "قسط بيع عقار" };
    case "SERVICE_FEE":
      return { en: "Service fee", ar: "رسوم خدمات" };
    case "DEPOSIT":
      return { en: "Deposit", ar: "تأمين" };
    default:
      return { en: "Charge", ar: "رسوم" };
  }
}

function outcomeFromStatus(doc: { zatcaStatus: string; documentType: string }): IssuanceOutcome {
  if (doc.zatcaStatus === "CLEARED") return "CLEARED";
  if (doc.zatcaStatus === "REPORTED") return "REPORTED";
  if (doc.zatcaStatus === "REJECTED") return "REJECTED";
  if (doc.documentType === "RECEIPT") return "RECEIPT";
  return "SKIPPED";
}

function isP2002(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

// ─── logging + tenant alerts ──────────────────────────────────────────────────

async function writeLog(
  egsUnitId: string,
  documentId: string,
  outcome: ZatcaClearanceOutcome,
  icv: number | null,
  codes: string[],
  message: string | null,
): Promise<void> {
  await db.zatcaClearanceLog.create({
    data: { egsUnitId, documentId, outcome, icv, zatcaCodes: codes, message: message?.slice(0, 480) ?? null },
  });
}

async function alertTenant(organizationId: string, documentNumber: string, outcome: "REJECTED", codes: readonly string[]): Promise<void> {
  const codeStr = codes.length ? ` (${codes.slice(0, 4).join(", ")})` : "";
  await notifyAdmins({
    type: "ZATCA_CLEARANCE",
    title: `رفضت هيئة الزكاة والضريبة المستند ${documentNumber}`,
    titleEn: `ZATCA rejected document ${documentNumber}`,
    message: `يلزم تصحيحه وإعادة إصداره${codeStr}.`,
    messageEn: `It must be corrected and re-issued${codeStr}.`,
    link: TENANT_LINK,
    organizationId,
  });
}

async function alertHeld(organizationId: string, documentNumber: string, buyerName: string): Promise<void> {
  await notifyAdmins({
    type: "ZATCA_CLEARANCE",
    title: `الفاتورة ${documentNumber} بانتظار بيانات المشتري`,
    titleEn: `Invoice ${documentNumber} is awaiting buyer data`,
    message: `أكمل الرقم الضريبي والسجل التجاري والعنوان للعميل (${buyerName}) لإصدار فاتورة ضريبية معتمدة.`,
    messageEn: `Complete the VAT, CR and national address for ${buyerName} to issue a cleared tax invoice.`,
    link: TENANT_LINK,
    organizationId,
  });
}

/**
 * Transport-error alert (R5 — closes the gap vs the Track-A clearance path, which already
 * notified). A gateway timeout leaves the document PENDING for the reporting sweep; tell the
 * tenant it will retry, and surface it to platform staff (they own the gateway health).
 */
async function alertTransport(organizationId: string, documentNumber: string): Promise<void> {
  // Independent (allSettled) so a tenant-notify failure never drops the platform-staff alert.
  await Promise.allSettled([
    notifyAdmins({
      type: "ZATCA_CLEARANCE",
      title: `تعذّر الاتصال بهيئة الزكاة والضريبة للمستند ${documentNumber}`,
      titleEn: `ZATCA gateway unreachable for document ${documentNumber}`,
      message: "سيُعاد الإرسال تلقائيًا. لا يلزم أي إجراء.",
      messageEn: "It will be re-submitted automatically — no action needed.",
      link: TENANT_LINK,
      organizationId,
    }),
    notifyPlatformStaff({
      type: "ZATCA_CLEARANCE",
      title: `تعذّر الاتصال ببوابة هيئة الزكاة والضريبة (${documentNumber})`,
      titleEn: `ZATCA gateway transport error (${documentNumber})`,
      message: "مستند مستأجر بقي قيد المعالجة بسبب خطأ في الاتصال — راجع صحة البوابة.",
      messageEn: "A tenant document is pending due to a gateway transport error — check gateway health.",
      link: ADMIN_LINK,
    }),
  ]);
}

// ─── clearance / report engine (generalized from R2) ──────────────────────────

/**
 * Clear (B2B standard) or report (B2C simplified) one TenantDocument through the tenant's own
 * EGS. `isRetry` re-POSTs the SAME stored payload (D22a transport-retry, idempotent). Receipts
 * never reach here (D21). UNGUARDED — the caller guards (L26).
 */
export async function clearTenantDocumentInternal(documentId: string, opts?: { isRetry?: boolean }): Promise<IssuanceResult> {
  const doc = await db.tenantDocument.findUnique({
    where: { id: documentId },
    include: { lineItems: { orderBy: { sortOrder: "asc" } } },
  });
  if (!doc) throw new Error("Tenant document not found for clearance.");
  if (doc.documentType === "RECEIPT") return { outcome: "RECEIPT", documentId };
  if (doc.zatcaStatus === "CLEARED") return { outcome: "CLEARED", documentId };
  if (doc.zatcaStatus === "REPORTED") return { outcome: "REPORTED", documentId };

  const egs = await db.zatcaEgsUnit.findUnique({ where: { id: doc.egsUnitId } });
  if (!egs) return { outcome: "SKIPPED", documentId };

  const isCredit = doc.documentType === "CREDIT_NOTE";
  // B2C simplified docs report; B2B standard clear. A credit note inherits its original's mode.
  let simplified = doc.documentType === "SIMPLIFIED";
  let billingRef: string | undefined;
  if (isCredit && doc.originalDocumentId) {
    const orig = await db.tenantDocument.findUnique({
      where: { id: doc.originalDocumentId },
      select: { documentType: true, zatcaStatus: true, documentNumber: true },
    });
    simplified = orig?.documentType === "SIMPLIFIED" || orig?.zatcaStatus === "REPORTED";
    billingRef = orig?.documentNumber;
  }

  const ctx = getEgsSigningContext(egs);
  // Class A: report/clear against the environment this tenant EGS was ONBOARDED under
  // (egs.environment), never the resolver — a sandbox EGS must not hit a prod gateway (R5).
  const client = createZatcaClient({ environment: egs.environment });

  let signed: string;
  let invoiceHash: string;
  let icvUsed: number | null;

  if (opts?.isRetry && doc.xmlContent && doc.zatcaHash) {
    signed = doc.xmlContent;
    invoiceHash = doc.zatcaHash;
    icvUsed = null;
  } else {
    const lines =
      doc.lineItems.length > 0
        ? doc.lineItems.map((l) => ({
            name: l.description,
            quantity: l.quantity,
            unitPrice: Number(l.unitPrice),
            vatPercent: round2(Number(l.vatRate) * 100),
          }))
        : [{ name: "Charge", quantity: 1, unitPrice: Number(doc.subtotal), vatPercent: DEFAULT_VAT_RATE * 100 }];

    // H1: hold the EGS-row lock across reserve → sign → chain-advance → persist (mirror R2).
    const reserved = await db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ lastIcv: number; lastInvoiceHash: string | null }[]>`
        SELECT "lastIcv", "lastInvoiceHash" FROM "ZatcaEgsUnit" WHERE "id" = ${egs.id} FOR UPDATE`;
      const r = rows[0];
      if (!r) throw new Error("EGS not found while reserving the ICV.");
      const icv = r.lastIcv + 1;
      const pih = r.lastInvoiceHash ?? GENESIS_PIH;
      const input = buildTenantDocumentInput({
        doc,
        seller: buildSellerFromEgs(egs),
        lines,
        icv,
        pih,
        simplified,
        docType: isCredit ? "credit-note" : "invoice",
        billingReferenceId: billingRef,
        reason: isCredit ? doc.notes ?? "Adjustment" : undefined,
      });
      const s = signInvoice(buildInvoice(input), { privateKeyPem: ctx.privateKeyPem, certificateBase64: ctx.certificateBase64 });
      const hash = computeInvoiceHash(s);
      // Simplified: tag 9 (the QR) is self-generated INSIDE the signed doc (D28) — extract it now.
      const selfQr = simplified ? parseQrFromClearedXml(Buffer.from(s, "utf8").toString("base64")) : null;
      await tx.$executeRaw`
        UPDATE "ZatcaEgsUnit" SET "lastIcv" = ${icv}, "lastInvoiceHash" = ${hash}, "updatedAt" = now() WHERE "id" = ${egs.id}`;
      await tx.tenantDocument.update({
        where: { id: documentId },
        data: { zatcaStatus: "PENDING", zatcaHash: hash, xmlContent: s, zatcaQrCode: selfQr, zatcaSubmittedAt: new Date() },
      });
      return { icv, signed: s, invoiceHash: hash };
    });
    icvUsed = reserved.icv;
    signed = reserved.signed;
    invoiceHash = reserved.invoiceHash;
  }

  const payload = { invoiceHash, uuid: doc.uuid, invoiceXmlBase64: Buffer.from(signed, "utf8").toString("base64") };

  try {
    const res = simplified
      ? await client.reportInvoice({ credentials: ctx.credentials, payload })
      : egs.productionToken
        ? await client.clearInvoice({ credentials: ctx.credentials, payload })
        : await client.checkComplianceInvoice({ credentials: ctx.credentials, payload });

    const lifecycle = res.outcome === "REPORTED" ? "REPORTED" : "CLEARED";
    const qr = res.clearedInvoiceBase64 ? parseQrFromClearedXml(res.clearedInvoiceBase64) : null;
    await db.tenantDocument.update({
      where: { id: documentId },
      data: {
        zatcaStatus: lifecycle,
        status: "ISSUED",
        clearedXml: res.clearedInvoiceBase64 ?? null,
        zatcaClearedAt: new Date(),
        ...(qr ? { zatcaQrCode: qr } : {}),
      },
    });
    await writeLog(egs.id, documentId, res.outcome, icvUsed, [], null);
    return { outcome: res.outcome, documentId };
  } catch (e) {
    if (e instanceof ZatcaError) {
      if (e.kind === "business") {
        await db.tenantDocument.update({ where: { id: documentId }, data: { zatcaStatus: "REJECTED" } });
        await writeLog(egs.id, documentId, "REJECTED", icvUsed, [...e.codes], e.message);
        // Best-effort: a notification failure must never mask the persisted REJECTED outcome.
        await alertTenant(doc.organizationId, doc.documentNumber, "REJECTED", e.codes).catch(() => {});
        return { outcome: "REJECTED", documentId, codes: [...e.codes] };
      }
      if (e.kind === "transport") {
        await db.tenantDocument.update({ where: { id: documentId }, data: { zatcaStatus: "PENDING" } });
        await writeLog(egs.id, documentId, "TRANSPORT_ERROR", icvUsed, [], "gateway transport error");
        // Best-effort: a notification failure must never mask the persisted TRANSPORT_ERROR outcome.
        await alertTransport(doc.organizationId, doc.documentNumber).catch(() => {});
        return { outcome: "TRANSPORT_ERROR", documentId };
      }
      throw e; // config — local misconfiguration; surface to the caller
    }
    throw e;
  }
}

// ─── the classifier ───────────────────────────────────────────────────────────

type ChargeContext = {
  unitType: UnitType | null;
  customer: Customer | null;
  chargeType: ZatcaChargeType;
  rentInstallmentId: string | null;
  paymentPlanInstallmentId: string | null;
};

/**
 * Route EVERY money movement to the correct document so none silently skips (the headline R4
 * guarantee). Returns SKIPPED when the org has no tenant EGS (not ZATCA-enabled) or the source
 * row is missing / cross-org. UNGUARDED — the caller guards (L26).
 */
export async function issueDocumentForCharge(charge: ChargeInput): Promise<IssuanceResult> {
  const organizationId = charge.organizationId;

  // 1. Load context + re-assert org ownership (cross-org isolation).
  let cx: ChargeContext;
  if (charge.kind === "RENT_INSTALLMENT") {
    const inst = await db.rentInstallment.findUnique({
      where: { id: charge.rentInstallmentId },
      include: { lease: { include: { unit: true, customer: true } } },
    });
    if (!inst || inst.lease.organizationId !== organizationId) return { outcome: "SKIPPED" };
    cx = {
      unitType: inst.lease.unit?.type ?? null,
      customer: inst.lease.customer ?? null,
      chargeType: "RENT",
      rentInstallmentId: inst.id,
      paymentPlanInstallmentId: null,
    };
  } else {
    const inst = await db.paymentPlanInstallment.findUnique({
      where: { id: charge.paymentPlanInstallmentId },
      include: { paymentPlan: { include: { contract: { include: { unit: true, customer: true } } } } },
    });
    if (!inst || inst.organizationId !== organizationId) return { outcome: "SKIPPED" };
    const contract = inst.paymentPlan.contract;
    cx = {
      unitType: contract.unit?.type ?? null,
      customer: contract.customer ?? null,
      chargeType: contract.type === "SALE" ? "SALE" : "RENT",
      rentInstallmentId: null,
      paymentPlanInstallmentId: inst.id,
    };
  }

  // 2. The tenant's own EGS is required (numbering + signing). No EGS → not ZATCA-enabled yet.
  //    Resolve the target env for a NEW issuance (fail-safe SANDBOX, R5); existing docs re-clear
  //    against egs.environment inside clearTenantDocumentInternal.
  const egs = await getTenantEgs(organizationId, resolveZatcaEnvironment());
  if (!egs) return { outcome: "SKIPPED" };

  // 3. Tax classification — most-specific OrgZatcaTaxConfig match, else the safe defaults.
  const cfg = await db.orgZatcaTaxConfig.findFirst({
    where: {
      organizationId,
      isActive: true,
      AND: [
        { OR: [{ unitType: cx.unitType }, { unitType: null }] },
        { OR: [{ chargeType: cx.chargeType }, { chargeType: null }] },
      ],
    },
    orderBy: [
      { unitType: { sort: "desc", nulls: "last" } },
      { chargeType: { sort: "desc", nulls: "last" } },
    ],
  });
  const tax: TaxClass = cfg
    ? { vatCategory: cfg.vatCategory, vatRate: cfg.vatRate ? Number(cfg.vatRate) : DEFAULT_VAT_RATE, eInvoiceEnabled: cfg.eInvoiceEnabled }
    : defaultTax(cx.unitType, cx.chargeType);

  // 4. Idempotency pre-check (the §1.6 partial-unique seam handles races).
  const idemWhere: Prisma.TenantDocumentWhereInput =
    charge.kind === "RENT_INSTALLMENT"
      ? { organizationId, rentInstallmentId: charge.rentInstallmentId, sourceKey: charge.sourceKey, documentType: { not: "CREDIT_NOTE" } }
      : { organizationId, paymentPlanInstallmentId: charge.paymentPlanInstallmentId, sourceKey: charge.sourceKey, documentType: { not: "CREDIT_NOTE" } };
  const existing = await db.tenantDocument.findFirst({ where: idemWhere });
  if (existing) return { outcome: outcomeFromStatus(existing), documentId: existing.id };

  // 5. Buyer snapshot (immutable at issuance).
  const buyerParty = cx.customer ? buildBuyerFromCustomer(cx.customer) : null;

  // 6. Route: RECEIPT (exempt / out-of-scope / disabled) | TAX_INVOICE (B2B) | SIMPLIFIED (B2C) | HELD.
  const isReceipt = tax.vatCategory === "EXEMPT" || tax.vatCategory === "OUT_OF_SCOPE" || !tax.eInvoiceEnabled;
  let documentType: "RECEIPT" | "TAX_INVOICE" | "SIMPLIFIED" = "RECEIPT";
  let needsBuyerData = false;
  if (!isReceipt) {
    if (cx.customer && isCompanyBuyer(cx.customer)) {
      const gate = validateBuyerForStandardClearance(cx.customer);
      documentType = "TAX_INVOICE";
      needsBuyerData = !gate.valid; // held: a B2B company missing VAT/CR/address (Omar's decision)
    } else {
      documentType = "SIMPLIFIED"; // B2C
    }
  }

  // 7. Amounts (VAT-inclusive — net back-computed so the doc reconciles with the payment).
  const gross = round2(charge.amount);
  const isTaxable = documentType === "TAX_INVOICE" || documentType === "SIMPLIFIED";
  const vatRate = isTaxable ? tax.vatRate : 0;
  const subtotal = isTaxable ? round2(gross / (1 + vatRate)) : gross;
  const vatAmount = isTaxable ? round2(gross - subtotal) : 0;
  const total = round2(subtotal + vatAmount);

  // 8. Create the document (per-EGS number; idempotent; single line).
  const year = new Date().getFullYear();
  const prefix = documentType === "RECEIPT" ? "REC" : "INV";
  const desc = lineDescription(cx.chargeType);
  let doc;
  try {
    doc = await db.$transaction(async (tx) => {
      const seq = await getNextSequenceValue(tx, `egs:${egs.id}`, "TENANT_DOCUMENT", year);
      return tx.tenantDocument.create({
        data: {
          organizationId,
          egsUnitId: egs.id,
          documentNumber: `${prefix}-${year}-${String(seq).padStart(5, "0")}`,
          documentType,
          kind: charge.kind,
          chargeType: cx.chargeType,
          rentInstallmentId: cx.rentInstallmentId,
          paymentPlanInstallmentId: cx.paymentPlanInstallmentId,
          sourceKey: charge.sourceKey,
          customerId: cx.customer?.id ?? null,
          buyerName: buyerParty?.registrationName ?? null,
          buyerNameAr: cx.customer?.nameArabic ?? null,
          buyerVatNumber: buyerParty?.vatNumber ?? null,
          buyerCrNumber: buyerParty?.crn ?? null,
          buyerAddress: (cx.customer?.address ?? undefined) as Prisma.InputJsonValue | undefined,
          unitType: cx.unitType,
          subtotal,
          vatCategory: tax.vatCategory,
          vatRate,
          vatAmount,
          discountAmount: 0,
          total,
          status: needsBuyerData ? "DRAFT" : "ISSUED",
          zatcaStatus: "NOT_APPLICABLE",
          needsBuyerData,
          lineItems: {
            create: [{ description: desc.en, descriptionAr: desc.ar, quantity: 1, unitPrice: subtotal, vatRate, vatAmount, total }],
          },
        },
      });
    });
  } catch (e) {
    if (isP2002(e)) {
      const dup = await db.tenantDocument.findFirst({ where: idemWhere });
      if (dup) return { outcome: outcomeFromStatus(dup), documentId: dup.id };
    }
    throw e;
  }

  // 9. Held / receipt → never reach the engine.
  if (needsBuyerData) {
    await alertHeld(organizationId, doc.documentNumber, buyerParty?.registrationName ?? "the buyer");
    return { outcome: "HELD", documentId: doc.id };
  }
  if (documentType === "RECEIPT") return { outcome: "RECEIPT", documentId: doc.id };

  // 10. Taxable → clear (B2B) or report (B2C), best-effort.
  return clearTenantDocumentInternal(doc.id);
}

// ─── HELD re-issue (R4b) ──────────────────────────────────────────────────────

/**
 * Re-issue a HELD document — a B2B company invoice whose buyer VAT/CR/address was incomplete at
 * issuance and has since been completed on the Customer. Re-snapshots the buyer from the live
 * Customer, re-validates, and on success clears `needsBuyerData` + submits via the engine.
 * UNGUARDED (L26) — the tenant action guards + re-checks org ownership. Returns the still-missing
 * fields when the buyer remains incomplete (the document stays HELD, no submission).
 */
export async function reissueHeldDocumentInternal(
  documentId: string,
): Promise<IssuanceResult & { missing?: string[] }> {
  const doc = await db.tenantDocument.findUnique({
    where: { id: documentId },
    include: { customer: true },
  });
  if (!doc) throw new Error("Tenant document not found for re-issue.");
  if (!doc.needsBuyerData) {
    // Already released — just (re)submit if it is still pending.
    return clearTenantDocumentInternal(documentId);
  }

  const customer = doc.customer;
  if (!customer) return { outcome: "HELD", documentId, missing: ["customer"] };

  const gate = validateBuyerForStandardClearance(customer);
  if (!gate.valid) return { outcome: "HELD", documentId, missing: gate.missing };

  const buyer = buildBuyerFromCustomer(customer);
  await db.tenantDocument.update({
    where: { id: documentId },
    data: {
      needsBuyerData: false,
      status: "ISSUED",
      buyerName: buyer.registrationName,
      buyerNameAr: customer.nameArabic ?? null,
      buyerVatNumber: buyer.vatNumber ?? null,
      buyerCrNumber: buyer.crn ?? null,
      buyerAddress: (customer.address ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });

  return clearTenantDocumentInternal(documentId);
}

// ─── credit notes (D11 / D22b / L23) ──────────────────────────────────────────

/**
 * Issue a credit note against a CLEARED/REPORTED tenant document (e.g. a rent reversal), then
 * clear/report it. Money fields are copied VERBATIM POSITIVE (type 381, no sign-flip — L23).
 * If the original is a receipt or not yet cleared, there is nothing to credit in ZATCA → SKIPPED.
 */
export async function createTenantCreditNote(originalDocumentId: string, reason: string): Promise<IssuanceResult> {
  const original = await db.tenantDocument.findUnique({
    where: { id: originalDocumentId },
    include: { lineItems: { orderBy: { sortOrder: "asc" } } },
  });
  if (!original) throw new Error("Original document not found.");
  if (original.documentType === "RECEIPT" || (original.zatcaStatus !== "CLEARED" && original.zatcaStatus !== "REPORTED")) {
    return { outcome: "SKIPPED" }; // nothing to credit in ZATCA yet
  }
  const egs = await db.zatcaEgsUnit.findUnique({ where: { id: original.egsUnitId } });
  if (!egs) return { outcome: "SKIPPED" };

  // Idempotency (H1): one credit note per original document — never double-credit. The
  // tenant_document_cn_idem partial-unique index backs this against races (P2002 → re-fetch).
  const existingCn = await db.tenantDocument.findFirst({
    where: { originalDocumentId: original.id, documentType: "CREDIT_NOTE" },
  });
  if (existingCn) return { outcome: outcomeFromStatus(existingCn), documentId: existingCn.id };

  const year = new Date().getFullYear();
  let note;
  try {
    note = await db.$transaction(async (tx) => {
    const seq = await getNextSequenceValue(tx, `egs:${egs.id}`, "TENANT_DOCUMENT", year);
    return tx.tenantDocument.create({
      data: {
        organizationId: original.organizationId,
        egsUnitId: original.egsUnitId,
        documentNumber: `CN-${year}-${String(seq).padStart(5, "0")}`,
        documentType: "CREDIT_NOTE",
        kind: "CREDIT_NOTE",
        chargeType: original.chargeType,
        originalDocumentId: original.id,
        customerId: original.customerId,
        buyerName: original.buyerName,
        buyerNameAr: original.buyerNameAr,
        buyerVatNumber: original.buyerVatNumber,
        buyerCrNumber: original.buyerCrNumber,
        buyerAddress: (original.buyerAddress ?? undefined) as Prisma.InputJsonValue | undefined,
        unitType: original.unitType,
        // L23 — verbatim POSITIVE amounts (ZATCA expects positive credit-note amounts + type 381).
        subtotal: original.subtotal,
        vatCategory: original.vatCategory,
        vatRate: original.vatRate,
        vatAmount: original.vatAmount,
        discountAmount: original.discountAmount,
        total: original.total,
        status: "ISSUED",
        zatcaStatus: "NOT_APPLICABLE",
        notes: reason.slice(0, 480),
        lineItems: {
          create: original.lineItems.map((l) => ({
            description: l.description,
            descriptionAr: l.descriptionAr,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            vatRate: l.vatRate,
            vatAmount: l.vatAmount,
            total: l.total,
            sortOrder: l.sortOrder,
          })),
        },
      },
    });
    });
  } catch (e) {
    if (isP2002(e)) {
      const dup = await db.tenantDocument.findFirst({
        where: { originalDocumentId: original.id, documentType: "CREDIT_NOTE" },
      });
      if (dup) return { outcome: outcomeFromStatus(dup), documentId: dup.id };
    }
    throw e;
  }

  return clearTenantDocumentInternal(note.id);
}

/**
 * A rent reversal/refund → credit note. Finds the installment's original CLEARED/REPORTED
 * document and credits it. If there is none (the original was a receipt or never cleared),
 * there is nothing to credit in ZATCA → SKIPPED.
 */
export async function issueCreditNoteForRentReversal(
  organizationId: string,
  rentInstallmentId: string,
  reason: string,
): Promise<IssuanceResult> {
  const original = await db.tenantDocument.findFirst({
    where: {
      organizationId,
      rentInstallmentId,
      documentType: { not: "CREDIT_NOTE" },
      zatcaStatus: { in: ["CLEARED", "REPORTED"] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!original) return { outcome: "SKIPPED" };
  return createTenantCreditNote(original.id, reason);
}

// ─── best-effort wrappers for the money-movement hooks ────────────────────────
// These NEVER throw — a ZATCA issuance failure must not roll back the payment (L26 +
// the billing.ts best-effort precedent). The money movement already committed; issuance
// is a follow-on side effect. Failures are logged (no key material) and swept later (R4b).

export async function issueForChargeBestEffort(charge: ChargeInput): Promise<void> {
  try {
    await issueDocumentForCharge(charge);
  } catch (e) {
    console.error("[zatca] issuance failed (non-blocking)", charge.kind, e instanceof Error ? e.message : String(e));
  }
}

export async function issueCreditNoteForRentReversalBestEffort(
  organizationId: string,
  rentInstallmentId: string,
  reason: string,
): Promise<void> {
  try {
    await issueCreditNoteForRentReversal(organizationId, rentInstallmentId, reason);
  } catch (e) {
    console.error("[zatca] reversal credit-note failed (non-blocking)", e instanceof Error ? e.message : String(e));
  }
}
