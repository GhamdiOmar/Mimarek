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
  CheckCircle,
  Undo2,
} from "lucide-react";
import {
  Button,
  Badge,
  Input,
  Card,
  PageIntro,
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
  IconButton,
  DataTable,
  ConfirmDialog,
  SelectField,
  HijriDatePicker,
  type ColumnDef,
} from "@repo/ui";
import { useLanguage } from "../../../components/LanguageProvider";
import { usePermissions } from "../../../hooks/usePermissions";
import {
  getInstallments,
  recordPayment,
  bulkMarkInstallmentsPaid,
  reverseRentPayment,
} from "../../actions/installments";
import {
  getSavedViews,
  createSavedView,
  deleteSavedView,
  type SavedTableViewDTO,
} from "../../actions/saved-views";
import { exportToExcel } from "../../../lib/export";
import { toast } from "sonner";
import {
  PAYMENT_STATUS_LABEL as STATUS_LABELS,
  PAYMENT_STATUS_VARIANT as STATUS_VARIANT,
} from "../../../lib/domain-labels";
import { sanitizeError } from "../../../lib/error-sanitizer";
import { trackEvent, AnalyticsEvent } from "../../../lib/analytics";

const SAR = (amount: number) =>
  new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR" }).format(amount);

// ─── Types ───────────────────────────────────────────────────────────────────

type RentInstallment = {
  id: string;
  dueDate: string;
  amount: number;
  paidAmount: number | null;
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

  // Collected / Paid — no side-shading (v4.11): the strike-through due-by + the
  // status pill carry it; a paid row needs no alerting tint.
  if (entry.status === "PAID") {
    return {
      rowClass: "",
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
      rowClass: "bg-destructive/5",
      amountClass: "text-destructive-strong font-semibold",
      dueDateClass: "text-destructive-strong",
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
      rowClass: "bg-warning/5",
      amountClass: "text-warning-strong",
      dueDateClass: "text-warning-strong",
    };
  }

  // Scheduled / Future — neutral, no start-border tint
  return {
    rowClass: "",
    amountClass: "text-foreground",
    dueDateClass: "text-muted-foreground",
  };
}


const PAYMENT_METHODS = [
  { value: "CASH", ar: "نقد", en: "Cash" },
  { value: "BANK_TRANSFER", ar: "تحويل بنكي", en: "Bank Transfer" },
  { value: "CHECK", ar: "شيك", en: "Check" },
  { value: "CARD", ar: "بطاقة", en: "Card" },
];

// ─── Component ────────────────────────────────────────────────────────────────

type PaymentsViewProps = { initialInstallments: RentInstallment[] };

export default function PaymentsView({ initialInstallments }: PaymentsViewProps) {
  const { t, lang, dir } = useLanguage();
  const { can } = usePermissions();

  const [rentInstallments, setRentInstallments] = React.useState<RentInstallment[]>(initialInstallments);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // CX-014 — DataTable saved views (personal, DB-backed)
  const [savedViews, setSavedViews] = React.useState<SavedTableViewDTO[]>([]);
  const refreshSavedViews = React.useCallback(() => {
    getSavedViews("payments")
      .then(setSavedViews)
      .catch(() => {});
  }, []);
  React.useEffect(() => {
    refreshSavedViews();
  }, [refreshSavedViews]);

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
  // Modal-scoped idempotency key: minted once per modal open so double-submit
  // replays safely on the server (same key → server short-circuits, no double-write).
  const paymentReferenceRef = React.useRef<string>("");

  // Reverse-payment modal (I2 — append-only ledger reversal). Writes a negative
  // ledger entry via reverseRentPayment; idempotency keyed like record-payment.
  const [reverseTarget, setReverseTarget] = React.useState<PaymentEntry | null>(null);
  const [reverseForm, setReverseForm] = React.useState({ amount: "", reason: "" });
  const [reverseSubmitting, setReverseSubmitting] = React.useState(false);
  const reverseReferenceRef = React.useRef<string>("");

  // Bulk mark-paid state
  const [bulkMarkPaidOpen, setBulkMarkPaidOpen] = React.useState(false);
  const [bulkSelected, setBulkSelected] = React.useState<PaymentEntry[]>([]);
  const [bulkWorking, setBulkWorking] = React.useState(false);

  async function handleBulkMarkPaid() {
    if (!bulkSelected.length) return;
    setBulkWorking(true);
    try {
      const result = await bulkMarkInstallmentsPaid(bulkSelected.map((e) => e.id));
      toast.success(
        t(`تم تسجيل ${result.updated} دفعة`, `${result.updated} payment(s) marked as paid`)
      );
      setBulkMarkPaidOpen(false);
      setBulkSelected([]);
      loadData();
    } catch (err: unknown) {
      toast.error(sanitizeError(err, lang));
    } finally {
      setBulkWorking(false);
    }
  }

  function loadData() {
    setLoading(true);
    setLoadError(null);
    getInstallments()
      .then((data) => setRentInstallments(data as RentInstallment[]))
      .catch(() => {
        const msg = t("تعذّر تحميل المدفوعات", "Failed to load payments");
        setLoadError(msg);
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  }

  // Initial installments arrive as props from the RSC server shell (CX-003 pt1 —
  // no first-paint client mount-fetch). `loadData()` is kept for post-mutation
  // refresh (record payment, bulk mark-paid) below.

  // Combine rent installments into unified payment entries
  const allEntries: PaymentEntry[] = React.useMemo(() => {
    return rentInstallments.map((inst) => ({
      id: inst.id,
      type: "rent" as const,
      clientName: inst.lease.customer.name,
      propertyLabel: `${t("وحدة", "Unit")} ${inst.lease.unit.number}${inst.lease.unit.buildingName ? ` — ${inst.lease.unit.buildingName}` : ""}`,
      amount: Number(inst.amount),
      dueDate: inst.dueDate,
      status: inst.status,
      raw: inst,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` is derived from `lang`, which is already a dep; listing `lang` covers every translation read here.
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
    // Mint a fresh idempotency key each time a new modal opens.
    // Double-click on the same open modal reuses the same key → server replay.
    paymentReferenceRef.current = crypto.randomUUID();
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
      toast.error(t("يرجى تعبئة جميع الحقول المطلوبة", "Please fill all required fields"));
      return;
    }
    setSubmitting(true);
    try {
      if (paymentTarget.type === "rent") {
        await recordPayment(paymentTarget.id, {
          paymentMethod: payForm.paymentMethod,
          amount: parseFloat(payForm.amount),
          paymentDate: payForm.paymentDate,
          referenceNumber: payForm.referenceNumber || undefined,
          notes: payForm.notes || undefined,
          paymentReference: paymentReferenceRef.current,
        });
      }
      trackEvent(AnalyticsEvent.PaymentRecorded, {
        method: payForm.paymentMethod,
        amount: Number(parseFloat(payForm.amount)),
      });
      toast.success(t("تم تسجيل الدفعة بنجاح", "Payment recorded successfully"));
      setPaymentTarget(null);
      loadData();
    } catch (err: unknown) {
      toast.error(sanitizeError(err, lang));
    } finally {
      setSubmitting(false);
    }
  }

  function openReverseModal(entry: PaymentEntry) {
    // Fresh idempotency key per open (double-submit → server replay, no double-write).
    reverseReferenceRef.current = crypto.randomUUID();
    setReverseTarget(entry);
    // Default to the amount currently collected on this installment.
    const collected = Number(entry.raw.paidAmount ?? entry.amount);
    setReverseForm({ amount: String(collected), reason: "" });
  }

  async function handleReversePayment() {
    if (!reverseTarget) return;
    const amount = parseFloat(reverseForm.amount);
    if (!amount || amount <= 0) {
      toast.error(t("أدخل مبلغًا صالحًا للعكس", "Enter a valid amount to reverse"));
      return;
    }
    if (!reverseForm.reason.trim()) {
      toast.error(t("سبب العكس مطلوب", "A reason for the reversal is required"));
      return;
    }
    setReverseSubmitting(true);
    try {
      await reverseRentPayment(reverseTarget.id, {
        amount,
        reason: reverseForm.reason.trim(),
        idempotencyKey: reverseReferenceRef.current,
        txType: "REVERSAL",
      });
      toast.success(t("تم عكس الدفعة", "Payment reversed"));
      setReverseTarget(null);
      loadData();
    } catch (err: unknown) {
      toast.error(sanitizeError(err, lang));
    } finally {
      setReverseSubmitting(false);
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
        t("لا توجد دفعات مستحقة حالياً.", "No payments are due right now."),
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

  // ─── DataTable columns ────────────────────────────────────────────────────
  const columns = React.useMemo<ColumnDef<PaymentEntry>[]>(
    () => [
      {
        accessorKey: "clientName",
        header: t("العميل", "Client"),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.clientName}</span>
        ),
        enableSorting: true,
        enableHiding: true,
      },
      {
        accessorKey: "propertyLabel",
        header: t("العقار", "Property"),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.propertyLabel}</span>
        ),
        enableSorting: true,
        enableHiding: true,
      },
      {
        accessorKey: "type",
        header: t("النوع", "Type"),
        cell: ({ row }) => (
          <Badge variant="info" size="sm">
            {row.original.type === "rent"
              ? t("إيجار", "Rent")
              : t("بيع", "Sale")}
          </Badge>
        ),
        enableSorting: false,
        enableHiding: true,
        getGroupingValue: (row: PaymentEntry) =>
          row.type === "rent"
            ? t("إيجار", "Rent")
            : t("بيع", "Sale"),
      },
      {
        accessorKey: "amount",
        header: t("المبلغ", "Amount (SAR)"),
        cell: ({ row }) => {
          const tone = getPaymentTone(row.original);
          return (
            <span className={`font-medium ${tone.amountClass}`}>
              {SAR(row.original.amount)}
            </span>
          );
        },
        enableSorting: true,
        enableHiding: true,
        meta: { numeric: true },
      },
      {
        accessorKey: "dueDate",
        header: t("تاريخ الاستحقاق", "Due Date"),
        cell: ({ row }) => {
          const tone = getPaymentTone(row.original);
          return (
            <span className={`text-sm ${tone.dueDateClass}`}>
              {new Date(row.original.dueDate).toLocaleDateString(
                lang === "ar" ? "ar-SA-u-nu-latn" : "en-SA",
              )}
            </span>
          );
        },
        enableSorting: true,
        enableHiding: true,
      },
      {
        accessorKey: "status",
        header: t("الحالة", "Status"),
        cell: ({ row }) => (
          <Badge variant={STATUS_VARIANT[row.original.status] ?? "default"} size="sm">
            {lang === "ar"
              ? (STATUS_LABELS[row.original.status]?.ar ?? row.original.status)
              : (STATUS_LABELS[row.original.status]?.en ?? row.original.status)}
          </Badge>
        ),
        enableSorting: true,
        enableHiding: true,
        getGroupingValue: (row: PaymentEntry) =>
          lang === "ar"
            ? STATUS_LABELS[row.status]?.ar ?? row.status
            : STATUS_LABELS[row.status]?.en ?? row.status,
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const entry = row.original;
          if (!canWritePayments) {
            return entry.status === "PAID" ? (
              <span className="text-xs text-muted-foreground">{t("مُسدَّد", "Settled")}</span>
            ) : null;
          }
          // record-payment when anything is still owed; reverse when money has been
          // collected (PAID or PARTIALLY_PAID). Forward action first, destructive last (§6.6.7).
          const canRecord = entry.status !== "PAID";
          const canReverse = entry.status === "PAID" || entry.status === "PARTIALLY_PAID";
          if (!canRecord && !canReverse) return null;
          return (
            <div className="flex items-center justify-end gap-1">
              {canRecord && (
                <IconButton
                  icon={CreditCard}
                  aria-label={t("تسجيل دفعة", "Record payment")}
                  variant="ghost"
                  onClick={() => openPayModal(entry)}
                  className="text-primary"
                />
              )}
              {canReverse && (
                <IconButton
                  icon={Undo2}
                  aria-label={t("عكس الدفعة", "Reverse payment")}
                  variant="ghost"
                  onClick={() => openReverseModal(entry)}
                  className="text-destructive"
                />
              )}
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` is derived from `lang`, which is already a dep; listing `lang` covers every translation read here.
    [lang, canWritePayments],
  );

  // ─── DataTable mobileCard ─────────────────────────────────────────────────
  function renderMobileCard(entry: PaymentEntry, divider = false) {
    const method = methodLabel(entry.raw.paymentMethod);
    const badgeVariant = statusBadgeVariant(entry.status);
    const statusLabel =
      lang === "ar"
        ? STATUS_LABELS[entry.status]?.ar ?? entry.status
        : STATUS_LABELS[entry.status]?.en ?? entry.status;
    const dueLabel = new Date(entry.dueDate).toLocaleDateString(
      lang === "ar" ? "ar-SA-u-nu-latn" : "en-SA",
    );
    const iconTone =
      entry.status === "PAID"
        ? "green"
        : entry.status === "OVERDUE"
          ? "red"
          : entry.status === "PARTIALLY_PAID"
            ? "amber"
            : "primary";

    const subtitleParts: React.ReactNode[] = [
      entry.clientName,
      `${t("استحقاق", "Due")}: ${dueLabel}`,
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
        icon={CreditCard}
        iconTone={iconTone}
        divider={divider}
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
  }

  return (
    <>
    {/* ─── Mobile (< md) ─────────────────────────────────────────────── */}
    <div
      className="md:hidden -m-4 sm:-m-6 min-h-dvh flex flex-col bg-background"
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <AppBar
        title={t("المدفوعات", "Payments")}
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
              t("بحث بالاسم أو العقار...", "Search by client or property...")
            }
            className="h-10 ps-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 pt-3">
        <MobileKPICard
          label={t("المُحصَّل هذا الشهر", "Collected this month")}
          value={
            <SARAmount value={collectedThisMonth} size={18} compact className="tabular-nums" />
          }
          tone="green"
        />
        <MobileKPICard
          label={t("متأخرات", "Outstanding")}
          value={
            <SARAmount value={totalOverdue} size={18} compact className="tabular-nums" />
          }
          tone="red"
        />
        <MobileKPICard
          label={t("عدد المتأخرات", "Overdue count")}
          value={<span className="tabular-nums">{overdueCount}</span>}
          tone="amber"
        />
        <MobileKPICard
          label={t("المستلمة هذا الشهر", "Received")}
          value={<span className="tabular-nums">{receivedCount}</span>}
          tone="primary"
        />
      </div>

      <div className="px-4 pt-3">
        <MobileTabs
          ariaLabel={t("تبويبات المدفوعات", "Payments tabs")}
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
          allEntries.length === 0 ? (
            <EmptyState
              variant="first-time"
              icon={<CreditCard className="h-12 w-12" aria-hidden="true" />}
              title={t("لا توجد مدفوعات بعد", "No payments yet")}
              description={
                t("ستظهر أقساط الإيجار والبيع هنا بمجرد تفعيل أول عقد.", "Rent and sale installments show up here once contracts are active.")
              }
              helpHref="/dashboard/help#payments"
              helpLabel={t("تعرّف على المدفوعات", "Learn about payments")}
            />
          ) : (
            <EmptyState
              variant="filtered"
              icon={<Search className="h-12 w-12" aria-hidden="true" />}
              title={t("لا توجد نتائج مطابقة", "No matching payments")}
              description={
                t("جرّب تعديل البحث أو التبويب.", "Try adjusting your search or tab.")
              }
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setTypeFilter("ALL");
                    setStatusFilter("ALL");
                  }}
                  style={{ display: "inline-flex" }}
                >
                  {t("مسح الفلاتر", "Clear filters")}
                </Button>
              }
            />
          )
        )}

        {!loading && filtered.length > 0 && (
          <div className="rounded-2xl border border-border bg-card px-4">
            {filtered.map((entry, idx) => (
              <React.Fragment key={entry.id}>
                {renderMobileCard(entry, idx !== filtered.length - 1)}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {canWritePayments && (
        <FAB
          icon={Plus}
          label={t("تسجيل دفعة", "Record payment")}
          onClick={handleMobileFab}
        />
      )}
    </div>

    {/* ─── Desktop (≥ md) ─ unchanged ───────────────────────────────── */}
    <div className="hidden md:block">
    <div dir={dir} className="p-6 space-y-6">
      <PageIntro
        title={t("المدفوعات", "Payments")}
        description={
          t("تتبع مدفوعات الأقساط والإيجارات في مكان واحد", "Track sale installments and rent payments in one place")
        }
      />

      {/* KPI Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 flex items-start gap-3">
          <div className="p-2 bg-success/15 rounded-lg">
            <TrendingUp className="w-5 h-5 text-success" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("المُحصَّل هذا الشهر", "Collected This Month")}</p>
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mt-1 text-muted-foreground" />
            ) : (
              <p className="text-xl font-bold text-foreground mt-0.5">{SAR(collectedThisMonth)}</p>
            )}
          </div>
        </Card>

        <Card className="p-4 flex items-start gap-3">
          <div className="p-2 bg-destructive/15 rounded-lg">
            <AlertCircle className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("إجمالي المتأخرات", "Total Overdue")}</p>
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mt-1 text-muted-foreground" />
            ) : (
              <p className="text-xl font-bold text-destructive-strong mt-0.5">{SAR(totalOverdue)}</p>
            )}
          </div>
        </Card>

        <Card className="p-4 flex items-start gap-3">
          <div className="p-2 bg-warning/15 rounded-lg">
            <CreditCard className="w-5 h-5 text-warning" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("المتوقع خلال 30 يوماً", "Expected Next 30 Days")}</p>
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mt-1 text-muted-foreground" />
            ) : (
              <p className="text-xl font-bold text-foreground mt-0.5">{SAR(expectedNext30)}</p>
            )}
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 space-y-3">
        {/* Type tabs */}
        <div className="flex flex-wrap gap-2">
          {typeTabs.map((tab) => (
            <Button
              key={tab.key}
              variant={typeFilter === tab.key ? "primary" : "subtle"}
              size="sm"
              onClick={() => setTypeFilter(tab.key as typeof typeFilter)}
              aria-pressed={typeFilter === tab.key}
              className="rounded-full"
              style={{ display: "inline-flex" }}
            >
              {lang === "ar" ? tab.ar : tab.en}
            </Button>
          ))}
        </div>

        {/* Status + Search row */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex flex-wrap gap-2">
            {statusTabs.map((tab) => (
              <Button
                key={tab.key}
                variant={statusFilter === tab.key ? "primary" : "subtle"}
                size="sm"
                onClick={() => setStatusFilter(tab.key)}
                aria-pressed={statusFilter === tab.key}
                className="rounded-full"
                style={{ display: "inline-flex" }}
              >
                {lang === "ar" ? tab.ar : tab.en}
              </Button>
            ))}
          </div>

          <div className="relative ms-auto">
            <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("بحث بالاسم أو العقار...", "Search by client or property...")}
              className="ps-9 w-56"
            />
            {search && (
              <IconButton
                icon={X}
                aria-label={t("مسح البحث", "Clear search")}
                variant="ghost"
                onClick={() => setSearch("")}
                className="absolute top-1/2 -translate-y-1/2 end-3 text-muted-foreground hover:text-foreground h-6 w-6"
              />
            )}
          </div>
        </div>
      </Card>

      {/* Table */}
      {loading ? (
        <Card>
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        </Card>
      ) : filtered.length === 0 && allEntries.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CreditCard className="h-12 w-12" aria-hidden="true" />}
            title={t("لا توجد مدفوعات بعد", "No payments yet")}
            description={
              t("ستظهر أقساط الإيجار والبيع هنا بمجرد تفعيل أول عقد.", "Rent and sale installments show up here once contracts are active.")
            }
            helpHref="/dashboard/help#payments"
            helpLabel={t("تعرّف على المدفوعات", "Learn about payments")}
          />
        </Card>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          mobileCard={renderMobileCard}
          rowClassName={(r) => getPaymentTone(r).rowClass}
          locale={lang === "ar" ? "ar" : "en"}
          groupableColumns={[
            { id: "status", label: t("الحالة", "Status") },
            { id: "type", label: t("النوع", "Type") },
          ]}
          pagination
          pageSize={10}
          getRowId={(r) => r.id}
          enableSelection
          bulkActions={(selected) => (
            <div className="flex items-center gap-2">
              {canWritePayments && (
                <Button
                  size="sm"
                  variant="success"
                  style={{ display: "inline-flex" }}
                  className="gap-1"
                  disabled={bulkWorking}
                  onClick={() => {
                    setBulkSelected(selected as PaymentEntry[]);
                    setBulkMarkPaidOpen(true);
                  }}
                >
                  {bulkWorking
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <CheckCircle className="h-3.5 w-3.5" />}
                  {t(`تسجيل كمدفوع (${selected.length})`, `Mark as paid (${selected.length})`)}
                </Button>
              )}
            </div>
          )}
          enableColumnReorder
          exportable
          onExport={({ rows, columns: exportColumns }) =>
            exportToExcel({
              filename: `payments-${new Date().toISOString().slice(0, 10)}`,
              title: t("المدفوعات", "Payments"),
              lang,
              columns: exportColumns.map((c) => ({ header: c.header, key: c.id })),
              data: rows.map((r) => ({
                clientName: r.clientName,
                propertyLabel: r.propertyLabel,
                type:
                  r.type === "rent"
                    ? t("إيجار", "Rent")
                    : t("بيع", "Sale"),
                amount: SAR(r.amount),
                dueDate: new Date(r.dueDate).toLocaleDateString(
                  lang === "ar" ? "ar-SA-u-nu-latn" : "en-SA",
                ),
                status:
                  lang === "ar"
                    ? STATUS_LABELS[r.status]?.ar ?? r.status
                    : STATUS_LABELS[r.status]?.en ?? r.status,
              })),
            })
          }
          savedViews={{
            tableKey: "payments",
            views: savedViews,
            onCreate: async (name, config) => {
              await createSavedView({ tableKey: "payments", name, config });
              refreshSavedViews();
            },
            onDelete: async (id) => {
              await deleteSavedView(id);
              refreshSavedViews();
            },
          }}
          emptyTitle={t("لا توجد نتائج مطابقة", "No matching payments")}
          emptyDescription={
            t("جرّب تعديل البحث أو التبويب.", "Try adjusting your search or tab.")
          }
        />
      )}

      {/* Record Payment Modal */}
      <ResponsiveDialog
        open={!!paymentTarget}
        onOpenChange={(open) => !open && setPaymentTarget(null)}
        title={t("تسجيل دفعة", "Record Payment")}
        contentClassName="sm:max-w-[640px]"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setPaymentTarget(null)}
              style={{ display: "inline-flex" }}
            >
              {t("إلغاء", "Cancel")}
            </Button>
            <Button
              type="submit"
              form="record-payment-form"
              disabled={submitting}
              style={{ display: "inline-flex" }}
              className="gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {t("تسجيل الدفعة", "Record Payment")}
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
            <div className="bg-muted rounded-lg px-4 py-3 text-sm space-y-1">
              <p className="text-muted-foreground">{t("العميل", "Client")}: <span className="text-foreground font-medium">{paymentTarget.clientName}</span></p>
              <p className="text-muted-foreground">{t("العقار", "Property")}: <span className="text-foreground font-medium">{paymentTarget.propertyLabel}</span></p>
              <p className="text-muted-foreground">{t("المبلغ المستحق", "Due Amount")}: <span className="text-foreground font-medium">{SAR(paymentTarget.amount)}</span></p>
            </div>

            {/* Amount */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">
                {t("المبلغ المدفوع (ريال)", "Payment Amount (SAR)")} *
              </label>
              <SARAmountInput
                value={payForm.amount === "" ? null : Number(payForm.amount)}
                onChange={(n) => setPayForm((f) => ({ ...f, amount: n == null ? "" : String(n) }))}
                placeholder="0.00"
              />
            </div>

            {/* Payment Date */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">
                {t("تاريخ الدفع", "Payment Date")} *
              </label>
              <HijriDatePicker
                locale={lang === "ar" ? "ar" : "en"}
                value={payForm.paymentDate ? new Date(payForm.paymentDate) : null}
                onChange={(d) =>
                  setPayForm((f) => ({
                    ...f,
                    paymentDate: d ? d.toISOString().slice(0, 10) : "",
                  }))
                }
              />
            </div>

            {/* Payment Method */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">
                {t("طريقة الدفع", "Payment Method")} *
              </label>
              <SelectField
                aria-label={t("طريقة الدفع", "Payment Method")}
                value={payForm.paymentMethod}
                onChange={(e) => setPayForm((f) => ({ ...f, paymentMethod: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {lang === "ar" ? m.ar : m.en}
                  </option>
                ))}
              </SelectField>
            </div>

            {/* Reference Number */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">
                {t("رقم المرجع", "Reference Number")}
              </label>
              <Input
                value={payForm.referenceNumber}
                onChange={(e) => setPayForm((f) => ({ ...f, referenceNumber: e.target.value }))}
                placeholder={t("رقم التحويل أو الشيك...", "Transfer or check number...")}
              />
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">
                {t("ملاحظات", "Notes")}
              </label>
              <textarea
                value={payForm.notes}
                onChange={(e) => setPayForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder={t("ملاحظات اختيارية...", "Optional notes...")}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
              />
            </div>
          </form>
        )}
      </ResponsiveDialog>

      {/* Reverse Payment Modal (I2 — writes a negative ledger entry, no record deleted) */}
      <ResponsiveDialog
        open={!!reverseTarget}
        onOpenChange={(open) => !open && setReverseTarget(null)}
        title={t("عكس دفعة", "Reverse Payment")}
        contentClassName="sm:max-w-[560px]"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setReverseTarget(null)}
              style={{ display: "inline-flex" }}
            >
              {t("إلغاء", "Cancel")}
            </Button>
            <Button
              type="submit"
              form="reverse-payment-form"
              variant="destructive"
              disabled={reverseSubmitting}
              style={{ display: "inline-flex" }}
              className="gap-2"
            >
              {reverseSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {t("عكس الدفعة", "Reverse Payment")}
            </Button>
          </div>
        }
      >
        {reverseTarget && (
          <form
            id="reverse-payment-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleReversePayment();
            }}
            className="space-y-4 py-2"
          >
            <Alert variant="warning">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {t(
                  "يسجّل العكس قيدًا عكسيًا في سجل المدفوعات ويُحدّث حالة القسط. لا يُحذف أي سجل.",
                  "Reversing writes a negative entry to the payment ledger and updates the installment status. No record is deleted.",
                )}
              </AlertDescription>
            </Alert>

            {/* Summary */}
            <div className="bg-muted rounded-lg px-4 py-3 text-sm space-y-1">
              <p className="text-muted-foreground">
                {t("العميل", "Client")}:{" "}
                <span className="text-foreground font-medium">{reverseTarget.clientName}</span>
              </p>
              <p className="text-muted-foreground">
                {t("العقار", "Property")}:{" "}
                <span className="text-foreground font-medium">{reverseTarget.propertyLabel}</span>
              </p>
              <p className="text-muted-foreground">
                {t("المبلغ المُحصّل", "Collected")}:{" "}
                <span className="text-foreground font-medium">
                  {SAR(Number(reverseTarget.raw.paidAmount ?? reverseTarget.amount))}
                </span>
              </p>
            </div>

            {/* Reversal amount */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">
                {t("مبلغ العكس (ريال)", "Reversal Amount (SAR)")} *
              </label>
              <SARAmountInput
                value={reverseForm.amount === "" ? null : Number(reverseForm.amount)}
                onChange={(n) =>
                  setReverseForm((f) => ({ ...f, amount: n == null ? "" : String(n) }))
                }
                placeholder="0.00"
              />
            </div>

            {/* Reason (required) */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">
                {t("سبب العكس", "Reason for reversal")} *
              </label>
              <textarea
                value={reverseForm.reason}
                onChange={(e) => setReverseForm((f) => ({ ...f, reason: e.target.value }))}
                rows={2}
                required
                placeholder={t("مثال: دفعة مُسجّلة بالخطأ", "e.g. payment recorded by mistake")}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
              />
            </div>
          </form>
        )}
      </ResponsiveDialog>
    </div>
    </div>

    {/* Bulk Mark Paid Confirm — financial action, always gated */}
    <ConfirmDialog
      open={bulkMarkPaidOpen}
      onOpenChange={setBulkMarkPaidOpen}
      title={
        t(`تسجيل ${bulkSelected.length} دفعة كمدفوعة`, `Mark ${bulkSelected.length} payment(s) as paid`)
      }
      description={
        t(`سيتم تسجيل ${bulkSelected.length} قسط كمدفوع بالمبلغ الكامل. الأقساط المسدّدة بالفعل لن تتأثر.`, `${bulkSelected.length} installment(s) will be marked as fully paid. Already-paid installments will be skipped.`)
      }
      confirmLabel={t("تسجيل كمدفوع", "Mark as paid")}
      cancelLabel={t("تراجع", "Go back")}
      onConfirm={handleBulkMarkPaid}
    />
    </>
  );
}
