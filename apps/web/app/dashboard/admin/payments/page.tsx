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
  FileText,
  ShieldAlert,
  CreditCard,
} from "lucide-react";
import {
  Button,
  Card,
  AppBar,
  DataCard,
  EmptyState,
  MobileKPICard,
  MobileTabs,
  Skeleton,
  SARAmount,
  Badge,
  DirectionalIcon,
  DataTable,
  type ColumnDef,
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
  organization: { id: string; name: string; nameArabic: string | null } | null;
  subscription: { plan: { nameEn: string; nameAr: string } } | null;
};

const statusConfig: Record<
  string,
  { label: { ar: string; en: string }; className: string }
> = {
  PAID: {
    label: { ar: "مدفوعة", en: "Paid" },
    className: "bg-success/15 text-success-strong",
  },
  ISSUED: {
    label: { ar: "صادرة", en: "Issued" },
    className: "bg-info/15 text-info-strong",
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
  return date.toLocaleDateString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const invoiceBadgeVariant = (
  s: Invoice["status"]
): "success" | "info" | "warning" | "error" | "default" => {
  if (s === "PAID") return "success";
  if (s === "ISSUED") return "info";
  if (s === "OVERDUE") return "error";
  if (s === "CANCELED") return "error";
  return "default";
};

export default function AdminPaymentsPage() {
  const { t, lang } = useLanguage();
  const { data: session } = useSession();
  const userRole = session?.user?.role ?? "";
  const authorized = isSystemRole(userRole);
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [mobileFilter, setMobileFilter] = React.useState<
    "ALL" | "PAID" | "ISSUED" | "OVERDUE" | "CANCELED"
  >("ALL");
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
    return () => {
      active = false;
    };
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
    { key: "ALL", label: t("الكل", "All") },
    { key: "PAID", label: t("مدفوعة", "Paid") },
    { key: "ISSUED", label: t("صادرة", "Issued") },
    { key: "OVERDUE", label: t("متأخرة", "Overdue") },
    { key: "CANCELED", label: t("ملغاة", "Canceled") },
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
  const successRate =
    totalCount > 0 ? Math.round((paidInvCount / totalCount) * 100) : 0;

  // ── DataTable columns ─────────────────────────────────────────────────
  const columns = React.useMemo<ColumnDef<Invoice>[]>(
    () => [
      {
        accessorKey: "invoiceNumber",
        header: t("رقم الفاتورة", "Invoice #"),
        enableSorting: true,
        enableHiding: false,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-foreground">
            {row.original.invoiceNumber}
          </span>
        ),
      },
      {
        id: "organization",
        header: t("المنظمة", "Organization"),
        enableSorting: true,
        cell: ({ row }) => (
          <span className="text-foreground">
            {lang === "ar"
              ? row.original.organization?.nameArabic ||
                row.original.organization?.name ||
                "-"
              : row.original.organization?.name ||
                row.original.organization?.nameArabic ||
                "-"}
          </span>
        ),
      },
      {
        id: "plan",
        header: t("الخطة", "Plan"),
        enableSorting: true,
        cell: ({ row }) => (
          <span className="text-foreground">
            {lang === "ar"
              ? row.original.subscription?.plan?.nameAr ?? "-"
              : row.original.subscription?.plan?.nameEn ?? "-"}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: t("الحالة", "Status"),
        enableSorting: true,
        cell: ({ row }) => {
          const sc = statusConfig[row.original.status] ?? {
            label: { ar: "مسودة", en: "Draft" },
            className: "bg-muted text-muted-foreground",
          };
          return (
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${sc.className}`}
            >
              {sc.label[lang]}
            </span>
          );
        },
      },
      {
        accessorKey: "subtotal",
        header: t("المبلغ", "Subtotal"),
        enableSorting: true,
        meta: { numeric: true },
        cell: ({ row }) => (
          <span className="font-mono text-xs text-foreground">
            {formatCurrency(row.original.subtotal, lang)}
          </span>
        ),
      },
      {
        accessorKey: "vatAmount",
        header: t("الضريبة", "VAT"),
        enableSorting: true,
        meta: { numeric: true },
        cell: ({ row }) => (
          <span className="font-mono text-xs text-foreground">
            {formatCurrency(row.original.vatAmount, lang)}
          </span>
        ),
      },
      {
        accessorKey: "total",
        header: t("الإجمالي", "Total"),
        enableSorting: true,
        meta: { numeric: true },
        cell: ({ row }) => (
          <span className="font-mono text-xs font-semibold text-foreground">
            {formatCurrency(row.original.total, lang)}
          </span>
        ),
      },
      {
        accessorKey: "issuedAt",
        header: t("تاريخ الإصدار", "Issued"),
        enableSorting: true,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">
            {formatDate(row.original.issuedAt, lang)}
          </span>
        ),
      },
      {
        accessorKey: "dueDate",
        header: t("تاريخ الاستحقاق", "Due Date"),
        enableSorting: true,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">
            {formatDate(row.original.dueDate, lang)}
          </span>
        ),
      },
    ],
    [lang]
  );

  // ── Mobile card renderer ──────────────────────────────────────────────
  const mobileCard = React.useCallback(
    (inv: Invoice) => {
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
          icon={CreditCard}
          iconTone="purple"
          title={
            <span className="inline-flex items-center gap-2">
              <SARAmount
                value={Number(inv.total)}
                size={14}
                className="tabular-nums"
              />
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
        />
      );
    },
    [lang]
  );

  return (
    <>
      {/* ─── Mobile (< md) ─────────────────────────────────────────────── */}
      <div
        className="md:hidden -m-4 sm:-m-6 min-h-dvh flex flex-col bg-background"
        dir={lang === "ar" ? "rtl" : "ltr"}
      >
        <AppBar title={t("المدفوعات", "Payments")} lang={lang} />

        {!authorized ? (
          <div className="flex-1 px-4 pt-10">
            <EmptyState
              icon={<ShieldAlert className="h-10 w-10" aria-hidden="true" />}
              title={t("غير مصرح", "Unauthorized")}
              description={
                t("هذه الصفحة متاحة لفريق المنصة فقط.", "This page is available to platform staff only.")
              }
            />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 px-4 pt-3">
              <MobileKPICard
                label={t("الإيرادات", "Revenue")}
                value={
                  <SARAmount
                    value={paidMtd}
                    size={18}
                    compact
                    className="tabular-nums"
                  />
                }
                tone="green"
              />
              <MobileKPICard
                label={t("قيد الانتظار", "Pending")}
                value={<span className="tabular-nums">{issuedCount}</span>}
                tone="amber"
              />
              <MobileKPICard
                label={t("متأخرة", "Overdue")}
                value={<span className="tabular-nums">{overdueCount}</span>}
                tone="red"
              />
              <MobileKPICard
                label={t("معدل النجاح", "Success rate")}
                value={<span className="tabular-nums">{successRate}%</span>}
                tone="primary"
              />
            </div>

            <div className="px-4 pt-3">
              <MobileTabs
                ariaLabel={
                  t("تصفية المدفوعات", "Filter payments")
                }
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
                invoices.length === 0 ? (
                  <EmptyState
                    variant="first-time"
                    icon={<Receipt className="h-12 w-12" aria-hidden="true" />}
                    title={
                      t("لا توجد فواتير بعد", "No invoices yet")
                    }
                    description={
                      t("ستظهر فواتير اشتراكات المستأجرين هنا فور إصدارها.", "Tenant subscription invoices appear here once issued.")
                    }
                  />
                ) : (
                  <EmptyState
                    variant="filtered"
                    icon={<Receipt className="h-10 w-10" aria-hidden="true" />}
                    title={
                      t("لا توجد نتائج مطابقة", "No matching invoices")
                    }
                    description={
                      t("جرّب تعديل التصفية.", "Try adjusting the filter.")
                    }
                    action={
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setMobileFilter("ALL")}
                        style={{ display: "inline-flex" }}
                      >
                        {t("مسح الفلاتر", "Clear filters")}
                      </Button>
                    }
                  />
                )
              ) : (
                <div className="rounded-2xl border border-border bg-card px-4">
                  {mobileInvoices.map((inv, idx) => {
                    const orgName =
                      lang === "ar"
                        ? inv.organization?.nameArabic ||
                          inv.organization?.name ||
                          "—"
                        : inv.organization?.name ||
                          inv.organization?.nameArabic ||
                          "—";
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
                            <SARAmount
                              value={Number(inv.total)}
                              size={14}
                              className="tabular-nums"
                            />
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {inv.invoiceNumber}
                            </span>
                          </span>
                        }
                        subtitle={[orgName, planName, issued]}
                        trailing={
                          <Badge
                            variant={invoiceBadgeVariant(inv.status)}
                            size="sm"
                          >
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
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    style={{ display: "inline-flex", minHeight: "44px" }}
                  >
                    {t("السابق", "Previous")}
                  </Button>
                  <span className="tabular-nums">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    style={{ display: "inline-flex", minHeight: "44px" }}
                  >
                    {t("التالي", "Next")}
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ─── Desktop (≥ md) ────────────────────────────────────────────── */}
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
            {t("إدارة المنصة", "Platform Administration")}
          </Link>

          {/* Header */}
          <div className="flex items-start gap-4 px-2">
            <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Receipt className="h-7 w-7" />
            </div>
            <PageHeader
              className="flex-1"
              title={
                t("الفواتير والمدفوعات", "Invoices & Payments")
              }
              description={
                t("عرض جميع الفواتير والمعاملات المالية عبر جميع المنظمات", "View all invoices and payment transactions across all organizations")
              }
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, i) => (
              <Card key={i} className="p-5 flex items-center gap-4">
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

          {/* DataTable */}
          <Card className="overflow-hidden">
            <DataTable
              columns={columns}
              data={invoices}
              loading={loading}
              locale={lang === "ar" ? "ar" : "en"}
              pagination
              pageSize={10}
              getRowId={(r) => r.id}
              mobileCard={mobileCard}
              emptyTitle={
                t("لا توجد فواتير بعد", "No invoices yet")
              }
              emptyDescription={
                t("ستظهر فواتير اشتراكات المستأجرين هنا فور إصدارها.", "Tenant subscription invoices appear here once issued.")
              }
            />
          </Card>
        </div>
      </div>
    </>
  );
}
