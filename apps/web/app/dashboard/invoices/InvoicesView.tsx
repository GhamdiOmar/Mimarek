"use client";

import * as React from "react";
import { BadgeCheck, Clock, Eye, ReceiptText, RotateCw } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  IconButton,
  type ColumnDef,
} from "@repo/ui";
import { PageHeader } from "@repo/ui/components/PageHeader";
import { useLanguage } from "../../../components/LanguageProvider";
import {
  ZATCA_STATUS_LABEL,
  ZATCA_STATUS_VARIANT,
  ZATCA_DOCUMENT_TYPE_LABEL,
  ZATCA_CHARGE_TYPE_LABEL,
} from "../../../lib/domain-labels";
import type { getTenantInvoices } from "../../actions/zatca/tenant-invoices";
import { reissueHeldDocument } from "../../actions/zatca/tenant-invoices";

// ─── Prop types (derived from the server action's serialized return) ──────────
type TenantInvoices = Awaited<ReturnType<typeof getTenantInvoices>>;
type InvoiceDoc = TenantInvoices["documents"][number];
type ReportingHealth = TenantInvoices["health"];

interface InvoicesViewProps {
  documents: InvoiceDoc[];
  health: ReportingHealth;
}

// ─── ZATCA confirmation (derived — NOT a DB column) ───────────────────────────
// A document is "confirmed by ZATCA" once ZATCA accepted it (CLEARED / REPORTED).
// An e-invoice that should be confirmed but isn't yet is "awaiting". A RECEIPT is
// out of scope — never an e-invoice — so it is neither confirmed nor awaiting.
type ZatcaConfirmation = "confirmed" | "awaiting" | "not-applicable";

function zatcaConfirmation(doc: {
  zatcaStatus: string;
  documentType: string;
  needsBuyerData?: boolean;
}): ZatcaConfirmation {
  if (doc.zatcaStatus === "CLEARED" || doc.zatcaStatus === "REPORTED") return "confirmed";
  if (doc.documentType === "RECEIPT") return "not-applicable";
  return "awaiting"; // an e-invoice that should be confirmed but isn't yet
}

// Bilingual readable names for the missing-buyer-field keys returned by reissueHeldDocument.
const MISSING_FIELD_LABEL: Record<string, { ar: string; en: string }> = {
  vatNumber: { ar: "الرقم الضريبي", en: "VAT" },
  crNumber: { ar: "السجل التجاري", en: "CR" },
  address: { ar: "العنوان", en: "Address" },
  companyName: { ar: "اسم المنشأة", en: "Company name" },
};

function formatDate(value: string | Date | null | undefined, lang: "ar" | "en"): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function InvoicesView({ documents, health }: InvoicesViewProps) {
  const { t, lang } = useLanguage();
  const [isReissuing, startReissue] = React.useTransition();

  const sar = React.useMemo(
    () =>
      new Intl.NumberFormat(lang === "ar" ? "ar-SA" : "en-SA", {
        style: "currency",
        currency: "SAR",
      }),
    [lang],
  );

  // ── Confirmation filter (segment pills, §6.6.8) ─────────────────────────────
  const [confirmFilter, setConfirmFilter] = React.useState<"all" | "confirmed" | "awaiting">("all");

  const counts = React.useMemo(() => {
    let confirmed = 0;
    let awaiting = 0;
    for (const d of documents) {
      const status = zatcaConfirmation(d);
      if (status === "confirmed") confirmed += 1;
      else if (status === "awaiting") awaiting += 1;
    }
    return { all: documents.length, confirmed, awaiting };
  }, [documents]);

  // Receipts are EXCLUDED from "awaiting" — only "all" shows them.
  const filteredDocs = React.useMemo(() => {
    if (confirmFilter === "all") return documents;
    return documents.filter((d) => zatcaConfirmation(d) === confirmFilter);
  }, [documents, confirmFilter]);

  const onReissue = React.useCallback(
    (id: string) => {
      startReissue(async () => {
        try {
          const result = await reissueHeldDocument(id);
          if (result.ok) {
            toast.success(t("تم إصدار الفاتورة بنجاح.", "Invoice re-issued successfully."));
          } else {
            const missing = (result.missing.length > 0 ? result.missing : ["—"])
              .map((key) => {
                const label = MISSING_FIELD_LABEL[key];
                return label ? t(label.ar, label.en) : key;
              })
              .join("، ");
            toast.error(
              t(
                `لا تزال بيانات المشتري ناقصة: ${missing}.`,
                `The buyer is still missing: ${missing}.`,
              ),
            );
          }
        } catch {
          toast.error(t("تعذّر إعادة إصدار الفاتورة. حاول مرة أخرى.", "Could not re-issue the invoice. Please try again."));
        }
      });
    },
    [t],
  );

  // ── Table columns ───────────────────────────────────────────────────────
  const columns = React.useMemo<ColumnDef<InvoiceDoc>[]>(
    () => [
      {
        accessorKey: "documentNumber",
        header: t("رقم المستند", "Document №"),
        enableHiding: false,
        cell: ({ row }) => (
          <span dir="ltr" className="font-mono text-xs tabular-nums text-foreground">
            {row.original.documentNumber}
          </span>
        ),
      },
      {
        accessorKey: "documentType",
        header: t("النوع", "Type"),
        enableSorting: true,
        cell: ({ row }) => {
          const label = ZATCA_DOCUMENT_TYPE_LABEL[row.original.documentType];
          return (
            <Badge variant="outline" size="sm">
              {label ? t(label.ar, label.en) : row.original.documentType}
            </Badge>
          );
        },
      },
      {
        accessorKey: "buyerName",
        header: t("المشتري", "Buyer"),
        enableSorting: true,
        cell: ({ row }) => (
          <span className="text-foreground">{row.original.buyerName ?? "—"}</span>
        ),
      },
      {
        accessorKey: "chargeType",
        header: t("نوع الرسوم", "Charge"),
        enableSorting: true,
        cell: ({ row }) => {
          const label = ZATCA_CHARGE_TYPE_LABEL[row.original.chargeType];
          return (
            <span className="text-sm text-muted-foreground">
              {label ? t(label.ar, label.en) : row.original.chargeType}
            </span>
          );
        },
      },
      {
        accessorKey: "total",
        header: t("الإجمالي", "Total"),
        enableSorting: true,
        meta: { numeric: true },
        cell: ({ row }) => (
          <span dir="ltr" className="block text-end font-mono tabular-nums text-foreground">
            {sar.format(Number(row.original.total))}
          </span>
        ),
      },
      {
        id: "confirmation",
        header: t("التأكيد", "Confirmed"),
        enableSorting: false,
        cell: ({ row }) => {
          const status = zatcaConfirmation(row.original);
          if (status === "confirmed") {
            const label = t("مؤكَّدة من هيئة الزكاة والضريبة", "Confirmed by ZATCA");
            return (
              <span className="flex items-center gap-1.5 text-primary" title={label} aria-label={label}>
                <BadgeCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="text-xs font-medium">{t("مؤكَّدة", "Confirmed")}</span>
              </span>
            );
          }
          if (status === "awaiting") {
            const label = t("بانتظار التأكيد", "Awaiting confirmation");
            return (
              <span className="flex items-center gap-1.5 text-warning" title={label} aria-label={label}>
                <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
              </span>
            );
          }
          return <span className="text-muted-foreground" aria-hidden="true">—</span>;
        },
      },
      {
        accessorKey: "zatcaStatus",
        header: t("حالة زاتكا", "ZATCA status"),
        enableSorting: true,
        cell: ({ row }) => {
          if (row.original.needsBuyerData) {
            return (
              <Badge variant="warning" size="sm">
                {t("بانتظار البيانات", "Held")}
              </Badge>
            );
          }
          const label = ZATCA_STATUS_LABEL[row.original.zatcaStatus];
          const variant = ZATCA_STATUS_VARIANT[row.original.zatcaStatus] ?? "default";
          return (
            <Badge variant={variant} size="sm">
              {label ? t(label.ar, label.en) : row.original.zatcaStatus}
            </Badge>
          );
        },
      },
      {
        accessorKey: "issuedAt",
        header: t("تاريخ الإصدار", "Issued"),
        enableSorting: true,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{formatDate(row.original.issuedAt, lang)}</span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const doc = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <Link href={`/dashboard/invoices/${doc.id}`} tabIndex={-1}>
                <IconButton icon={Eye} aria-label={t("عرض", "View")} variant="ghost" />
              </Link>
              {doc.needsBuyerData && (
                <IconButton
                  icon={RotateCw}
                  aria-label={t("إعادة الإصدار", "Re-issue")}
                  variant="ghost"
                  className="text-primary"
                  disabled={isReissuing}
                  onClick={() => onReissue(doc.id)}
                />
              )}
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t`/`sar` derive from `lang`
    [lang, isReissuing, onReissue],
  );

  // ── Compact health strip ────────────────────────────────────────────────
  const healthCells = (
    [
      ["cleared", t("معتمدة", "Cleared")],
      ["reported", t("مُبلّغ عنها", "Reported")],
      ["pending", t("قيد المعالجة", "Pending")],
      ["rejected", t("مرفوضة", "Rejected")],
      ["held", t("بانتظار البيانات", "Held")],
    ] as const
  ).map(([key, label]) => {
    const value = health[key];
    const tone =
      key === "rejected" && value > 0
        ? "text-destructive"
        : key === "held" && value > 0
          ? "text-warning-strong"
          : "text-foreground";
    return (
      <div key={key} className="rounded-md border border-border bg-card px-3 py-2">
        <dt className="text-[11px] text-muted-foreground">{label}</dt>
        <dd dir="ltr" className={`mt-0.5 text-xl font-bold tabular-nums ${tone}`}>
          {value}
        </dd>
      </div>
    );
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <ReceiptText className="h-7 w-7" />
        </div>
        <PageHeader
          className="flex-1"
          title={t("الفواتير والسندات", "Invoices & Receipts")}
          description={t(
            "كل المستندات الضريبية الصادرة لعملائك مع حالتها لدى هيئة الزكاة والضريبة.",
            "Every ZATCA document issued to your customers and its status with ZATCA.",
          )}
        />
      </div>

      {/* Health strip */}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{healthCells}</dl>

      {/* Confirmation filter pills (§6.6.8) */}
      {documents.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["all", t("الكل", "All"), counts.all],
              ["confirmed", t("مؤكَّدة", "Confirmed"), counts.confirmed],
              ["awaiting", t("بانتظار التأكيد", "Awaiting"), counts.awaiting],
            ] as const
          ).map(([key, label, count]) => {
            const isActive = confirmFilter === key;
            return (
              <Button
                key={key}
                size="sm"
                variant={isActive ? "primary" : "subtle"}
                className="rounded-full"
                aria-pressed={isActive}
                onClick={() => setConfirmFilter(key)}
              >
                {label}
                <span dir="ltr" className="ms-1.5 tabular-nums opacity-70">
                  {count}
                </span>
              </Button>
            );
          })}
        </div>
      )}

      {/* Documents table */}
      <Card className="overflow-hidden">
        {documents.length === 0 ? (
          <div className="p-6">
            <EmptyState
              variant="first-time"
              icon={<ReceiptText className="h-12 w-12" aria-hidden="true" />}
              title={t("لا توجد فواتير بعد", "No invoices yet")}
              description={t(
                "ستظهر هنا كل فاتورة أو سند ضريبي يصدر تلقائيًا عند تحصيل دفعة.",
                "Every tax invoice and receipt issued automatically when you collect a payment appears here.",
              )}
              action={
                <Link href="/dashboard/payments">
                  <Button style={{ display: "inline-flex" }}>{t("عرض المدفوعات", "View payments")}</Button>
                </Link>
              }
              helpHref="/dashboard/help#zatca"
              helpLabel={t("تعرّف على الفوترة الإلكترونية", "Learn about e-invoicing")}
            />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredDocs}
            locale={lang === "ar" ? "ar" : "en"}
            pagination
            pageSize={10}
            getRowId={(r) => r.id}
            emptyTitle={t("لا توجد نتائج مطابقة", "No matching invoices")}
            emptyDescription={t("جرّب تعديل الفلاتر أو البحث.", "Try adjusting your filters or search.")}
          />
        )}
      </Card>
    </div>
  );
}
