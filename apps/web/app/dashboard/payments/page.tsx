"use client";

import * as React from "react";
import {
  Loader2,
  Search,
  X,
  CreditCard,
  TrendingUp,
  AlertCircle,
  AlertTriangle,
  Plus,
} from "lucide-react";
import {
  Button,
  Badge,
  Input,
  Card,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  PageIntro,
  KPICard,
  ResponsiveDialog,
  AppBar,
  MobileKPICard,
  MobileTabs,
  DataCard,
  FAB,
  EmptyState,
  SARAmount,
  SARAmountInput,
  Skeleton,
  Alert,
  AlertDescription,
} from "@repo/ui";
import { useLanguage } from "../../../components/LanguageProvider";
import { usePermissions } from "../../../hooks/usePermissions";
import { getInstallments, recordPayment } from "../../actions/installments";
import { getPaymentPlan, recordInstallmentPayment } from "../../actions/payment-plans";
import { toast } from "sonner";

const SAR = (amount: number) =>
  new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR" }).format(amount);

// ─── Types ───────────────────────────────────────────────────────────────────

type RentInstallment = {
  id: string;
  dueDate: string;
  amount: number;
  status: "PAID" | "UNPAID" | "OVERDUE" | "PARTIALLY_PAID";
  paidAt: string | null;
  paymentMethod: string | null;
  leaseId: string;
  lease: {
    customer: { id: string; name: string };
    unit: { number: string; buildingName: string | null };
  };
};

type PaymentEntry = {
  id: string;
  type: "rent";
  clientName: string;
  propertyLabel: string;
  amount: number;
  dueDate: string;
  status: "PAID" | "UNPAID" | "OVERDUE" | "PARTIALLY_PAID";
  raw: RentInstallment;
};

// ─── Semantic row-tone helper (CLAUDE.md § 6.12 Finance colors) ─────────────
// Maps a payment entry's status + due-date proximity to a tuple of row classes:
//   - rowClass: start-edge border + subtle bg tint
//   - amountClass: emphasis on the amount cell
//   - dueDateClass: strike-through / muted / tinted for the "due by" cell
type PaymentTone = {
  rowClass: string;
  amountClass: string;
  dueDateClass: string;
};

function getPaymentTone(entry: {
  status: "PAID" | "UNPAID" | "OVERDUE" | "PARTIALLY_PAID";
  dueDate: string;
}): PaymentTone {
  const now = new Date();
  const due = new Date(entry.dueDate);
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysUntilDue = Math.floor((due.getTime() - now.getTime()) / msPerDay);

  // Collected / Paid — green start-border, strike-through due-by
  if (entry.status === "PAID") {
    return {
      rowClass: "border-s-4 border-s-secondary",
      amountClass: "text-foreground",
      dueDateClass: "line-through text-muted-foreground",
    };
  }

  // Overdue — destructive start-border + emphasized amount
  // (status === OVERDUE, or unpaid/partial with due date in the past)
  const isPastDue =
    entry.status === "OVERDUE" ||
    ((entry.status === "UNPAID" || entry.status === "PARTIALLY_PAID") && daysUntilDue < 0);

  if (isPastDue) {
    return {
      rowClass: "border-s-4 border-s-destructive",
      amountClass: "text-destructive font-semibold",
      dueDateClass: "text-destructive",
    };
  }

  // Aging — warning start-border (unpaid and due within next 30 days,
  //         or 1-30 days past due already handled above)
  const isAging =
    (entry.status === "UNPAID" || entry.status === "PARTIALLY_PAID") &&
    daysUntilDue >= 0 &&
    daysUntilDue <= 30;

  if (isAging) {
    return {
      rowClass: "border-s-4 border-s-warning",
      amountClass: "text-warning",
      dueDateClass: "text-warning",
    };
  }

  // Scheduled / Future — neutral, no start-border tint
  return {
    rowClass: "",
    amountClass: "text-foreground",
    dueDateClass: "text-muted-foreground",
  };
}

const STATUS_COLORS: Record<string, string> = {
  PAID: "bg-green-100 text-green-800",
  UNPAID: "bg-amber-100 text-amber-800",
  OVERDUE: "bg-red-100 text-red-800",
  PARTIALLY_PAID: "bg-orange-100 text-orange-800",
};

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  PAID: { ar: "مدفوع", en: "Paid" },
  UNPAID: { ar: "غير مدفوع", en: "Upcoming" },
  OVERDUE: { ar: "متأخر", en: "Overdue" },
  PARTIALLY_PAID: { ar: "مدفوع جزئياً", en: "Partially Paid" },
};

const PAYMENT_METHODS = [
  { value: "CASH", ar: "نقد", en: "Cash" },
  { value: "BANK_TRANSFER", ar: "تحويل بنكي", en: "Bank Transfer" },
  { value: "CHECK", ar: "شيك", en: "Check" },
  { value: "CARD", ar: "بطاقة", en: "Card" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function PaymentsPage() {
  const { lang, dir } = useLanguage();
  const { can } = usePermissions();

  const [rentInstallments, setRentInstallments] = React.useState<RentInstallment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [typeFilter, setTypeFilter] = React.useState<"ALL" | "SALE" | "RENT">("ALL");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [search, setSearch] = React.useState("");

  // Record payment modal
  const [paymentTarget, setPaymentTarget] = React.useState<PaymentEntry | null>(null);
  const [payForm, setPayForm] = React.useState({
    amount: "",
    paymentDate: new Date().toISOString().split("T")[0],
    paymentMethod: "BANK_TRANSFER",
    referenceNumber: "",
    notes: "",
  });
  const [submitting, setSubmitting] = React.useState(false);

  function loadData() {
    setLoading(true);
    setLoadError(null);
    getInstallments()
      .then((data) => setRentInstallments(data as RentInstallment[]))
      .catch(() => {
        const msg = lang === "ar" ? "تعذّر تحميل المدفوعات" : "Failed to load payments";
        setLoadError(msg);
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  }

  React.useEffect(() => {
    loadData();
  }, []);

  // Combine rent installments into unified payment entries
  const allEntries: PaymentEntry[] = React.useMemo(() => {
    return rentInstallments.map((inst) => ({
      id: inst.id,
      type: "rent" as const,
      clientName: inst.lease.customer.name,
      propertyLabel: `${lang === "ar" ? "وحدة" : "Unit"} ${inst.lease.unit.number}${inst.lease.unit.buildingName ? ` — ${inst.lease.unit.buildingName}` : ""}`,
      amount: Number(inst.amount),
      dueDate: inst.dueDate,
      status: inst.status,
      raw: inst,
    }));
  }, [rentInstallments, lang]);

  const filtered = React.useMemo(() => {
    return allEntries.filter((e) => {
      const matchType = typeFilter === "ALL" || (typeFilter === "RENT" && e.type === "rent");
      const matchStatus = statusFilter === "ALL" || e.status === statusFilter;
      const q = search.toLowerCase();
      const matchSearch = !q || e.clientName.toLowerCase().includes(q) || e.propertyLabel.toLowerCase().includes(q);
      return matchType && matchStatus && matchSearch;
    });
  }, [allEntries, typeFilter, statusFilter, search]);

  // KPIs
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const collectedThisMonth = allEntries
    .filter((e) => e.status === "PAID" && e.raw.paidAt && new Date(e.raw.paidAt) >= thisMonthStart)
    .reduce((sum, e) => sum + e.amount, 0);

  const totalOverdue = allEntries
    .filter((e) => e.status === "OVERDUE")
    .reduce((sum, e) => sum + e.amount, 0);

  const expectedNext30 = allEntries
    .filter((e) => {
      const due = new Date(e.dueDate);
      return (e.status === "UNPAID" || e.status === "PARTIALLY_PAID") && due >= now && due <= next30Days;
    })
    .reduce((sum, e) => sum + e.amount, 0);

  function openPayModal(entry: PaymentEntry) {
    setPaymentTarget(entry);
    setPayForm({
      amount: String(entry.amount),
      paymentDate: new Date().toISOString().split("T")[0],
      paymentMethod: "BANK_TRANSFER",
      referenceNumber: "",
      notes: "",
    });
  }

  async function handleRecordPayment() {
    if (!paymentTarget) return;
    if (!payForm.amount || !payForm.paymentDate || !payForm.paymentMethod) {
      toast.error(lang === "ar" ? "يرجى تعبئة جميع الحقول المطلوبة" : "Please fill all required fields");
      return;
    }
    setSubmitting(true);
    try {
      if (paymentTarget.type === "rent") {
        await recordPayment(paymentTarget.id, {
          paymentMethod: payForm.paymentMethod,
          amount: parseFloat(payForm.amount),
        });
      }
      toast.success(lang === "ar" ? "تم تسجيل الدفعة بنجاح" : "Payment recorded successfully");
      setPaymentTarget(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || (lang === "ar" ? "حدث خطأ أثناء التسجيل" : "Failed to record payment"));
    } finally {
      setSubmitting(false);
    }
  }

  const typeTabs = [
    { key: "ALL", ar: "الكل", en: "All" },
    { key: "SALE", ar: "أقساط البيع", en: "Sale Installments" },
    { key: "RENT", ar: "دفعات الإيجار", en: "Rent Payments" },
  ];

  const statusTabs = [
    { key: "ALL", ar: "الكل", en: "All" },
    { key: "OVERDUE", ar: "متأخر", en: "Overdue" },
    { key: "UNPAID", ar: "قادم", en: "Upcoming" },
    { key: "PAID", ar: "مدفوع", en: "Paid" },
  ];

  // Mobile-only helpers
  const overdueCount = allEntries.filter((e) => e.status === "OVERDUE").length;
  const receivedCount = allEntries.filter(
    (e) => e.status === "PAID" && e.raw.paidAt && new Date(e.raw.paidAt) >= thisMonthStart,
  ).length;

  const mobileTabItems = statusTabs.map((t) => ({
    key: t.key,
    label: lang === "ar" ? t.ar : t.en,
  }));

  function handleMobileFab() {
    const actionable = allEntries.find(
      (e) => e.status === "OVERDUE" || e.status === "UNPAID" || e.status === "PARTIALLY_PAID",
    );
    if (actionable) {
      openPayModal(actionable);
    } else {
      toast.info(
        lang === "ar"
          ? "لا توجد دفعات مستحقة حالياً."
          : "No payments are due right now.",
      );
    }
  }

  function statusBadgeVariant(
    status: PaymentEntry["status"],
  ): "success" | "pending" | "overdue" | "warning" | "default" {
    switch (status) {
      case "PAID":
        return "success";
      case "OVERDUE":
        return "overdue";
      case "UNPAID":
        return "pending";
      case "PARTIALLY_PAID":
        return "warning";
      default:
        return "default";
    }
  }

  function methodLabel(method: string | null): string | null {
    if (!method) return null;
    const found = PAYMENT_METHODS.find((m) => m.value === method);
    if (!found) return method;
    return lang === "ar" ? found.ar : found.en;
  }

  const canWritePayments = can("payments:write");

  return (
    <>
    {/* ─── Mobile (< md) ─────────────────────────────────────────────── */}
    <div
      className="md:hidden -m-4 sm:-m-6 min-h-dvh flex flex-col bg-background"
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <AppBar
        title={lang === "ar" ? "المدفوعات" : "Payments"}
        lang={lang}
      />

      <div className="px-4 pt-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground start-3"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              lang === "ar"
                ? "بحث بالاسم أو العقار..."
                : "Search by client or property..."
            }
            className="h-10 ps-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 pt-3">
        <MobileKPICard
          label={lang === "ar" ? "المُحصَّل هذا الشهر" : "Collected this month"}
          value={
            <SARAmount value={collectedThisMonth} size={18} compact className="tabular-nums" />
          }
          tone="green"
        />
        <MobileKPICard
          label={lang === "ar" ? "متأخرات" : "Outstanding"}
          value={
            <SARAmount value={totalOverdue} size={18} compact className="tabular-nums" />
          }
          tone="red"
        />
        <MobileKPICard
          label={lang === "ar" ? "عدد المتأخرات" : "Overdue count"}
          value={<span className="tabular-nums">{overdueCount}</span>}
          tone="amber"
        />
        <MobileKPICard
          label={lang === "ar" ? "المستلمة هذا الشهر" : "Received"}
          value={<span className="tabular-nums">{receivedCount}</span>}
          tone="primary"
        />
      </div>

      <div className="px-4 pt-3">
        <MobileTabs
          ariaLabel={lang === "ar" ? "تبويبات المدفوعات" : "Payments tabs"}
          active={statusFilter}
          onChange={setStatusFilter}
          items={mobileTabItems}
        />
      </div>

      <div className="flex-1 px-4 pb-24 pt-3">
        {loadError && (
          <Alert variant="destructive" className="mb-3">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        )}

        {loading && (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <EmptyState
            icon={<CreditCard className="h-10 w-10 text-primary" aria-hidden="true" />}
            title={lang === "ar" ? "لا توجد مدفوعات" : "No payments"}
            description={
              lang === "ar"
                ? "لا توجد مدفوعات مطابقة للتصفية الحالية."
                : "No payments match the current filter."
            }
          />
        )}

        {!loading && filtered.length > 0 && (
          <div className="rounded-2xl border border-border bg-card px-4">
            {filtered.map((entry, idx) => {
              const method = methodLabel(entry.raw.paymentMethod);
              const badgeVariant = statusBadgeVariant(entry.status);
              const statusLabel =
                lang === "ar"
                  ? STATUS_LABELS[entry.status]?.ar ?? entry.status
                  : STATUS_LABELS[entry.status]?.en ?? entry.status;
              const dueLabel = new Date(entry.dueDate).toLocaleDateString(
                lang === "ar" ? "ar-SA" : "en-SA",
              );
              const iconTone =
                entry.status === "PAID"
                  ? "green"
                  : entry.status === "OVERDUE"
                    ? "red"
                    : entry.status === "PARTIALLY_PAID"
                      ? "amber"
                      : "purple";

              const subtitleParts: React.ReactNode[] = [
                entry.clientName,
                `${lang === "ar" ? "استحقاق" : "Due"}: ${dueLabel}`,
              ];
              if (method) {
                subtitleParts.push(
                  <Badge key="method" variant="outline" size="sm">
                    {method}
                  </Badge>,
                );
              }

              return (
                <DataCard
                  key={entry.id}
                  icon={CreditCard}
                  iconTone={iconTone}
                  divider={idx !== filtered.length - 1}
                  title={
                    <SARAmount
                      value={entry.amount}
                      size={14}
                      className="font-semibold text-foreground tabular-nums"
                    />
                  }
                  subtitle={subtitleParts}
                  trailing={
                    <Badge variant={badgeVariant} size="sm">
                      {statusLabel}
                    </Badge>
                  }
                  onClick={
                    canWritePayments && entry.status !== "PAID"
                      ? () => openPayModal(entry)
                      : undefined
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      {canWritePayments && (
        <FAB
          icon={Plus}
          label={lang === "ar" ? "تسجيل دفعة" : "Record payment"}
          onClick={handleMobileFab}
        />
      )}
    </div>

    {/* ─── Desktop (≥ md) ─ unchanged ───────────────────────────────── */}
    <div className="hidden md:block">
    <div dir={dir} className="p-6 space-y-6">
      <PageIntro
        title={lang === "ar" ? "المدفوعات" : "Payments"}
        description={
          lang === "ar"
            ? "تتبع مدفوعات الأقساط والإيجارات في مكان واحد"
            : "Track sale installments and rent payments in one place"
        }
      />

      {/* KPI Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 flex items-start gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <TrendingUp className="w-5 h-5 text-green-700" />
          </div>
          <div>
            <p className="text-xs text-gray-500">{lang === "ar" ? "المُحصَّل هذا الشهر" : "Collected This Month"}</p>
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mt-1 text-gray-400" />
            ) : (
              <p className="text-xl font-bold text-gray-900 mt-0.5">{SAR(collectedThisMonth)}</p>
            )}
          </div>
        </Card>

        <Card className="p-4 flex items-start gap-3">
          <div className="p-2 bg-red-100 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-700" />
          </div>
          <div>
            <p className="text-xs text-gray-500">{lang === "ar" ? "إجمالي المتأخرات" : "Total Overdue"}</p>
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mt-1 text-gray-400" />
            ) : (
              <p className="text-xl font-bold text-red-700 mt-0.5">{SAR(totalOverdue)}</p>
            )}
          </div>
        </Card>

        <Card className="p-4 flex items-start gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <CreditCard className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <p className="text-xs text-gray-500">{lang === "ar" ? "المتوقع خلال 30 يوماً" : "Expected Next 30 Days"}</p>
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mt-1 text-gray-400" />
            ) : (
              <p className="text-xl font-bold text-gray-900 mt-0.5">{SAR(expectedNext30)}</p>
            )}
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 space-y-3">
        {/* Type tabs */}
        <div className="flex flex-wrap gap-2">
          {typeTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setTypeFilter(tab.key as typeof typeFilter)}
              className={[
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                typeFilter === tab.key
                  ? "bg-purple-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200",
              ].join(" ")}
            >
              {lang === "ar" ? tab.ar : tab.en}
            </button>
          ))}
        </div>

        {/* Status + Search row */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex flex-wrap gap-2">
            {statusTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={[
                  "px-3 py-1 rounded-md text-xs font-medium transition-colors border",
                  statusFilter === tab.key
                    ? "border-purple-600 bg-purple-50 text-purple-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300",
                ].join(" ")}
              >
                {lang === "ar" ? tab.ar : tab.en}
              </button>
            ))}
          </div>

          <div className="relative ms-auto">
            <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-gray-400 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={lang === "ar" ? "بحث بالاسم أو العقار..." : "Search by client or property..."}
              className="ps-9 w-56"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute top-1/2 -translate-y-1/2 end-3 text-gray-400 hover:text-gray-600"
                aria-label={lang === "ar" ? "مسح البحث" : "Clear search"}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
          </div>
        ) : filtered.length === 0 ? (
          allEntries.length === 0 ? (
            <EmptyState
              icon={<CreditCard className="h-12 w-12" aria-hidden="true" />}
              title={lang === "ar" ? "لا توجد مدفوعات بعد" : "No payments yet"}
              description={
                lang === "ar"
                  ? "ستظهر أقساط الإيجار والبيع هنا بمجرد تفعيل أول عقد."
                  : "Rent and sale installments show up here once contracts are active."
              }
              helpHref="/dashboard/help#payments"
              helpLabel={lang === "ar" ? "تعرّف على المدفوعات" : "Learn about payments"}
            />
          ) : (
            <EmptyState
              variant="filtered"
              icon={<CreditCard className="h-12 w-12" aria-hidden="true" />}
              title={lang === "ar" ? "لا توجد نتائج مطابقة" : "No matching payments"}
              description={
                lang === "ar"
                  ? "جرّب تعديل البحث أو التبويب."
                  : "Try adjusting your search or tab."
              }
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch("");
                    setTypeFilter("ALL");
                    setStatusFilter("ALL");
                  }}
                  style={{ display: "inline-flex" }}
                >
                  {lang === "ar" ? "مسح الفلاتر" : "Clear filters"}
                </Button>
              }
            />
          )
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{lang === "ar" ? "العميل" : "Client"}</TableHead>
                <TableHead>{lang === "ar" ? "العقار" : "Property"}</TableHead>
                <TableHead>{lang === "ar" ? "النوع" : "Type"}</TableHead>
                <TableHead>{lang === "ar" ? "المبلغ" : "Amount (SAR)"}</TableHead>
                <TableHead>{lang === "ar" ? "تاريخ الاستحقاق" : "Due Date"}</TableHead>
                <TableHead>{lang === "ar" ? "الحالة" : "Status"}</TableHead>
                <TableHead>{lang === "ar" ? "الإجراءات" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((entry) => {
                const tone = getPaymentTone(entry);
                return (
                <TableRow key={entry.id} className={tone.rowClass}>
                  <TableCell className="font-medium">{entry.clientName}</TableCell>
                  <TableCell className="text-sm text-gray-600">{entry.propertyLabel}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      {entry.type === "rent"
                        ? lang === "ar" ? "إيجار" : "Rent"
                        : lang === "ar" ? "بيع" : "Sale"}
                    </span>
                  </TableCell>
                  <TableCell className={`font-medium ${tone.amountClass}`}>{SAR(entry.amount)}</TableCell>
                  <TableCell className={`text-sm ${tone.dueDateClass}`}>
                    {new Date(entry.dueDate).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-SA")}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[entry.status]}`}>
                      {lang === "ar" ? (STATUS_LABELS[entry.status]?.ar ?? entry.status) : (STATUS_LABELS[entry.status]?.en ?? entry.status)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {can("payments:write") && entry.status !== "PAID" && (
                      <button
                        onClick={() => openPayModal(entry)}
                        className="text-xs text-purple-600 hover:text-purple-800 font-medium transition-colors"
                      >
                        {lang === "ar" ? "تسجيل دفعة" : "Record Payment"}
                      </button>
                    )}
                    {entry.status === "PAID" && (
                      <span className="text-xs text-gray-400">{lang === "ar" ? "مُسدَّد" : "Settled"}</span>
                    )}
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Record Payment Modal */}
      <ResponsiveDialog
        open={!!paymentTarget}
        onOpenChange={(open) => !open && setPaymentTarget(null)}
        title={lang === "ar" ? "تسجيل دفعة" : "Record Payment"}
        contentClassName="sm:max-w-[640px]"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setPaymentTarget(null)}
              style={{ display: "inline-flex" }}
            >
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              type="submit"
              form="record-payment-form"
              disabled={submitting}
              style={{ display: "inline-flex" }}
              className="gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {lang === "ar" ? "تسجيل الدفعة" : "Record Payment"}
            </Button>
          </div>
        }
      >
        {paymentTarget && (
          <form
            id="record-payment-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleRecordPayment();
            }}
            className="space-y-4 py-2"
          >
            {/* Summary */}
            <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm space-y-1">
              <p className="text-gray-500">{lang === "ar" ? "العميل" : "Client"}: <span className="text-gray-900 font-medium">{paymentTarget.clientName}</span></p>
              <p className="text-gray-500">{lang === "ar" ? "العقار" : "Property"}: <span className="text-gray-900 font-medium">{paymentTarget.propertyLabel}</span></p>
              <p className="text-gray-500">{lang === "ar" ? "المبلغ المستحق" : "Due Amount"}: <span className="text-gray-900 font-medium">{SAR(paymentTarget.amount)}</span></p>
            </div>

            {/* Amount */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                {lang === "ar" ? "المبلغ المدفوع (ريال)" : "Payment Amount (SAR)"} *
              </label>
              <SARAmountInput
                value={payForm.amount === "" ? null : Number(payForm.amount)}
                onChange={(n) => setPayForm((f) => ({ ...f, amount: n == null ? "" : String(n) }))}
                placeholder="0.00"
              />
            </div>

            {/* Payment Date */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                {lang === "ar" ? "تاريخ الدفع" : "Payment Date"} *
              </label>
              <Input
                type="date"
                value={payForm.paymentDate}
                onChange={(e) => setPayForm((f) => ({ ...f, paymentDate: e.target.value }))}
              />
            </div>

            {/* Payment Method */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                {lang === "ar" ? "طريقة الدفع" : "Payment Method"} *
              </label>
              <select
                value={payForm.paymentMethod}
                onChange={(e) => setPayForm((f) => ({ ...f, paymentMethod: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {lang === "ar" ? m.ar : m.en}
                  </option>
                ))}
              </select>
            </div>

            {/* Reference Number */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                {lang === "ar" ? "رقم المرجع" : "Reference Number"}
              </label>
              <Input
                value={payForm.referenceNumber}
                onChange={(e) => setPayForm((f) => ({ ...f, referenceNumber: e.target.value }))}
                placeholder={lang === "ar" ? "رقم التحويل أو الشيك..." : "Transfer or check number..."}
              />
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                {lang === "ar" ? "ملاحظات" : "Notes"}
              </label>
              <textarea
                value={payForm.notes}
                onChange={(e) => setPayForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder={lang === "ar" ? "ملاحظات اختيارية..." : "Optional notes..."}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </form>
        )}
      </ResponsiveDialog>
    </div>
    </div>
    </>
  );
}
