import "server-only";

import { db, type ZatcaClearanceOutcome } from "@repo/db";
import { ZatcaError } from "@repo/zatca";
import { getNextSequenceValue, GLOBAL_SEQUENCE_SCOPE } from "./sequence";
import { notifyPlatformStaff } from "./create-notification";
import {
  getActivePlatformEgs,
  getEgsSigningContext,
  GENESIS_PIH,
  buildSellerFromEgs,
  buildBuyerFromOrg,
  buildSubscriptionInvoiceInput,
  parseQrFromClearedXml,
  buildInvoice,
  signInvoice,
  computeInvoiceHash,
  createZatcaClient,
} from "./zatca-server";

/**
 * Core Track-A clearance orchestration (server-only, UNGUARDED — every caller guards).
 * Called by the billing post-commit hook (best-effort) and the admin retry/credit-note
 * actions. Owns: ICV/PIH reserve → build → sign → hash(signed) → submit → record + log.
 */

export interface ClearanceResult {
  outcome: ZatcaClearanceOutcome | "SKIPPED";
  codes?: string[];
}

const ADMIN_LINK = "/dashboard/admin/zatca";

async function writeLog(
  egsUnitId: string,
  invoiceId: string,
  outcome: ZatcaClearanceOutcome,
  icv: number | null,
  codes: string[],
  message: string | null,
): Promise<void> {
  await db.zatcaClearanceLog.create({
    data: { egsUnitId, invoiceId, outcome, icv, zatcaCodes: codes, message: message?.slice(0, 480) ?? null },
  });
}

async function alertRejected(invoiceNumber: string, codes: readonly string[]): Promise<void> {
  const codeStr = codes.length ? ` (${codes.slice(0, 4).join(", ")})` : "";
  await notifyPlatformStaff({
    type: "ZATCA_CLEARANCE",
    title: `رفضت هيئة الزكاة والضريبة الفاتورة ${invoiceNumber}`,
    titleEn: `ZATCA rejected invoice ${invoiceNumber}`,
    message: `يلزم تصحيحها وإعادة إصدارها${codeStr}.`,
    messageEn: `It must be corrected and re-issued${codeStr}.`,
    link: ADMIN_LINK,
  });
}

async function alertTransport(invoiceNumber: string): Promise<void> {
  await notifyPlatformStaff({
    type: "ZATCA_CLEARANCE",
    title: `تعذّر الوصول لهيئة الزكاة والضريبة للفاتورة ${invoiceNumber}`,
    titleEn: `ZATCA gateway unreachable for invoice ${invoiceNumber}`,
    message: "سيُعاد المحاولة بنفس البيانات.",
    messageEn: "It can be retried with the same payload.",
    link: ADMIN_LINK,
  });
}

/**
 * Clear (or re-clear) one SaaS Invoice through the platform EGS. `isRetry` re-POSTs the
 * SAME stored payload (D22a transport-retry, idempotent) without reserving a new ICV.
 */
export async function clearSubscriptionInvoiceInternal(
  invoiceId: string,
  opts?: { isRetry?: boolean },
): Promise<ClearanceResult> {
  const egs = await getActivePlatformEgs("SANDBOX");
  if (!egs) return { outcome: "SKIPPED" }; // no platform EGS onboarded → nothing to do

  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      organization: true,
      subscription: { include: { plan: true } },
      originalInvoice: { select: { invoiceNumber: true } },
    },
  });
  if (!invoice) throw new Error("Invoice not found for clearance.");
  if (invoice.zatcaStatus === "CLEARED") return { outcome: "CLEARED" };
  if (invoice.zatcaStatus === "REPORTED") return { outcome: "REPORTED" };

  const ctx = getEgsSigningContext(egs);
  const client = createZatcaClient({ environment: "SANDBOX" });

  let signed: string;
  let invoiceHash: string;
  let icvUsed: number | null;

  if (opts?.isRetry && invoice.xmlContent && invoice.zatcaHash) {
    // Re-POST the exact stored bytes — same hash / uuid / ICV (idempotent).
    signed = invoice.xmlContent;
    invoiceHash = invoice.zatcaHash;
    icvUsed = null;
  } else {
    const planName = invoice.subscription?.plan?.nameEn ?? "Subscription";
    const isCredit = invoice.documentType === "CREDIT_NOTE";
    // H1: hold the EGS row lock across reserve → sign → chain-advance → persist so two
    // concurrent clearances on the same EGS cannot read the same PIH and fork the hash
    // chain. The lock spans only the (CPU-bound, ms-scale) build+sign — NOT the HTTP submit.
    const reserved = await db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ lastIcv: number; lastInvoiceHash: string | null }[]>`
        SELECT "lastIcv", "lastInvoiceHash" FROM "ZatcaEgsUnit" WHERE "id" = ${egs.id} FOR UPDATE`;
      const r = rows[0];
      if (!r) throw new Error("EGS not found while reserving the ICV.");
      const icv = r.lastIcv + 1;
      const pih = r.lastInvoiceHash ?? GENESIS_PIH;
      const input = buildSubscriptionInvoiceInput({
        invoice,
        seller: buildSellerFromEgs(egs),
        buyer: buildBuyerFromOrg(invoice.organization),
        icv,
        pih,
        lineName: `${planName} — ${invoice.billingCycle ?? "subscription"}`,
        docType: isCredit ? "credit-note" : "invoice",
        billingReferenceId: isCredit ? invoice.originalInvoice?.invoiceNumber : undefined,
        reason: isCredit ? invoice.notes ?? "Adjustment" : undefined,
      });
      const s = signInvoice(buildInvoice(input), {
        privateKeyPem: ctx.privateKeyPem,
        certificateBase64: ctx.certificateBase64,
      });
      const hash = computeInvoiceHash(s);
      await tx.$executeRaw`
        UPDATE "ZatcaEgsUnit" SET "lastIcv" = ${icv}, "lastInvoiceHash" = ${hash}, "updatedAt" = now()
         WHERE "id" = ${egs.id}`;
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { zatcaStatus: "PENDING", zatcaHash: hash, xmlContent: s, zatcaSubmittedAt: new Date() },
      });
      return { icv, signed: s, invoiceHash: hash };
    });
    icvUsed = reserved.icv;
    signed = reserved.signed;
    invoiceHash = reserved.invoiceHash;
  }

  const payload = { invoiceHash, uuid: invoice.uuid, invoiceXmlBase64: Buffer.from(signed, "utf8").toString("base64") };

  try {
    const res = egs.productionToken
      ? await client.clearInvoice({ credentials: ctx.credentials, payload })
      : await client.checkComplianceInvoice({ credentials: ctx.credentials, payload });

    const lifecycle = res.outcome === "REPORTED" ? "REPORTED" : "CLEARED";
    const qr = res.clearedInvoiceBase64 ? parseQrFromClearedXml(res.clearedInvoiceBase64) : null;
    await db.invoice.update({
      where: { id: invoiceId },
      data: {
        zatcaStatus: lifecycle,
        zatcaQrCode: qr,
        clearedXml: res.clearedInvoiceBase64 ?? null,
        zatcaClearedAt: new Date(),
      },
    });
    await writeLog(egs.id, invoiceId, res.outcome, icvUsed, [], null);
    return { outcome: res.outcome };
  } catch (e) {
    if (e instanceof ZatcaError) {
      if (e.kind === "business") {
        await db.invoice.update({ where: { id: invoiceId }, data: { zatcaStatus: "REJECTED" } });
        await writeLog(egs.id, invoiceId, "REJECTED", icvUsed, [...e.codes], e.message);
        await alertRejected(invoice.invoiceNumber, e.codes);
        return { outcome: "REJECTED", codes: [...e.codes] };
      }
      if (e.kind === "transport") {
        await db.invoice.update({ where: { id: invoiceId }, data: { zatcaStatus: "PENDING" } });
        await writeLog(egs.id, invoiceId, "TRANSPORT_ERROR", icvUsed, [], "gateway transport error");
        await alertTransport(invoice.invoiceNumber);
        return { outcome: "TRANSPORT_ERROR" };
      }
      throw e; // config — local misconfiguration; surface to the caller
    }
    throw e;
  }
}

/**
 * D22b correct-and-resubmit + D11 credit notes: issue a CREDIT_NOTE for a CLEARED SaaS
 * invoice (cancellation / refund), then clear the note (it references the original, chained).
 */
export async function createCreditNoteInternal(originalInvoiceId: string, reason: string): Promise<{ creditNoteId: string; result: ClearanceResult }> {
  const original = await db.invoice.findUnique({ where: { id: originalInvoiceId } });
  if (!original) throw new Error("Original invoice not found.");
  if (original.zatcaStatus !== "CLEARED") throw new Error("Only a cleared invoice can be credited.");

  const year = new Date().getFullYear();
  const note = await db.$transaction(async (tx) => {
    const seq = await getNextSequenceValue(tx, GLOBAL_SEQUENCE_SCOPE, "INVOICE", year);
    return tx.invoice.create({
      data: {
        invoiceNumber: `CN-${year}-${String(seq).padStart(5, "0")}`,
        organizationId: original.organizationId,
        subscriptionId: original.subscriptionId,
        status: "ISSUED",
        billingCycle: original.billingCycle,
        subtotal: original.subtotal,
        vatRate: original.vatRate,
        vatAmount: original.vatAmount,
        discountAmount: original.discountAmount,
        total: original.total,
        currency: original.currency,
        issuedAt: new Date(),
        notes: reason.slice(0, 480),
        documentType: "CREDIT_NOTE",
        originalInvoiceId: original.id,
        zatcaStatus: "PENDING",
      },
    });
  });

  const result = await clearSubscriptionInvoiceInternal(note.id);
  return { creditNoteId: note.id, result };
}
