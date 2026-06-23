"use client";

import * as React from "react";
import { ArrowLeft, BadgeCheck, Clock, Download, FileSignature, Loader2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button, DirectionalIcon } from "@repo/ui";
import { ZatcaDocument, type ZatcaDocumentLine } from "../../../../components/zatca/ZatcaDocument";
import { useLanguage } from "../../../../components/LanguageProvider";
import { ZATCA_DOCUMENT_TYPE_LABEL } from "../../../../lib/domain-labels";
import { reissueHeldDocument } from "../../../actions/zatca/tenant-invoices";

// `getTenantInvoice` returns `serialize(...)` which is typed `any` (Decimal→string,
// Date→string at the RSC boundary). We narrow the bits we render with local shapes.
type InvoiceLineItem = {
  description: string;
  descriptionAr: string | null;
  quantity: number;
  unitPrice: number | string;
  vatRate: number | string;
  vatAmount: number | string;
  total: number | string;
  sortOrder: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InvoiceDetail = any;

interface InvoiceDetailViewProps {
  doc: InvoiceDetail;
}

// ─── ZATCA confirmation (derived — NOT a DB column; mirrors InvoicesView) ─────
// Confirmed once ZATCA accepted it (CLEARED / REPORTED); an e-invoice that should
// be confirmed but isn't yet is "awaiting"; a RECEIPT is out of scope (neither).
type ZatcaConfirmation = "confirmed" | "awaiting" | "not-applicable";

function zatcaConfirmation(doc: {
  zatcaStatus: string;
  documentType: string;
  needsBuyerData?: boolean;
}): ZatcaConfirmation {
  if (doc.zatcaStatus === "CLEARED" || doc.zatcaStatus === "REPORTED") return "confirmed";
  if (doc.documentType === "RECEIPT") return "not-applicable";
  return "awaiting";
}

/** Build a single-line address string from the EGS `nationalAddress` JSON. */
function formatAddress(addr: unknown): string {
  if (!addr || typeof addr !== "object") return "";
  const a = addr as Record<string, unknown>;
  const parts = [a.buildingNumber, a.streetName, a.district, a.city, a.postalCode]
    .filter((v) => typeof v === "string" && v.trim())
    .map(String);
  return parts.join(", ");
}

function formatDateTime(value: string | Date | null | undefined, lang: "ar" | "en"): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function InvoiceDetailView({ doc }: InvoiceDetailViewProps) {
  const { t, lang } = useLanguage();
  const printRef = React.useRef<HTMLDivElement>(null);
  const [qrPng, setQrPng] = React.useState<string | null>(null);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [isReissuing, startReissue] = React.useTransition();

  const egs = doc.egsUnit;

  // Render the ZATCA TLV base64 to a scannable PNG data-URI (qrcode lib, client-only).
  React.useEffect(() => {
    let cancelled = false;
    if (!doc.zatcaQrCode) {
      setQrPng(null);
      return;
    }
    import("qrcode")
      .then((mod) => mod.default.toDataURL(doc.zatcaQrCode as string, { margin: 1, width: 256 }))
      .then((url) => {
        if (!cancelled) setQrPng(url);
      })
      .catch(() => {
        if (!cancelled) setQrPng(null);
      });
    return () => {
      cancelled = true;
    };
  }, [doc.zatcaQrCode]);

  const lines: ZatcaDocumentLine[] = (doc.lineItems ?? []).map((li: InvoiceLineItem) => ({
    descAr: li.descriptionAr ?? undefined,
    descEn: li.description,
    qty: Number(li.quantity),
    unitPrice: Number(li.unitPrice),
    vatPercent: Number(li.vatRate) * 100,
    vatAmount: Number(li.vatAmount),
    lineTotal: Number(li.total),
  }));

  const typeLabel = ZATCA_DOCUMENT_TYPE_LABEL[doc.documentType] ?? {
    ar: doc.documentType,
    en: doc.documentType,
  };

  const docStatus: "CLEARED" | "REPORTED" | null =
    doc.zatcaStatus === "CLEARED" ? "CLEARED" : doc.zatcaStatus === "REPORTED" ? "REPORTED" : null;

  const confirmation = zatcaConfirmation(doc);

  // ── Download as a portrait A4 PDF (snapshot of the rendered ZatcaDocument). ──
  const onDownload = React.useCallback(async () => {
    const node = printRef.current;
    if (!node) return;
    setIsDownloading(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const canvas = await html2canvas(node, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const imgData = canvas.toDataURL("image/png");

      // Single page when it fits; otherwise slice the tall image across A4 pages.
      if (imgHeight <= pageHeight) {
        pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
      } else {
        let heightLeft = imgHeight;
        let position = 0;
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        while (heightLeft > 0) {
          position -= pageHeight;
          pdf.addPage();
          pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }
      }

      pdf.save(`${doc.documentNumber || "invoice"}.pdf`);
    } catch {
      toast.error(t("تعذّر إنشاء ملف PDF. حاول مرة أخرى.", "Could not generate the PDF. Please try again."));
    } finally {
      setIsDownloading(false);
    }
  }, [doc.documentNumber, t]);

  // ── Re-issue a HELD document after buyer data is completed. ─────────────────
  const onReissue = React.useCallback(() => {
    startReissue(async () => {
      try {
        const result = await reissueHeldDocument(doc.id);
        if (result.ok) {
          toast.success(t("تم إصدار الفاتورة بنجاح.", "Invoice re-issued successfully."));
        } else {
          const labels: Record<string, { ar: string; en: string }> = {
            vatNumber: { ar: "الرقم الضريبي", en: "VAT" },
            crNumber: { ar: "السجل التجاري", en: "CR" },
            address: { ar: "العنوان", en: "Address" },
            companyName: { ar: "اسم المنشأة", en: "Company name" },
          };
          const missing = (result.missing.length > 0 ? result.missing : ["—"])
            .map((key) => {
              const label = labels[key];
              return label ? t(label.ar, label.en) : key;
            })
            .join("، ");
          toast.error(
            t(`لا تزال بيانات المشتري ناقصة: ${missing}.`, `The buyer is still missing: ${missing}.`),
          );
        }
      } catch {
        toast.error(t("تعذّر إعادة إصدار الفاتورة. حاول مرة أخرى.", "Could not re-issue the invoice. Please try again."));
      }
    });
  }, [doc.id, t]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* Back link */}
      <Link
        href="/dashboard/invoices"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
      >
        <DirectionalIcon icon={ArrowLeft} className="h-4 w-4" />
        {t("الفواتير والسندات", "Invoices & Receipts")}
      </Link>

      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h2 font-semibold text-foreground">
            {t(typeLabel.ar, typeLabel.en)}
          </h1>
          <p dir="ltr" className="font-mono text-xs tabular-nums text-muted-foreground">
            {doc.documentNumber}
          </p>
          {confirmation === "confirmed" && (
            <span className="mt-1 inline-flex items-center gap-1 text-primary text-xs">
              <BadgeCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
              {t("مؤكَّدة من هيئة الزكاة والضريبة", "Confirmed by ZATCA")}
            </span>
          )}
          {confirmation === "awaiting" && (
            <span className="mt-1 inline-flex items-center gap-1 text-warning-strong text-xs">
              <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
              {t("بانتظار التأكيد من هيئة الزكاة والضريبة", "Awaiting ZATCA confirmation")}
            </span>
          )}
        </div>
        <Button onClick={onDownload} disabled={isDownloading} style={{ display: "inline-flex" }} className="gap-2">
          {isDownloading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="h-4 w-4" aria-hidden="true" />
          )}
          {isDownloading ? t("جارٍ التحضير…", "Preparing…") : t("تنزيل PDF", "Download PDF")}
        </Button>
      </div>

      {/* HELD warning + re-issue */}
      {doc.needsBuyerData && (
        <div className="flex flex-col gap-3 rounded-md border border-warning bg-warning/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 text-sm text-warning-strong">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {t(
                "هذه الفاتورة بانتظار إكمال بيانات المشتري (الرقم الضريبي/السجل/العنوان) قبل اعتمادها.",
                "This invoice is awaiting the buyer's VAT/CR/address before it can be cleared.",
              )}
            </span>
          </div>
          <Button
            variant="secondary"
            onClick={onReissue}
            disabled={isReissuing}
            style={{ display: "inline-flex" }}
            className="shrink-0 gap-2"
          >
            <FileSignature className="h-4 w-4" aria-hidden="true" />
            {isReissuing ? t("جارٍ الإصدار…", "Re-issuing…") : t("إعادة الإصدار", "Re-issue")}
          </Button>
        </div>
      )}

      {/* Printable document (light-only A4 surface) */}
      <div className="overflow-x-auto rounded-lg border border-border bg-muted/30 p-4">
        <div ref={printRef} className="mx-auto w-fit shadow-lg">
          <ZatcaDocument
            sellerNameAr={egs?.legalNameAr || egs?.legalNameEn || ""}
            sellerNameEn={egs?.legalNameEn || egs?.legalNameAr || ""}
            sellerVat={egs?.vatNumber ?? "—"}
            sellerCr={egs?.crNumber ?? undefined}
            sellerAddress={formatAddress(egs?.nationalAddress)}
            buyerNameAr={doc.buyerNameAr ?? undefined}
            buyerNameEn={doc.buyerName ?? "—"}
            buyerVat={doc.buyerVatNumber ?? undefined}
            buyerAddress={formatAddress(doc.buyerAddress) || undefined}
            documentTypeLabel={typeLabel}
            invoiceNumber={doc.documentNumber}
            uuid={doc.uuid}
            icv="—"
            issueDateTime={formatDateTime(doc.issuedAt, lang)}
            currency={doc.currency ?? "SAR"}
            lines={lines}
            taxableTotal={Number(doc.subtotal)}
            vatTotal={Number(doc.vatAmount)}
            grandTotal={Number(doc.total)}
            qrBase64={qrPng}
            status={docStatus}
          />
        </div>
      </div>
    </div>
  );
}
