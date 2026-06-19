"use client";

import { useLanguage } from "../../../../components/LanguageProvider";
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Receipt,
  Download,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  Loader2,
} from "lucide-react";
import {
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  AppBar,
  DataCard,
  SARAmount,
  Badge,
  Skeleton,
  EmptyState,
  BottomSheet,
  DirectionalIcon,
  IconButton,
  ActionLink,
  DataTable,
  type ColumnDef,
} from "@repo/ui";
import Link from "next/link";
import { PageHeader } from "@repo/ui/components/PageHeader";
import { getInvoices, getInvoiceById } from "../../../actions/billing";
import { exportToPDF } from "../../../../lib/export";

// ─── View-model types ────────────────────────────────────────────────────────
// These describe the *serialized* shape returned by the billing server actions
// (`getInvoices` / `getInvoiceById`), which both run their Prisma result through
// `serialize()` (JSON round-trip) → Prisma `Decimal` becomes `string` and `Date`
// becomes `string`. Numeric money fields are read via `Number(...)` everywhere,
// so they are typed `string | number` to match the serialized value without
// changing runtime behavior. `discount` / `paymentMethod` are read by the JSX but
// are not on the `Invoice` model, so at runtime they are always `undefined` (the
// discount/payment-method blocks never render) — see the per-field notes below.

interface InvoiceLineItemRow {
  id?: string;
  description: string;
  descriptionAr?: string | null;
  quantity: number;
  unitPrice: string | number;
  vatAmount?: string | number;
  total: string | number;
  sortOrder?: number;
}

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  status: string;
  issuedAt?: string | null;
  dueDate?: string | null;
  subtotal: string | number;
  vatAmount: string | number;
  total: string | number;
  /**
   * Not on the `Invoice` model — `undefined` at runtime, so the `discount > 0`
   * guard is always false and the discount block never renders. Typed `number`
   * (not `number | undefined`) only so the existing `viewInvoice.discount > 0`
   * relational comparison type-checks without altering the expression; the
   * runtime value and behavior are unchanged.
   */
  discount: number;
  /** Not on the Invoice model — `undefined` at runtime; the payment-method block never renders. */
  paymentMethod?: string | null;
  lineItems?: InvoiceLineItemRow[];
}

interface InvoicesResult {
  invoices: InvoiceRow[];
  total: number;
  page: number;
  pageSize?: number;
  totalPages: number;
}

export default function InvoicesPage() {
  const { lang } = useLanguage();
  const router = useRouter();
  const [data, setData] = React.useState<InvoicesResult>({ invoices: [], total: 0, page: 1, totalPages: 0 });
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [viewInvoice, setViewInvoice] = React.useState<InvoiceRow | null>(null);
  const [loadingInvoice, setLoadingInvoice] = React.useState(false);
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);
  const [mobileFilter, setMobileFilter] = React.useState<"ALL" | "PAID" | "ISSUED" | "OVERDUE">("ALL");

  const handleViewInvoice = async (invoiceId: string) => {
    setLoadingInvoice(true);
    try {
      const invoice = await getInvoiceById(invoiceId);
      setViewInvoice(invoice);
    } catch (err) {
      console.error("Failed to load invoice:", err);
    } finally {
      setLoadingInvoice(false);
    }
  };

  const handleDownloadInvoice = async (invoiceId: string) => {
    setDownloadingId(invoiceId);
    try {
      const invoice = await getInvoiceById(invoiceId);
      setViewInvoice(invoice);
      // Wait for the modal to render the element
      await new Promise((r) => setTimeout(r, 300));
      await exportToPDF({
        elementId: "invoice-detail-print",
        filename: `Invoice_${invoice.invoiceNumber}`,
        title: lang === "ar" ? `فاتورة ${invoice.invoiceNumber}` : `Invoice ${invoice.invoiceNumber}`,
        lang,
      });
      setViewInvoice(null);
    } catch (err) {
      console.error("Failed to download invoice:", err);
    } finally {
      setDownloadingId(null);
    }
  };

  React.useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const result = await getInvoices(page, 20);
        setData(result);
      } catch (error) {
        console.error("Failed to load invoices:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [page]);

  const t = translations[lang];

  const statusConfig: Record<string, { color: string; labelAr: string; labelEn: string }> = {
    DRAFT: { color: "bg-muted text-muted-foreground", labelAr: "مسودة", labelEn: "Draft" },
    ISSUED: { color: "bg-info/15 text-info-strong", labelAr: "صادرة", labelEn: "Issued" },
    PAID: { color: "bg-success/15 text-success-strong", labelAr: "مدفوعة", labelEn: "Paid" },
    OVERDUE: { color: "bg-destructive/15 text-destructive", labelAr: "متأخرة", labelEn: "Overdue" },
    CANCELED: { color: "bg-muted text-muted-foreground", labelAr: "ملغاة", labelEn: "Canceled" },
    REFUNDED: { color: "bg-primary/15 text-primary", labelAr: "مستردة", labelEn: "Refunded" },
  };

  function badgeVariant(
    status: string,
  ): "success" | "pending" | "overdue" | "warning" | "default" | "outline" {
    switch (status) {
      case "PAID":
        return "success";
      case "OVERDUE":
        return "overdue";
      case "ISSUED":
        return "pending";
      case "DRAFT":
        return "default";
      case "CANCELED":
      case "REFUNDED":
        return "outline";
      default:
        return "default";
    }
  }

  const filterChips: Array<{ key: "ALL" | "PAID" | "ISSUED" | "OVERDUE"; ar: string; en: string }> = [
    { key: "ALL", ar: "الكل", en: "All" },
    { key: "PAID", ar: "مدفوعة", en: "Paid" },
    { key: "ISSUED", ar: "مفتوحة", en: "Unpaid" },
    { key: "OVERDUE", ar: "متأخرة", en: "Overdue" },
  ];

  const filteredMobile = React.useMemo(() => {
    if (mobileFilter === "ALL") return data.invoices;
    return data.invoices.filter((inv) => inv.status === mobileFilter);
  }, [data.invoices, mobileFilter]);

  // ─── DataTable columns ──────────────────────────────────────────────────────

  const invoiceColumns = React.useMemo<ColumnDef<InvoiceRow>[]>(
    () => [
      {
        accessorKey: "invoiceNumber",
        header: t.invoiceNumber,
        cell: ({ row }) => (
          <span className="font-mono text-xs font-medium text-foreground">
            {row.original.invoiceNumber}
          </span>
        ),
        enableSorting: true,
        enableHiding: false,
      },
      {
        accessorKey: "issuedAt",
        header: t.date,
        cell: ({ row }) =>
          row.original.issuedAt
            ? new Date(row.original.issuedAt).toLocaleDateString(
                lang === "ar" ? "ar-SA-u-nu-latn" : "en-US",
              )
            : "—",
        enableSorting: true,
      },
      {
        accessorKey: "status",
        header: t.status,
        cell: ({ row }) => {
          const status = statusConfig[row.original.status] ?? statusConfig.DRAFT!;
          return (
            <Badge variant={badgeVariant(row.original.status)} size="sm">
              {lang === "ar" ? status.labelAr : status.labelEn}
            </Badge>
          );
        },
        enableSorting: true,
      },
      {
        accessorKey: "subtotal",
        header: t.subtotal,
        cell: ({ row }) => (
          <span className="tabular-nums">
            {Number(row.original.subtotal).toLocaleString()} {t.sar}
          </span>
        ),
        enableSorting: true,
        meta: { numeric: true },
      },
      {
        accessorKey: "vatAmount",
        header: t.vat,
        cell: ({ row }) => (
          <span className="tabular-nums">
            {Number(row.original.vatAmount).toLocaleString()} {t.sar}
          </span>
        ),
        enableSorting: true,
        meta: { numeric: true },
      },
      {
        accessorKey: "total",
        header: t.total,
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums">
            {Number(row.original.total).toLocaleString()} {t.sar}
          </span>
        ),
        enableSorting: true,
        meta: { numeric: true },
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const inv = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <IconButton
                icon={Eye}
                aria-label={lang === "ar" ? "عرض" : "View"}
                variant="ghost"
                onClick={() => handleViewInvoice(inv.id)}
                disabled={loadingInvoice}
              />
              <IconButton
                icon={downloadingId === inv.id ? Loader2 : Download}
                aria-label={lang === "ar" ? "تنزيل" : "Download"}
                variant="ghost"
                onClick={() => handleDownloadInvoice(inv.id)}
                disabled={downloadingId === inv.id}
                className={downloadingId === inv.id ? "animate-spin" : undefined}
              />
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang, t, loadingInvoice, downloadingId],
  );

  function renderMobileInvoiceCard(inv: InvoiceRow) {
    const status = statusConfig[inv.status] ?? statusConfig.DRAFT!;
    return (
      <DataCard
        icon={Receipt}
        iconTone="primary"
        divider={false}
        onClick={() => handleViewInvoice(inv.id)}
        title={
          <span className="font-mono text-xs text-foreground">
            {inv.invoiceNumber}
          </span>
        }
        subtitle={[
          <span key="issued" className="tabular-nums">
            {inv.issuedAt
              ? new Date(inv.issuedAt).toLocaleDateString(
                  lang === "ar" ? "ar-SA-u-nu-latn" : "en-US",
                )
              : "—"}
          </span>,
          inv.dueDate ? (
            <span key="due" className="tabular-nums">
              {lang === "ar" ? "استحقاق" : "Due"}:{" "}
              {new Date(inv.dueDate).toLocaleDateString(
                lang === "ar" ? "ar-SA-u-nu-latn" : "en-US",
              )}
            </span>
          ) : null,
        ]}
        trailing={
          <div className="flex flex-col items-end gap-1">
            <SARAmount
              value={Number(inv.total)}
              size={13}
              className="font-semibold text-foreground tabular-nums"
            />
            <Badge variant={badgeVariant(inv.status)} size="sm">
              {lang === "ar" ? status.labelAr : status.labelEn}
            </Badge>
          </div>
        }
      />
    );
  }

  return (
    <>
    {/* ─── Mobile (< md) ─────────────────────────────────────────────── */}
    <div
      className="md:hidden -m-4 sm:-m-6 min-h-dvh flex flex-col bg-background"
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <AppBar
        title={t.title}
        lang={lang}
        onBack={() => router.push("/dashboard/billing")}
      />

      <div className="flex-1 px-4 pt-4 pb-8 space-y-4">
        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
          {filterChips.map((chip) => {
            const isActive = mobileFilter === chip.key;
            return (
              <Button
                key={chip.key}
                variant={isActive ? "primary" : "subtle"}
                size="sm"
                aria-pressed={isActive}
                onClick={() => setMobileFilter(chip.key)}
                className="rounded-full whitespace-nowrap"
              >
                {lang === "ar" ? chip.ar : chip.en}
              </Button>
            );
          })}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : filteredMobile.length === 0 ? (
          data.invoices.length === 0 ? (
            <EmptyState
              variant="first-time"
              icon={<Receipt className="h-12 w-12" aria-hidden="true" />}
              title={t.noInvoices}
              description={
                lang === "ar"
                  ? "ستظهر فواتيرك هنا بمجرد إصدار أول اشتراك."
                  : "Your invoices appear here once your first subscription is billed."
              }
            />
          ) : (
            <EmptyState
              variant="filtered"
              icon={<Receipt className="w-10 h-10" aria-hidden="true" />}
              title={lang === "ar" ? "لا توجد نتائج مطابقة" : "No matching invoices"}
              description={
                lang === "ar" ? "جرّب تصفية أخرى." : "Try a different filter."
              }
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMobileFilter("ALL")}
                  style={{ display: "inline-flex" }}
                >
                  {lang === "ar" ? "مسح الفلاتر" : "Clear filters"}
                </Button>
              }
              compact
            />
          )
        ) : (
          <div className="rounded-xl border border-border bg-card px-4">
            {filteredMobile.map((inv, idx) => (
              <React.Fragment key={inv.id}>
                {renderMobileInvoiceCard(inv)}
                {idx !== filteredMobile.length - 1 && (
                  <div className="border-b border-border" />
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Pagination (mobile) */}
        {!loading && data.totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="secondary"
              size="sm"
              style={{ display: "inline-flex" }}
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="h-10"
              aria-label={lang === "ar" ? "السابق" : "Previous"}
            >
              <DirectionalIcon icon={ChevronLeft} className="w-4 h-4" />
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums">
              {page} / {data.totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              style={{ display: "inline-flex" }}
              disabled={page >= data.totalPages}
              onClick={() => setPage(page + 1)}
              className="h-10"
              aria-label={lang === "ar" ? "التالي" : "Next"}
            >
              <DirectionalIcon icon={ChevronRight} className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* BottomSheet for invoice details */}
      <BottomSheet
        open={!!viewInvoice}
        onOpenChange={(open) => !open && setViewInvoice(null)}
        title={viewInvoice ? `${lang === "ar" ? "فاتورة" : "Invoice"} ${viewInvoice.invoiceNumber}` : undefined}
        footer={
          viewInvoice ? (
            <Button
              variant="primary"
              style={{ display: "inline-flex" }}
              className="w-full gap-2 h-11"
              disabled={downloadingId === viewInvoice.id}
              onClick={async () => {
                setDownloadingId(viewInvoice.id);
                try {
                  await exportToPDF({
                    elementId: "invoice-detail-print-mobile",
                    filename: `Invoice_${viewInvoice.invoiceNumber}`,
                    title:
                      lang === "ar"
                        ? `فاتورة ${viewInvoice.invoiceNumber}`
                        : `Invoice ${viewInvoice.invoiceNumber}`,
                    lang,
                  });
                } finally {
                  setDownloadingId(null);
                }
              }}
            >
              {downloadingId === viewInvoice.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {lang === "ar" ? "تحميل PDF" : "Download PDF"}
            </Button>
          ) : undefined
        }
      >
        {viewInvoice && (
          <div id="invoice-detail-print-mobile" className="space-y-4 pt-2" dir={lang === "ar" ? "rtl" : "ltr"}>
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{t.invoiceNumber}</p>
                <p className="font-mono text-sm font-semibold text-foreground mt-0.5">
                  {viewInvoice.invoiceNumber}
                </p>
              </div>
              <Badge variant={badgeVariant(viewInvoice.status)} size="md">
                {lang === "ar"
                  ? (statusConfig[viewInvoice.status] ?? statusConfig.DRAFT!).labelAr
                  : (statusConfig[viewInvoice.status] ?? statusConfig.DRAFT!).labelEn}
              </Badge>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground">{t.date}</p>
                <p className="font-medium text-foreground mt-0.5 tabular-nums">
                  {viewInvoice.issuedAt
                    ? new Date(viewInvoice.issuedAt).toLocaleDateString(
                        lang === "ar" ? "ar-SA-u-nu-latn" : "en-US",
                      )
                    : "—"}
                </p>
              </div>
              {viewInvoice.dueDate && (
                <div>
                  <p className="text-muted-foreground">
                    {lang === "ar" ? "تاريخ الاستحقاق" : "Due Date"}
                  </p>
                  <p className="font-medium text-foreground mt-0.5 tabular-nums">
                    {new Date(viewInvoice.dueDate).toLocaleDateString(
                      lang === "ar" ? "ar-SA-u-nu-latn" : "en-US",
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* Line items */}
            {viewInvoice.lineItems && viewInvoice.lineItems.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground">
                  {lang === "ar" ? "البنود" : "Line Items"}
                </p>
                <div className="rounded-lg border border-border divide-y divide-border">
                  {viewInvoice.lineItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground truncate">
                          {item.description}
                        </p>
                        <p className="text-muted-foreground tabular-nums mt-0.5">
                          {item.quantity} ×{" "}
                          <SARAmount
                            value={Number(item.unitPrice)}
                            size={10}
                            className="tabular-nums"
                          />
                        </p>
                      </div>
                      <SARAmount
                        value={Number(item.total)}
                        size={12}
                        className="font-semibold text-foreground tabular-nums"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Totals */}
            <div className="border-t border-border pt-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t.subtotal}</span>
                <SARAmount
                  value={Number(viewInvoice.subtotal)}
                  size={11}
                  className="font-medium text-foreground tabular-nums"
                />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t.vat}</span>
                <SARAmount
                  value={Number(viewInvoice.vatAmount)}
                  size={11}
                  className="font-medium text-foreground tabular-nums"
                />
              </div>
              {viewInvoice.discount > 0 && (
                <div className="flex justify-between text-success">
                  <span>{lang === "ar" ? "الخصم" : "Discount"}</span>
                  <span className="tabular-nums">
                    -
                    <SARAmount
                      value={Number(viewInvoice.discount)}
                      size={11}
                      className="tabular-nums"
                    />
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold border-t border-border pt-2">
                <span className="text-foreground">{t.total}</span>
                <SARAmount
                  value={Number(viewInvoice.total)}
                  size={14}
                  className="text-foreground tabular-nums"
                />
              </div>
            </div>

            {/* Payment method */}
            {viewInvoice.paymentMethod && (
              <div className="text-xs">
                <p className="text-muted-foreground">
                  {lang === "ar" ? "طريقة الدفع" : "Payment Method"}
                </p>
                <p className="font-medium text-foreground mt-0.5">
                  {viewInvoice.paymentMethod}
                </p>
              </div>
            )}
          </div>
        )}
      </BottomSheet>
    </div>

    {/* ─── Desktop (≥ md) ─ unchanged ───────────────────────────────── */}
    <div className="hidden md:block" data-loaded={loading ? "false" : "true"}>
    <div className="space-y-6" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* Header */}
      <div>
        <ActionLink
          asChild
          leadingIcon={ArrowLeft}
          directional
          className="text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <Link href="/dashboard/billing">{t.backToBilling}</Link>
        </ActionLink>
        <PageHeader
          title={t.title}
          description={t.subtitle}
          badge={<Receipt className="w-6 h-6 text-primary" aria-hidden="true" />}
        />
      </div>

      {/* Invoices Table */}
      <DataTable
        columns={invoiceColumns}
        data={data.invoices}
        loading={loading}
        locale={lang === "ar" ? "ar" : "en"}
        pagination
        pageSize={10}
        getRowId={(r) => r.id}
        mobileCard={renderMobileInvoiceCard}
        emptyTitle={t.noInvoices}
        emptyDescription={
          lang === "ar"
            ? "ستظهر فواتيرك هنا بمجرد إصدار أول اشتراك."
            : "Your invoices appear here once your first subscription is billed."
        }
      />

      {/* Invoice Detail Modal */}
      {viewInvoice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-card w-full max-w-2xl rounded-xl shadow-2xl border border-border animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto" dir={lang === "ar" ? "rtl" : "ltr"}>
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-lg font-bold text-foreground">
                {lang === "ar" ? "تفاصيل الفاتورة" : "Invoice Details"} — {viewInvoice.invoiceNumber}
              </h2>
              <IconButton
                icon={X}
                aria-label={lang === "ar" ? "إغلاق" : "Close"}
                variant="ghost"
                onClick={() => setViewInvoice(null)}
                className="text-muted-foreground hover:text-foreground"
              />
            </div>
            <div id="invoice-detail-print" className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">{t.invoiceNumber}</p>
                  <p className="font-semibold text-foreground">{viewInvoice.invoiceNumber}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t.date}</p>
                  <p className="font-semibold text-foreground">
                    {viewInvoice.issuedAt ? new Date(viewInvoice.issuedAt).toLocaleDateString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-US") : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t.status}</p>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${(statusConfig[viewInvoice.status] ?? statusConfig.DRAFT!).color}`}>
                    {lang === "ar" ? (statusConfig[viewInvoice.status] ?? statusConfig.DRAFT!).labelAr : (statusConfig[viewInvoice.status] ?? statusConfig.DRAFT!).labelEn}
                  </span>
                </div>
                {viewInvoice.dueDate && (
                  <div>
                    <p className="text-muted-foreground">{lang === "ar" ? "تاريخ الاستحقاق" : "Due Date"}</p>
                    <p className="font-semibold text-foreground">{new Date(viewInvoice.dueDate).toLocaleDateString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-US")}</p>
                  </div>
                )}
              </div>

              {/* Line Items */}
              {viewInvoice.lineItems && viewInvoice.lineItems.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-foreground mb-3">{lang === "ar" ? "البنود" : "Line Items"}</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{lang === "ar" ? "الوصف" : "Description"}</TableHead>
                        <TableHead className="text-end">{lang === "ar" ? "الكمية" : "Qty"}</TableHead>
                        <TableHead className="text-end">{lang === "ar" ? "السعر" : "Price"}</TableHead>
                        <TableHead className="text-end">{t.total}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewInvoice.lineItems.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{item.description}</TableCell>
                          <TableCell className="text-end">{item.quantity}</TableCell>
                          <TableCell className="text-end">{Number(item.unitPrice).toLocaleString()} {t.sar}</TableCell>
                          <TableCell className="text-end font-medium">{Number(item.total).toLocaleString()} {t.sar}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Totals */}
              <div className="border-t border-border pt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t.subtotal}</span>
                  <span className="font-medium">{Number(viewInvoice.subtotal).toLocaleString()} {t.sar}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t.vat}</span>
                  <span className="font-medium">{Number(viewInvoice.vatAmount).toLocaleString()} {t.sar}</span>
                </div>
                {viewInvoice.discount > 0 && (
                  <div className="flex justify-between text-success">
                    <span>{lang === "ar" ? "الخصم" : "Discount"}</span>
                    <span>-{Number(viewInvoice.discount).toLocaleString()} {t.sar}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold border-t border-border pt-2">
                  <span>{t.total}</span>
                  <span>{Number(viewInvoice.total).toLocaleString()} {t.sar}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
              <Button variant="secondary" size="sm" style={{ display: "inline-flex" }} onClick={() => setViewInvoice(null)}>
                {lang === "ar" ? "إغلاق" : "Close"}
              </Button>
              <Button
                variant="primary"
                size="sm"
                style={{ display: "inline-flex" }}
                className="gap-2"
                onClick={async () => {
                  await exportToPDF({
                    elementId: "invoice-detail-print",
                    filename: `Invoice_${viewInvoice.invoiceNumber}`,
                    title: lang === "ar" ? `فاتورة ${viewInvoice.invoiceNumber}` : `Invoice ${viewInvoice.invoiceNumber}`,
                    lang,
                  });
                }}
              >
                <Download className="w-4 h-4" />
                {lang === "ar" ? "تحميل PDF" : "Download PDF"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
    </>
  );
}

// ─── Translations ────────────────────────────────────────────────────────────

const translations = {
  ar: {
    title: "الفواتير",
    subtitle: "عرض وتحميل جميع فواتيرك",
    backToBilling: "العودة للفوترة",
    noInvoices: "لا توجد فواتير",
    invoiceNumber: "رقم الفاتورة",
    date: "التاريخ",
    status: "الحالة",
    subtotal: "المجموع الفرعي",
    vat: "ضريبة القيمة المضافة",
    total: "الإجمالي",
    actions: "إجراءات",
    sar: "ر.س",
    view: "عرض",
    download: "تحميل",
    showing: "عرض",
    of: "من",
  },
  en: {
    title: "Invoices",
    subtitle: "View and download all your invoices",
    backToBilling: "Back to Billing",
    noInvoices: "No invoices yet",
    invoiceNumber: "Invoice #",
    date: "Date",
    status: "Status",
    subtotal: "Subtotal",
    vat: "VAT (15%)",
    total: "Total",
    actions: "Actions",
    sar: "SAR",
    view: "View",
    download: "Download",
    showing: "Showing",
    of: "of",
  },
};
