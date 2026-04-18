"use client";

import { useLanguage } from "../../../../components/LanguageProvider";
import { useSession } from "../../../../components/SimpleSessionProvider";
import { isSystemRole } from "../../../../lib/permissions";
import * as React from "react";
import {
  ArrowLeft,
  Receipt,
  CircleDollarSign,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  FileText,
  ShieldAlert,
  CreditCard,
} from "lucide-react";
import {
  Button,
  Card,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  AppBar,
  DataCard,
  EmptyState,
  MobileKPICard,
  MobileTabs,
  Skeleton,
  SARAmount,
  Badge,
  DirectionalIcon,
} from "@repo/ui";
import { PageHeader } from "@repo/ui/components/PageHeader";
import Link from "next/link";
import { adminGetAllInvoices } from "../../../actions/billing";

type Invoice = {
  id: string;
  invoiceNumber: string;
  status: "DRAFT" | "ISSUED" | "PAID" | "OVERDUE" | "CANCELED";
  billingCycle: string;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  discountAmount: number;
  total: number;
  currency: string;
  issuedAt: string | null;
  dueDate: string | null;
  paidAt: string | null;
  organization: { id: string; name: string; nameArabic: string | null } | null;
  subscription: { plan: { nameEn: string; nameAr: string } } | null;
};

const statusConfig: Record<
  string,
  { label: { ar: string; en: string }; className: string }
> = {
  PAID: {
    label: { ar: "مدفوعة", en: "Paid" },
    className: "bg-success/15 text-success",
  },
  ISSUED: {
    label: { ar: "صادرة", en: "Issued" },
    className: "bg-info/15 text-info",
  },
  OVERDUE: {
    label: { ar: "متأخرة", en: "Overdue" },
    className: "bg-destructive/15 text-destructive",
  },
  DRAFT: {
    label: { ar: "مسودة", en: "Draft" },
    className: "bg-muted text-muted-foreground",
  },
  CANCELED: {
    label: { ar: "ملغاة", en: "Canceled" },
    className: "bg-destructive/15 text-destructive",
  },
};

function formatCurrency(amount: number, lang: "ar" | "en"): string {
  const formatted = Number(amount).toLocaleString("en-SA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return lang === "ar" ? `${formatted} ر.س` : `SAR ${formatted}`;
}

function formatDate(dateStr: string | null, lang: "ar" | "en"): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AdminPaymentsPage() {
  const { lang } = useLanguage();
  const { data: session } = useSession();
  const userRole = session?.user?.role ?? "";
  const authorized = isSystemRole(userRole);
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [mobileFilter, setMobileFilter] = React.useState<"ALL" | "PAID" | "ISSUED" | "OVERDUE" | "CANCELED">("ALL");
  const pageSize = 50;

  React.useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const data = await adminGetAllInvoices(page, pageSize);
        if (active) {
          setInvoices(data.invoices);
          setTotalPages(data.totalPages);
          setTotal(data.total);
          setPage(data.page);
        }
      } catch {
        // Permission or fetch error — leave empty
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [page]);

  // Computed stats
  const totalRevenue = invoices
    .filter((inv) => inv.status === "PAID")
    .reduce((sum, inv) => sum + Number(inv.total), 0);

  const paidCount = invoices.filter((inv) => inv.status === "PAID").length;
  const overdueCount = invoices.filter(
    (inv) => inv.status === "OVERDUE"
  ).length;

  const stats = [
    {
      label: { ar: "إجمالي الإيرادات", en: "Total Revenue" },
      value: formatCurrency(totalRevenue, lang),
      icon: CircleDollarSign,
      color: "text-success",
      bg: "bg-success/15",
    },
    {
      label: { ar: "إجمالي الفواتير", en: "Total Invoices" },
      value: total.toString(),
      icon: FileText,
      color: "text-info",
      bg: "bg-info/15",
    },
    {
      label: { ar: "مدفوعة", en: "Paid" },
      value: paidCount.toString(),
      icon: CheckCircle2,
      color: "text-success",
      bg: "bg-success/15",
    },
    {
      label: { ar: "متأخرة", en: "Overdue" },
      value: overdueCount.toString(),
      icon: AlertTriangle,
      color: "text-destructive",
      bg: "bg-destructive/15",
    },
  ];

  // ── Mobile helpers ────────────────────────────────────────────────────
  const mobileTabItems = [
    { key: "ALL", label: lang === "ar" ? "الكل" : "All" },
    { key: "PAID", label: lang === "ar" ? "مدفوعة" : "Paid" },
    { key: "ISSUED", label: lang === "ar" ? "صادرة" : "Issued" },
    { key: "OVERDUE", label: lang === "ar" ? "متأخرة" : "Overdue" },
    { key: "CANCELED", label: lang === "ar" ? "ملغاة" : "Canceled" },
  ];

  const mobileInvoices =
    mobileFilter === "ALL"
      ? invoices
      : invoices.filter((inv) => inv.status === mobileFilter);

  const paidMtd = invoices
    .filter((inv) => inv.status === "PAID")
    .reduce((sum, inv) => sum + Number(inv.total), 0);
  const issuedCount = invoices.filter((inv) => inv.status === "ISSUED").length;
  const paidInvCount = invoices.filter((inv) => inv.status === "PAID").length;
  const totalCount = invoices.length || 0;
  const successRate = totalCount > 0 ? Math.round((paidInvCount / totalCount) * 100) : 0;

  const invoiceBadgeVariant = (s: Invoice["status"]): "success" | "info" | "warning" | "error" | "default" => {
    if (s === "PAID") return "success";
    if (s === "ISSUED") return "info";
    if (s === "OVERDUE") return "error";
    if (s === "CANCELED") return "error";
    return "default";
  };

  return (
    <>
    {/* ─── Mobile (< md) ─────────────────────────────────────────────── */}
    <div
      className="md:hidden -m-4 sm:-m-6 min-h-dvh flex flex-col bg-background"
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <AppBar title={lang === "ar" ? "المدفوعات" : "Payments"} lang={lang} />

      {!authorized ? (
        <div className="flex-1 px-4 pt-10">
          <EmptyState
            icon={<ShieldAlert className="h-10 w-10" aria-hidden="true" />}
            title={lang === "ar" ? "غير مصرح" : "Unauthorized"}
            description={
              lang === "ar"
                ? "هذه الصفحة متاحة لفريق المنصة فقط."
                : "This page is available to platform staff only."
            }
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 px-4 pt-3">
            <MobileKPICard
              label={lang === "ar" ? "الإيرادات" : "Revenue"}
              value={<SARAmount value={paidMtd} size={18} compact className="tabular-nums" />}
              tone="green"
            />
            <MobileKPICard
              label={lang === "ar" ? "قيد الانتظار" : "Pending"}
              value={<span className="tabular-nums">{issuedCount}</span>}
              tone="amber"
            />
            <MobileKPICard
              label={lang === "ar" ? "متأخرة" : "Overdue"}
              value={<span className="tabular-nums">{overdueCount}</span>}
              tone="red"
            />
            <MobileKPICard
              label={lang === "ar" ? "معدل النجاح" : "Success rate"}
              value={<span className="tabular-nums">{successRate}%</span>}
              tone="primary"
            />
          </div>

          <div className="px-4 pt-3">
            <MobileTabs
              ariaLabel={lang === "ar" ? "تصفية المدفوعات" : "Filter payments"}
              active={mobileFilter}
              onChange={(v) => setMobileFilter(v as typeof mobileFilter)}
              items={mobileTabItems}
            />
          </div>

          <div className="flex-1 px-4 pb-24 pt-3">
            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
            ) : mobileInvoices.length === 0 ? (
              <EmptyState
                icon={<Receipt className="h-10 w-10 text-primary" aria-hidden="true" />}
                title={lang === "ar" ? "لا توجد فواتير" : "No invoices"}
                description={
                  lang === "ar"
                    ? "لا توجد فواتير مطابقة للتصفية الحالية."
                    : "No invoices match the current filter."
                }
              />
            ) : (
              <div className="rounded-2xl border border-border bg-card px-4">
                {mobileInvoices.map((inv, idx) => {
                  const orgName =
                    lang === "ar"
                      ? inv.organization?.nameArabic || inv.organization?.name || "—"
                      : inv.organization?.name || inv.organization?.nameArabic || "—";
                  const planName =
                    lang === "ar"
                      ? inv.subscription?.plan?.nameAr ?? "—"
                      : inv.subscription?.plan?.nameEn ?? "—";
                  const issued = formatDate(inv.issuedAt, lang);
                  const sc = statusConfig[inv.status] ?? {
                    label: { ar: "مسودة", en: "Draft" },
                    className: "",
                  };
                  return (
                    <DataCard
                      key={inv.id}
                      icon={CreditCard}
                      iconTone="purple"
                      title={
                        <span className="inline-flex items-center gap-2">
                          <SARAmount value={Number(inv.total)} size={14} className="tabular-nums" />
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {inv.invoiceNumber}
                          </span>
                        </span>
                      }
                      subtitle={[orgName, planName, issued]}
                      trailing={
                        <Badge variant={invoiceBadgeVariant(inv.status)} size="sm">
                          {sc.label[lang]}
                        </Badge>
                      }
                      divider={idx !== mobileInvoices.length - 1}
                    />
                  );
                })}
              </div>
            )}

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="min-h-11 rounded-md border border-border px-3 py-1.5 font-medium disabled:opacity-40"
                >
                  {lang === "ar" ? "السابق" : "Previous"}
                </button>
                <span className="tabular-nums">{page} / {totalPages}</span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="min-h-11 rounded-md border border-border px-3 py-1.5 font-medium disabled:opacity-40"
                >
                  {lang === "ar" ? "التالي" : "Next"}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>

    {/* ─── Desktop (≥ md) ─ unchanged ───────────────────────────────── */}
    <div className="hidden md:block">
    <div
      className="space-y-8 animate-in fade-in duration-500"
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      {/* Back link */}
      <Link
        href="/dashboard/admin"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
      >
        <DirectionalIcon icon={ArrowLeft} className="h-4 w-4" />
        {lang === "ar" ? "إدارة المنصة" : "Platform Administration"}
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4 px-2">
        <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <Receipt className="h-7 w-7" />
        </div>
        <PageHeader
          className="flex-1"
          title={lang === "ar" ? "الفواتير والمدفوعات" : "Invoices & Payments"}
          description={
            lang === "ar"
              ? "عرض جميع الفواتير والمعاملات المالية عبر جميع المنظمات"
              : "View all invoices and payment transactions across all organizations"
          }
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card
            key={i}
            className="p-5 flex items-center gap-4"
          >
            <div
              className={`h-11 w-11 rounded-md ${stat.bg} flex items-center justify-center ${stat.color}`}
            >
              <stat.icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {stat.label[lang]}
              </p>
              <p className="text-xl font-bold text-foreground mt-0.5">
                {stat.value}
              </p>
            </div>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Receipt className="h-12 w-12 mb-4 opacity-40" />
            <p className="">
              {lang === "ar" ? "لا توجد فواتير" : "No invoices found"}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="">
                  {lang === "ar" ? "رقم الفاتورة" : "Invoice #"}
                </TableHead>
                <TableHead className="">
                  {lang === "ar" ? "المنظمة" : "Organization"}
                </TableHead>
                <TableHead className="">
                  {lang === "ar" ? "الخطة" : "Plan"}
                </TableHead>
                <TableHead className="">
                  {lang === "ar" ? "الحالة" : "Status"}
                </TableHead>
                <TableHead className="">
                  {lang === "ar" ? "المبلغ" : "Subtotal"}
                </TableHead>
                <TableHead className="">
                  {lang === "ar" ? "الضريبة" : "VAT"}
                </TableHead>
                <TableHead className="">
                  {lang === "ar" ? "الإجمالي" : "Total"}
                </TableHead>
                <TableHead className="">
                  {lang === "ar" ? "تاريخ الإصدار" : "Issued"}
                </TableHead>
                <TableHead className="">
                  {lang === "ar" ? "تاريخ الاستحقاق" : "Due Date"}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => {
                const sc = statusConfig[invoice.status] ?? { label: { ar: "مسودة", en: "Draft" }, className: "bg-muted text-muted-foreground" };
                return (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono text-xs text-foreground">
                      {invoice.invoiceNumber}
                    </TableCell>
                    <TableCell className="text-foreground">
                      {lang === "ar"
                        ? invoice.organization?.nameArabic ||
                          invoice.organization?.name ||
                          "-"
                        : invoice.organization?.name ||
                          invoice.organization?.nameArabic ||
                          "-"}
                    </TableCell>
                    <TableCell className="text-foreground">
                      {lang === "ar"
                        ? invoice.subscription?.plan?.nameAr ?? "-"
                        : invoice.subscription?.plan?.nameEn ?? "-"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${sc.className}`}
                      >
                        {sc.label[lang]}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-foreground">
                      {formatCurrency(invoice.subtotal, lang)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-foreground">
                      {formatCurrency(invoice.vatAmount, lang)}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-semibold text-foreground">
                      {formatCurrency(invoice.total, lang)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatDate(invoice.issuedAt, lang)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatDate(invoice.dueDate, lang)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-sm text-muted-foreground">
              {lang === "ar"
                ? `صفحة ${page} من ${totalPages} (${total} فاتورة)`
                : `Page ${page} of ${totalPages} (${total} invoices)`}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}

              >
                <DirectionalIcon icon={ChevronLeft} className="h-4 w-4" />
                {lang === "ar" ? "السابق" : "Previous"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}

              >
                {lang === "ar" ? "التالي" : "Next"}
                <DirectionalIcon icon={ChevronRight} className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
    </div>
    </>
  );
}
