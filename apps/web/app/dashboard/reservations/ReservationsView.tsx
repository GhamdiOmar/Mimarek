"use client";

import * as React from "react";
import {
  Plus,
  Loader2,
  Search,
  X,
  Ban,
  Eye,
  CheckCircle,
  FileSignature,
  Filter,
  Handshake,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import {
  Button,
  IconButton,
  Badge,
  Input,
  Card,
  DataTable,
  type ColumnDef,
  PageIntro,
  KPICard,
  ResponsiveDialog,
  AppBar,
  MobileKPICard,
  DataCard,
  FAB,
  EmptyState,
  SARAmount,
  SARAmountInput,
  Skeleton,
  BottomSheet,
  Alert,
  AlertDescription,
  ConfirmDialog,
  cn,
} from "@repo/ui";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLanguage } from "../../../components/LanguageProvider";
import { usePermissions } from "../../../hooks/usePermissions";
import { useUnsavedChanges } from "../../../hooks/useUnsavedChanges";
import {
  getReservations,
  createReservation,
  updateReservationStatus,
  bulkUpdateReservationStatus,
  bulkDeleteReservations,
} from "../../actions/reservations";
import { getCustomers } from "../../actions/customers";
import { getUnitsWithBuildings } from "../../actions/units";
import { getJourneySummary } from "../../actions/journey";
import {
  getSavedViews,
  createSavedView,
  deleteSavedView,
  type SavedTableViewDTO,
} from "../../actions/saved-views";
import { exportToExcel } from "../../../lib/export";
import type { JourneySummary } from "@repo/types";
import {
  RESERVATION_STATUS_LABEL as STATUS_LABELS,
  RESERVATION_STATUS_VARIANT as STATUS_VARIANT,
} from "../../../lib/domain-labels";
import {
  LifecycleRail,
  NextActionPanel,
  ProcessBlockerBanner,
  RelatedContextPanel,
} from "@repo/ui";
import { toast } from "sonner";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { sanitizeError } from "../../../lib/error-sanitizer";
import { trackEvent, AnalyticsEvent } from "../../../lib/analytics";

const SAR = (amount: number) =>
  new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR" }).format(amount);

type Reservation = {
  id: string;
  status: "PENDING" | "CONFIRMED" | "EXPIRED" | "CANCELLED";
  amount: number;
  depositAmount: number | null;
  expiresAt: string;
  createdAt: string;
  customer: { id: string; name: string };
  unit: {
    id: string;
    number: string;
    buildingName: string | null;
  };
};

type Customer = { id: string; name: string; phone?: string };
type Unit = { id: string; number: string; status: string; buildingId?: string };


type ReservationsViewProps = { initialReservations: Reservation[] };

export default function ReservationsView({ initialReservations }: ReservationsViewProps) {
  const { lang, dir } = useLanguage();
  const { can } = usePermissions();
  const searchParams = useSearchParams();
  const prefillCustomerId = searchParams.get("customerId");
  const prefillCustomerName = searchParams.get("customerName");
  const prefillUnitId = searchParams.get("unitId");
  const prefillAmount = searchParams.get("amount");

  // ── Zod schema (built per-render so messages use current lang) ────────
  const createSchema = React.useMemo(
    () =>
      z.object({
        customerId: z
          .string()
          .min(1, lang === "ar" ? "يرجى اختيار العميل" : "Customer is required"),
        unitId: z
          .string()
          .min(1, lang === "ar" ? "يرجى اختيار الوحدة" : "Unit is required"),
        amount: z
          .number({ invalid_type_error: lang === "ar" ? "أدخل قيمة صحيحة" : "Enter a valid amount" })
          .positive(lang === "ar" ? "يجب أن تكون القيمة أكبر من صفر" : "Amount must be greater than zero"),
        expiresAt: z
          .string()
          .min(1, lang === "ar" ? "تاريخ الانتهاء مطلوب" : "Expiry date is required"),
        notes: z.string().optional(),
      }),
    [lang],
  );

  type CreateFormValues = z.infer<typeof createSchema>;

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState,
  } = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    mode: "onTouched",
    defaultValues: {
      customerId: "",
      unitId: "",
      amount: null as unknown as number,
      expiresAt: "",
      notes: "",
    },
  });

  useUnsavedChanges(formState.isDirty);

  const [deals, setDeals] = React.useState<Reservation[]>(initialReservations);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");

  // CX-014 — DataTable saved views (personal, DB-backed)
  const [savedViews, setSavedViews] = React.useState<SavedTableViewDTO[]>([]);
  const refreshSavedViews = React.useCallback(() => {
    getSavedViews("reservations")
      .then(setSavedViews)
      .catch(() => {});
  }, []);
  React.useEffect(() => {
    refreshSavedViews();
  }, [refreshSavedViews]);
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [showMobileFilters, setShowMobileFilters] = React.useState(false);

  // Create modal
  const [createOpen, setCreateOpen] = React.useState(false);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [units, setUnits] = React.useState<Unit[]>([]);
  const [customerSearch, setCustomerSearch] = React.useState("");
  const [unitSearch, setUnitSearch] = React.useState("");
  // Display-name local state for autocomplete fields (the RHF fields hold IDs)
  const [selectedCustomerName, setSelectedCustomerName] = React.useState("");
  const [selectedUnitNumber, setSelectedUnitNumber] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  // Details popover
  const [detailDeal, setDetailDeal] = React.useState<Reservation | null>(null);

  // Journey panel
  const [journey, setJourney] = React.useState<JourneySummary | null>(null);
  const [journeyLoading, setJourneyLoading] = React.useState(false);
  const [journeyRelatedOpen, setJourneyRelatedOpen] = React.useState(false);

  // Cancel confirm
  const [cancelDeal, setCancelDeal] = React.useState<Reservation | null>(null);
  const [cancelling, setCancelling] = React.useState(false);

  // Bulk operation state
  const [bulkCancelOpen, setBulkCancelOpen] = React.useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
  const [bulkSelected, setBulkSelected] = React.useState<Reservation[]>([]);
  const [bulkWorking, setBulkWorking] = React.useState(false);

  async function handleBulkCancel() {
    if (!bulkSelected.length) return;
    setBulkWorking(true);
    try {
      const result = await bulkUpdateReservationStatus(
        bulkSelected.map((r) => r.id),
        "CANCELLED"
      );
      toast.success(
        lang === "ar"
          ? `تم إلغاء ${result.updated} حجز`
          : `${result.updated} reservation(s) cancelled`
      );
      setBulkCancelOpen(false);
      setBulkSelected([]);
      loadDeals();
    } catch (err: unknown) {
      toast.error(sanitizeError(err, lang));
    } finally {
      setBulkWorking(false);
    }
  }

  async function handleBulkDelete() {
    if (!bulkSelected.length) return;
    setBulkWorking(true);
    try {
      const result = await bulkDeleteReservations(bulkSelected.map((r) => r.id));
      toast.success(
        lang === "ar"
          ? `تم حذف ${result.deleted} حجز`
          : `${result.deleted} reservation(s) deleted`
      );
      setBulkDeleteOpen(false);
      setBulkSelected([]);
      loadDeals();
    } catch (err: unknown) {
      toast.error(sanitizeError(err, lang));
    } finally {
      setBulkWorking(false);
    }
  }

  function loadDeals() {
    setLoading(true);
    setLoadError(null);
    getReservations()
      .then((data) => setDeals(data as Reservation[]))
      .catch(() => {
        const msg = lang === "ar" ? "تعذّر تحميل الحجوزات" : "Failed to load reservations";
        setLoadError(msg);
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  }

  // Initial reservations arrive as props from the RSC server shell (CX-003 pt1 —
  // no first-paint client mount-fetch). `loadDeals()` is kept for post-mutation
  // refresh (create/status-change/bulk/delete) below.

  // Fetch journey when detail drawer opens
  React.useEffect(() => {
    if (!detailDeal) {
      setJourney(null);
      setJourneyRelatedOpen(false);
      return;
    }
    setJourneyLoading(true);
    getJourneySummary("reservation", detailDeal.id)
      .then((data) => setJourney(data))
      .catch(() => setJourney(null))
      .finally(() => setJourneyLoading(false));
  }, [detailDeal?.id]);

  // Filtered deals
  const filtered = React.useMemo(() => {
    return deals.filter((d) => {
      const matchStatus = statusFilter === "ALL" || d.status === statusFilter;
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        d.customer.name.toLowerCase().includes(q) ||
        d.unit.number.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [deals, statusFilter, search]);

  // KPIs
  const total = deals.length;
  const active = deals.filter((d) => d.status === "PENDING" || d.status === "CONFIRMED").length;
  const confirmed = deals.filter((d) => d.status === "CONFIRMED").length;
  const expired = deals.filter((d) => d.status === "EXPIRED" || d.status === "CANCELLED").length;

  // Customer autocomplete
  const filteredCustomers = React.useMemo(() => {
    if (!customerSearch) return customers.slice(0, 8);
    const q = customerSearch.toLowerCase();
    return customers.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [customers, customerSearch]);

  // Unit autocomplete — available only
  const filteredUnits = React.useMemo(() => {
    const available = units.filter((u) => u.status === "AVAILABLE");
    if (!unitSearch) return available.slice(0, 8);
    const q = unitSearch.toLowerCase();
    return available.filter((u) => u.number.toLowerCase().includes(q)).slice(0, 8);
  }, [units, unitSearch]);

  function openCreate() {
    setCreateOpen(true);
    getCustomers()
      .then((data) => setCustomers(data as Customer[]))
      .catch(() => {});
    getUnitsWithBuildings()
      .then((data) => {
        const unitsList = data as Unit[];
        setUnits(unitsList);
        // Apply ?unitId prefill once units are loaded
        if (prefillUnitId) {
          const matchingUnit = unitsList.find((u) => u.id === prefillUnitId);
          setValue("unitId", prefillUnitId, { shouldDirty: false });
          const displayNumber = matchingUnit?.number ?? prefillUnitId;
          setSelectedUnitNumber(displayNumber);
          setUnitSearch(displayNumber);
        }
      })
      .catch(() => {});
    // Apply URL param prefills
    if (prefillCustomerId) {
      setValue("customerId", prefillCustomerId, { shouldDirty: false });
      const displayName = prefillCustomerName ?? "";
      setSelectedCustomerName(displayName);
      setCustomerSearch(displayName);
    }
    if (prefillAmount) {
      const parsed = parseFloat(prefillAmount);
      if (Number.isFinite(parsed)) {
        setValue("amount", parsed, { shouldDirty: false });
      }
    }
  }

  // Auto-open create modal when URL has prefill params
  React.useEffect(() => {
    if (prefillCustomerId || prefillUnitId) {
      openCreate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillCustomerId, prefillUnitId]);

  const onCreateSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      await createReservation({
        customerId: values.customerId,
        unitId: values.unitId,
        amount: values.amount,
        expiresAt: new Date(values.expiresAt),
      });
      trackEvent(AnalyticsEvent.ReservationCreated, { amount: values.amount });
      toast.success(lang === "ar" ? "تم إنشاء الحجز بنجاح" : "Reservation created successfully");
      setCreateOpen(false);
      reset();
      setSelectedCustomerName("");
      setSelectedUnitNumber("");
      setCustomerSearch("");
      setUnitSearch("");
      loadDeals();
    } catch (err: unknown) {
      toast.error(sanitizeError(err, lang));
    } finally {
      setSubmitting(false);
    }
  });

  async function handleConfirmDeal(dealId: string) {
    try {
      await updateReservationStatus(dealId, "CONFIRMED");
      trackEvent(AnalyticsEvent.ReservationConfirmed);
      toast.success(lang === "ar" ? "تم تأكيد الحجز" : "Reservation confirmed");
      loadDeals();
    } catch (err: unknown) {
      toast.error(sanitizeError(err, lang));
    }
  }

  async function handleCancel() {
    if (!cancelDeal) return;
    setCancelling(true);
    try {
      await updateReservationStatus(cancelDeal.id, "CANCELLED");
      toast.success(lang === "ar" ? "تم إلغاء الحجز" : "Reservation cancelled");
      setCancelDeal(null);
      loadDeals();
    } catch (err: unknown) {
      toast.error(sanitizeError(err, lang));
    } finally {
      setCancelling(false);
    }
  }

  const statusTabs = [
    { key: "ALL", ar: "الكل", en: "All" },
    { key: "PENDING", ar: "قيد الانتظار", en: "Pending" },
    { key: "CONFIRMED", ar: "مؤكد", en: "Confirmed" },
    { key: "EXPIRED", ar: "منتهي", en: "Expired" },
    { key: "CANCELLED", ar: "ملغي", en: "Cancelled" },
  ];

  // Mobile-only helpers
  const pendingCount = deals.filter((d) => d.status === "PENDING").length;
  const confirmedCount = deals.filter((d) => d.status === "CONFIRMED").length;
  const expiredValue = deals
    .filter((d) => d.status === "EXPIRED")
    .reduce((sum, d) => sum + Number(d.amount), 0);
  const decidedDeals = deals.filter(
    (d) => d.status === "CONFIRMED" || d.status === "EXPIRED" || d.status === "CANCELLED",
  ).length;
  const winRate =
    decidedDeals > 0 ? Math.round((confirmedCount / decidedDeals) * 100) : 0;

  function expiryCountdown(iso: string): { label: string; tone: "success" | "warning" | "destructive" | "muted" } {
    const diffMs = new Date(iso).getTime() - Date.now();
    const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
    if (days < 0) {
      return {
        label: lang === "ar" ? `منتهي منذ ${Math.abs(days)} يوم` : `${Math.abs(days)}d ago`,
        tone: "destructive",
      };
    }
    if (days === 0) {
      return {
        label: lang === "ar" ? "ينتهي اليوم" : "Today",
        tone: "warning",
      };
    }
    if (days <= 3) {
      return {
        label: lang === "ar" ? `${days} أيام` : `${days}d`,
        tone: "warning",
      };
    }
    return {
      label: lang === "ar" ? `${days} يوم` : `${days}d`,
      tone: "success",
    };
  }

  function statusBadgeVariant(
    status: Reservation["status"],
  ): "pending" | "success" | "overdue" | "default" {
    switch (status) {
      case "PENDING":
        return "pending";
      case "CONFIRMED":
        return "success";
      case "EXPIRED":
        return "overdue";
      case "CANCELLED":
      default:
        return "default";
    }
  }

  const mobileStatusTabs = statusTabs;
  const canWriteDeals = can("deals:write");

  // ── DataTable column definitions ────────────────────────────────────────
  const columns = React.useMemo<ColumnDef<Reservation>[]>(
    () => [
      {
        accessorKey: "customer",
        id: "client",
        header: lang === "ar" ? "العميل" : "Client",
        enableSorting: true,
        cell: ({ row }) => (
          <span className="font-medium">{row.original.customer.name}</span>
        ),
      },
      {
        id: "property",
        header: lang === "ar" ? "العقار" : "Property",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="text-sm">
            <p className="font-medium">
              {lang === "ar" ? "وحدة" : "Unit"} {row.original.unit.number}
            </p>
            <p className="text-muted-foreground text-xs">
              {row.original.unit.buildingName ?? "—"}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "amount",
        header: lang === "ar" ? "قيمة الحجز" : "Reservation Value",
        enableSorting: true,
        meta: { numeric: true },
        cell: ({ row }) => (
          <span className="tabular-nums">{SAR(row.original.amount)}</span>
        ),
      },
      {
        accessorKey: "depositAmount",
        header: lang === "ar" ? "العربون" : "Deposit",
        enableSorting: false,
        meta: { numeric: true },
        cell: ({ row }) =>
          row.original.depositAmount ? (
            <span className="tabular-nums">{SAR(row.original.depositAmount)}</span>
          ) : (
            <span className="text-muted-foreground/70">—</span>
          ),
      },
      {
        accessorKey: "status",
        header: lang === "ar" ? "الحالة" : "Status",
        enableSorting: true,
        cell: ({ row }) => (
          <Badge variant={STATUS_VARIANT[row.original.status] ?? "default"} size="sm">
            {lang === "ar"
              ? (STATUS_LABELS[row.original.status]?.ar ?? row.original.status)
              : (STATUS_LABELS[row.original.status]?.en ?? row.original.status)}
          </Badge>
        ),
      },
      {
        accessorKey: "expiresAt",
        header: lang === "ar" ? "تاريخ الانتهاء" : "Expiry Date",
        enableSorting: true,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground tabular-nums">
            {new Date(row.original.expiresAt).toLocaleDateString(
              lang === "ar" ? "ar-SA-u-nu-latn" : "en-SA",
            )}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const deal = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              {/* View */}
              <IconButton
                icon={Eye}
                aria-label={lang === "ar" ? "عرض التفاصيل" : "View Details"}
                variant="ghost"
                size="icon"
                onClick={() => setDetailDeal(deal)}
                className="h-8 w-8"
              />
              {/* Confirm (PENDING only) */}
              {canWriteDeals && deal.status === "PENDING" && (
                <IconButton
                  icon={CheckCircle}
                  aria-label={lang === "ar" ? "تأكيد الحجز" : "Confirm Reservation"}
                  variant="ghost"
                  size="icon"
                  onClick={() => handleConfirmDeal(deal.id)}
                  className="h-8 w-8 text-muted-foreground hover:text-success"
                />
              )}
              {/* Convert to contract (CONFIRMED only) */}
              {deal.status === "CONFIRMED" && (
                <Link href={`/dashboard/contracts?dealId=${deal.id}`} tabIndex={-1}>
                  <IconButton
                    icon={FileSignature}
                    aria-label={lang === "ar" ? "تحويل لعقد" : "Convert to contract"}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-primary"
                  />
                </Link>
              )}
              {/* Cancel (PENDING or CONFIRMED) */}
              {canWriteDeals &&
                (deal.status === "PENDING" || deal.status === "CONFIRMED") && (
                  <IconButton
                    icon={Ban}
                    aria-label={lang === "ar" ? "إلغاء الحجز" : "Cancel Reservation"}
                    variant="ghost"
                    size="icon"
                    onClick={() => setCancelDeal(deal)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  />
                )}
            </div>
          );
        },
      },
    ],
    [lang, canWriteDeals, handleConfirmDeal],
  );

  return (
    <>
    {/* ─── Mobile (< md) ─────────────────────────────────────────────── */}
    <div
      className="md:hidden -m-4 sm:-m-6 min-h-dvh flex flex-col bg-background"
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <AppBar
        title={lang === "ar" ? "الحجوزات" : "Reservations"}
        lang={lang}
        trailing={
          <IconButton
            icon={Filter}
            aria-label={lang === "ar" ? "تصفية" : "Filter"}
            variant="ghost"
            onClick={() => setShowMobileFilters(true)}
            className="h-10 w-10 rounded-full"
          />
        }
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
                ? "ابحث باسم العميل أو رقم الوحدة..."
                : "Search by client or unit..."
            }
            className="h-10 ps-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 pt-3">
        <MobileKPICard
          label={lang === "ar" ? "قيد الانتظار" : "Pending"}
          value={<span className="tabular-nums">{pendingCount}</span>}
          tone="amber"
        />
        <MobileKPICard
          label={lang === "ar" ? "مؤكدة" : "Confirmed"}
          value={<span className="tabular-nums">{confirmedCount}</span>}
          tone="green"
        />
        <MobileKPICard
          label={lang === "ar" ? "قيمة المنتهية" : "Expired Value"}
          value={
            <SARAmount value={expiredValue} size={18} compact className="tabular-nums" />
          }
          tone="red"
        />
        <MobileKPICard
          label={lang === "ar" ? "نسبة الفوز" : "Win Rate"}
          value={<span className="tabular-nums">{winRate}%</span>}
          tone="primary"
        />
      </div>

      <div className="flex-1 px-4 pb-24 pt-4">
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
          deals.length === 0 ? (
            <EmptyState
              variant="first-time"
              icon={<Handshake className="h-12 w-12" aria-hidden="true" />}
              title={lang === "ar" ? "لا توجد حجوزات بعد" : "No reservations yet"}
              description={
                lang === "ar"
                  ? "أطلق عربون الحجز وتابع الحجز حتى التحويل إلى عقد."
                  : "Reserve a unit and follow the reservation through to contract."
              }
              action={
                canWriteDeals ? (
                  <Button size="sm" onClick={openCreate} style={{ display: "inline-flex" }}>
                    <Plus className="h-4 w-4 me-1.5" />
                    {lang === "ar" ? "إنشاء حجز" : "Create reservation"}
                  </Button>
                ) : undefined
              }
              helpHref="/dashboard/help#deals"
              helpLabel={lang === "ar" ? "تعرّف على الحجوزات" : "Learn about reservations"}
            />
          ) : (
            <EmptyState
              variant="filtered"
              icon={<Search className="h-10 w-10" aria-hidden="true" />}
              title={lang === "ar" ? "لا توجد نتائج مطابقة" : "No matching reservations"}
              description={
                lang === "ar"
                  ? "جرّب تعديل الفلاتر أو البحث بكلمات أخرى."
                  : "Try adjusting the filters or search terms."
              }
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("ALL");
                  }}
                  style={{ display: "inline-flex" }}
                >
                  {lang === "ar" ? "مسح الفلاتر" : "Clear filters"}
                </Button>
              }
            />
          )
        )}

        {!loading && filtered.length > 0 && (
          <div className="rounded-2xl border border-border bg-card px-4">
            {filtered.map((deal, idx) => {
              const countdown = expiryCountdown(deal.expiresAt);
              const badgeVariant = statusBadgeVariant(deal.status);
              const statusLabel =
                lang === "ar"
                  ? STATUS_LABELS[deal.status]?.ar ?? deal.status
                  : STATUS_LABELS[deal.status]?.en ?? deal.status;
              const countdownTextClass =
                countdown.tone === "destructive"
                  ? "text-destructive"
                  : countdown.tone === "warning"
                    ? "text-warning"
                    : countdown.tone === "success"
                      ? "text-success"
                      : "text-muted-foreground";

              return (
                <DataCard
                  key={deal.id}
                  icon={Handshake}
                  iconTone="purple"
                  divider={idx !== filtered.length - 1}
                  title={deal.customer.name}
                  subtitle={[
                    `${lang === "ar" ? "وحدة" : "Unit"} ${deal.unit.number}`,
                    <SARAmount
                      key="amount"
                      value={Number(deal.amount)}
                      size={12}
                      compact
                      className="tabular-nums"
                    />,
                  ]}
                  trailing={
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={badgeVariant} size="sm">
                        {statusLabel}
                      </Badge>
                      <span className={cn("text-[11px] tabular-nums", countdownTextClass)}>
                        {countdown.label}
                      </span>
                    </div>
                  }
                  onClick={() => setDetailDeal(deal)}
                />
              );
            })}
          </div>
        )}
      </div>

      {canWriteDeals && (
        <FAB
          icon={Plus}
          label={lang === "ar" ? "إنشاء حجز" : "Create reservation"}
          onClick={openCreate}
        />
      )}

      <BottomSheet
        open={showMobileFilters}
        onOpenChange={setShowMobileFilters}
        title={lang === "ar" ? "تصفية الحالة" : "Filter by status"}
        footer={
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="secondary"
              style={{ display: "inline-flex" }}
              onClick={() => setStatusFilter("ALL")}
            >
              {lang === "ar" ? "مسح" : "Reset"}
            </Button>
            <Button
              style={{ display: "inline-flex" }}
              onClick={() => setShowMobileFilters(false)}
            >
              {lang === "ar" ? "تطبيق" : "Apply"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-wrap gap-2 py-2">
          {mobileStatusTabs.map((tab) => (
            <Button
              key={tab.key}
              type="button"
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
      </BottomSheet>
    </div>

    {/* ─── Desktop (≥ md) ─ unchanged ───────────────────────────────── */}
    <div className="hidden md:block">
    <div dir={dir} className="p-6 space-y-6">
      <PageIntro
        title={lang === "ar" ? "الحجوزات" : "Reservations"}
        description={
          lang === "ar"
            ? "إدارة الحجوزات النشطة وحجوزات العقارات"
            : "Manage your active property reservations"
        }
        actions={
          can("deals:write") ? (
            <Button
              onClick={openCreate}
              style={{ display: "inline-flex" }}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              {lang === "ar" ? "إنشاء حجز" : "Create Reservation"}
            </Button>
          ) : undefined
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label={lang === "ar" ? "إجمالي الحجوزات" : "Total Reservations"}
          value={String(total)}
          loading={loading}
        />
        <KPICard
          label={lang === "ar" ? "نشطة" : "Active"}
          value={String(active)}
          loading={loading}
        />
        <KPICard
          label={lang === "ar" ? "مؤكدة" : "Confirmed"}
          value={String(confirmed)}
          loading={loading}
        />
        <KPICard
          label={lang === "ar" ? "منتهية/ملغاة" : "Expired/Cancelled"}
          value={String(expired)}
          loading={loading}
        />
      </div>

      {/* Filters */}
      <Card className="p-4 space-y-3">
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
        <div className="relative max-w-sm">
          <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === "ar" ? "البحث باسم العميل أو رقم الوحدة" : "Search by client or unit number"}
            className="ps-9"
          />
          {search && (
            <span className="absolute top-1/2 -translate-y-1/2 end-1">
              <IconButton
                icon={X}
                aria-label={lang === "ar" ? "مسح البحث" : "Clear search"}
                variant="ghost"
                size="icon"
                onClick={() => setSearch("")}
                className="h-7 w-7"
              />
            </span>
          )}
        </div>
      </Card>

      {/* Table */}
      {!loading && filtered.length === 0 ? (
        <Card>
          {deals.length === 0 ? (
            <EmptyState
              variant="first-time"
              icon={<Handshake className="h-12 w-12" aria-hidden="true" />}
              title={lang === "ar" ? "لا توجد حجوزات بعد" : "No reservations yet"}
              description={
                lang === "ar"
                  ? "أطلق عربون الحجز وتابع الحجز حتى التحويل إلى عقد."
                  : "Reserve a unit and follow the reservation through to contract."
              }
              action={
                canWriteDeals ? (
                  <Button
                    onClick={openCreate}
                    style={{ display: "inline-flex" }}
                    className="gap-2"
                  >
                    <Plus className="h-[18px] w-[18px]" />
                    {lang === "ar" ? "إنشاء حجز" : "Create reservation"}
                  </Button>
                ) : undefined
              }
              helpHref="/dashboard/help#deals"
              helpLabel={lang === "ar" ? "تعرّف على الحجوزات" : "Learn about reservations"}
            />
          ) : (
            <EmptyState
              variant="filtered"
              icon={<Search className="h-12 w-12" aria-hidden="true" />}
              title={lang === "ar" ? "لا توجد نتائج مطابقة" : "No matching reservations"}
              description={
                lang === "ar"
                  ? "جرّب تعديل الفلاتر أو البحث بكلمات أخرى."
                  : "Try adjusting the filters or search terms."
              }
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("ALL");
                  }}
                  style={{ display: "inline-flex" }}
                >
                  {lang === "ar" ? "مسح الفلاتر" : "Clear filters"}
                </Button>
              }
            />
          )}
        </Card>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          loading={loading}
          locale={lang === "ar" ? "ar" : "en"}
          pagination
          pageSize={10}
          getRowId={(r) => r.id}
          enableSelection
          bulkActions={(selected) => (
            <div className="flex items-center gap-2">
              {canWriteDeals && (
                <Button
                  size="sm"
                  variant="outline"
                  style={{ display: "inline-flex" }}
                  className="gap-1"
                  disabled={bulkWorking}
                  onClick={() => {
                    setBulkSelected(selected as Reservation[]);
                    setBulkCancelOpen(true);
                  }}
                >
                  <Ban className="h-3.5 w-3.5" />
                  {lang === "ar"
                    ? `إلغاء (${selected.length})`
                    : `Cancel selected (${selected.length})`}
                </Button>
              )}
              {can("deals:delete") && (
                <Button
                  size="sm"
                  variant="destructive"
                  style={{ display: "inline-flex" }}
                  className="gap-1"
                  disabled={bulkWorking}
                  onClick={() => {
                    setBulkSelected(selected as Reservation[]);
                    setBulkDeleteOpen(true);
                  }}
                >
                  {bulkWorking
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Trash2 className="h-3.5 w-3.5" />}
                  {lang === "ar"
                    ? `حذف (${selected.length})`
                    : `Delete (${selected.length})`}
                </Button>
              )}
            </div>
          )}
          enableColumnReorder
          exportable
          onExport={({ rows, columns: exportColumns }) =>
            exportToExcel({
              filename: `reservations-${new Date().toISOString().slice(0, 10)}`,
              title: lang === "ar" ? "الحجوزات" : "Reservations",
              lang,
              columns: exportColumns.map((c) => ({ header: c.header, key: c.id })),
              data: rows.map((d) => ({
                client: d.customer.name,
                property: `${lang === "ar" ? "وحدة" : "Unit"} ${d.unit.number}${d.unit.buildingName ? ` — ${d.unit.buildingName}` : ""}`,
                amount: SAR(d.amount),
                depositAmount: d.depositAmount ? SAR(d.depositAmount) : "—",
                status:
                  lang === "ar"
                    ? STATUS_LABELS[d.status]?.ar ?? d.status
                    : STATUS_LABELS[d.status]?.en ?? d.status,
                expiresAt: new Date(d.expiresAt).toLocaleDateString(
                  lang === "ar" ? "ar-SA-u-nu-latn" : "en-SA",
                ),
              })),
            })
          }
          savedViews={{
            tableKey: "reservations",
            views: savedViews,
            onCreate: async (name, config) => {
              await createSavedView({ tableKey: "reservations", name, config });
              refreshSavedViews();
            },
            onDelete: async (id) => {
              await deleteSavedView(id);
              refreshSavedViews();
            },
          }}
          mobileCard={(deal) => {
            const countdown = expiryCountdown(deal.expiresAt);
            const badgeVariant = statusBadgeVariant(deal.status);
            const statusLabel =
              lang === "ar"
                ? STATUS_LABELS[deal.status]?.ar ?? deal.status
                : STATUS_LABELS[deal.status]?.en ?? deal.status;
            const countdownTextClass =
              countdown.tone === "destructive"
                ? "text-destructive"
                : countdown.tone === "warning"
                  ? "text-warning"
                  : countdown.tone === "success"
                    ? "text-success"
                    : "text-muted-foreground";
            return (
              <DataCard
                icon={Handshake}
                iconTone="purple"
                divider={false}
                title={deal.customer.name}
                subtitle={[
                  `${lang === "ar" ? "وحدة" : "Unit"} ${deal.unit.number}`,
                  <SARAmount
                    key="amount"
                    value={Number(deal.amount)}
                    size={12}
                    compact
                    className="tabular-nums"
                  />,
                ]}
                trailing={
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={badgeVariant} size="sm">
                      {statusLabel}
                    </Badge>
                    <span className={cn("text-[11px] tabular-nums", countdownTextClass)}>
                      {countdown.label}
                    </span>
                  </div>
                }
                onClick={() => setDetailDeal(deal)}
              />
            );
          }}
          emptyTitle={lang === "ar" ? "لا توجد نتائج مطابقة" : "No matching reservations"}
          emptyDescription={
            lang === "ar"
              ? "جرّب تعديل الفلاتر أو البحث بكلمات أخرى."
              : "Try adjusting the filters or search terms."
          }
        />
      )}

      {/* Create Deal Modal */}
      <ResponsiveDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={lang === "ar" ? "إنشاء حجز جديد" : "Create New Reservation"}
        contentClassName="sm:max-w-[640px]"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              style={{ display: "inline-flex" }}
            >
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              type="submit"
              form="create-deal-form"
              disabled={submitting}
              style={{ display: "inline-flex" }}
              className="gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {lang === "ar" ? "إنشاء الحجز" : "Create Reservation"}
            </Button>
          </div>
        }
      >
        <form
          id="create-deal-form"
          onSubmit={onCreateSubmit}
          className="space-y-4 py-2"
        >
          {/* Required fields legend */}
          <p className="text-caption text-muted-foreground text-xs">
            {lang === "ar"
              ? "الحقول المطلوبة معلّمة بـ *"
              : "Required fields marked with *"}
          </p>

          {/* Customer search */}
          <Controller
            name="customerId"
            control={control}
            render={({ field, fieldState }) => (
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">
                  {lang === "ar" ? "العميل" : "Customer"} *
                </label>
                <div className="relative">
                  <Input
                    value={selectedCustomerName || customerSearch}
                    aria-invalid={!!fieldState.error}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setSelectedCustomerName("");
                      field.onChange("");
                    }}
                    onBlur={field.onBlur}
                    placeholder={lang === "ar" ? "ابحث عن العميل..." : "Search customer..."}
                  />
                  {customerSearch && !field.value && filteredCustomers.length > 0 && (
                    <div className="absolute z-10 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredCustomers.map((c) => (
                        <Button
                          key={c.id}
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            field.onChange(c.id);
                            setSelectedCustomerName(c.name);
                            setCustomerSearch(c.name);
                          }}
                          className="w-full justify-start rounded-none px-3 py-2 text-sm font-normal"
                          style={{ display: "flex" }}
                        >
                          {c.name}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
                {fieldState.error && (
                  <p className="text-caption text-destructive mt-1 text-xs">
                    {fieldState.error.message}
                  </p>
                )}
              </div>
            )}
          />

          {/* Unit search */}
          <Controller
            name="unitId"
            control={control}
            render={({ field, fieldState }) => (
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">
                  {lang === "ar" ? "الوحدة" : "Unit"} *
                </label>
                <div className="relative">
                  <Input
                    value={selectedUnitNumber || unitSearch}
                    aria-invalid={!!fieldState.error}
                    onChange={(e) => {
                      setUnitSearch(e.target.value);
                      setSelectedUnitNumber("");
                      field.onChange("");
                    }}
                    onBlur={field.onBlur}
                    placeholder={lang === "ar" ? "ابحث عن وحدة متاحة..." : "Search available unit..."}
                  />
                  {unitSearch && !field.value && filteredUnits.length > 0 && (
                    <div className="absolute z-10 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredUnits.map((u) => (
                        <Button
                          key={u.id}
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            field.onChange(u.id);
                            setSelectedUnitNumber(u.number);
                            setUnitSearch(u.number);
                          }}
                          className="w-full justify-start rounded-none px-3 py-2 text-sm font-normal"
                          style={{ display: "flex" }}
                        >
                          {lang === "ar" ? "وحدة" : "Unit"} {u.number}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
                {fieldState.error && (
                  <p className="text-caption text-destructive mt-1 text-xs">
                    {fieldState.error.message}
                  </p>
                )}
              </div>
            )}
          />

          {/* Amount — SARAmountInput via Controller */}
          <Controller
            name="amount"
            control={control}
            render={({ field, fieldState }) => (
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">
                  {lang === "ar" ? "قيمة الحجز (ريال)" : "Reservation Amount (SAR)"} *
                </label>
                <SARAmountInput
                  value={field.value ?? null}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  invalid={!!fieldState.error}
                  locale={lang as "ar" | "en"}
                  placeholder="0.00"
                />
                {fieldState.error && (
                  <p className="text-caption text-destructive mt-1 text-xs">
                    {fieldState.error.message}
                  </p>
                )}
              </div>
            )}
          />

          {/* Expiry Date */}
          <Controller
            name="expiresAt"
            control={control}
            render={({ field, fieldState }) => (
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">
                  {lang === "ar" ? "تاريخ الانتهاء" : "Expiry Date"} *
                </label>
                <Input
                  type="date"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  aria-invalid={!!fieldState.error}
                  min={new Date().toISOString().split("T")[0]}
                />
                {fieldState.error && (
                  <p className="text-caption text-destructive mt-1 text-xs">
                    {fieldState.error.message}
                  </p>
                )}
              </div>
            )}
          />

          {/* Notes — optional, no Controller needed; plain textarea is fine */}
          <Controller
            name="notes"
            control={control}
            render={({ field }) => (
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">
                  {lang === "ar" ? "ملاحظات" : "Notes"}
                </label>
                <textarea
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  rows={3}
                  placeholder={lang === "ar" ? "أي ملاحظات إضافية..." : "Any additional notes..."}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                />
              </div>
            )}
          />
        </form>
      </ResponsiveDialog>

      {/* Deal Details Modal */}
      <ResponsiveDialog
        open={!!detailDeal}
        onOpenChange={(open) => !open && setDetailDeal(null)}
        title={lang === "ar" ? "تفاصيل الحجز" : "Reservation Details"}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setDetailDeal(null)}
              style={{ display: "inline-flex" }}
            >
              {lang === "ar" ? "إغلاق" : "Close"}
            </Button>
          </div>
        }
      >
        {detailDeal && (
          <div className="space-y-3 py-2 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground text-xs">{lang === "ar" ? "العميل" : "Client"}</p>
                  <p className="font-medium">{detailDeal.customer.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{lang === "ar" ? "الوحدة" : "Unit"}</p>
                  <p className="font-medium">{detailDeal.unit.number}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{lang === "ar" ? "قيمة الحجز" : "Reservation Value"}</p>
                  <p className="font-medium">{SAR(detailDeal.amount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{lang === "ar" ? "العربون" : "Deposit"}</p>
                  <p className="font-medium">
                    {detailDeal.depositAmount ? SAR(detailDeal.depositAmount) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{lang === "ar" ? "الحالة" : "Status"}</p>
                  <Badge variant={STATUS_VARIANT[detailDeal.status] ?? "default"} size="sm">
                    {lang === "ar" ? (STATUS_LABELS[detailDeal.status]?.ar ?? detailDeal.status) : (STATUS_LABELS[detailDeal.status]?.en ?? detailDeal.status)}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{lang === "ar" ? "تاريخ الانتهاء" : "Expiry Date"}</p>
                  <p className="font-medium">
                    {new Date(detailDeal.expiresAt).toLocaleDateString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-SA")}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{lang === "ar" ? "المبنى" : "Building"}</p>
                  <p className="font-medium">{detailDeal.unit.buildingName ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{lang === "ar" ? "تاريخ الإنشاء" : "Created"}</p>
                  <p className="font-medium">
                    {new Date(detailDeal.createdAt).toLocaleDateString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-SA")}
                  </p>
                </div>
              </div>

              {/* ── Journey Section ── */}
              {journeyLoading && (
                <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  {lang === "ar" ? "جارٍ تحميل المسار..." : "Loading journey..."}
                </div>
              )}
              {!journeyLoading && journey && (
                <div className="space-y-3 border-t border-border pt-3">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {lang === "ar" ? "المسار" : "Journey"}
                  </h4>
                  {journey.blockers.length > 0 && (
                    <ProcessBlockerBanner blockers={journey.blockers} lang={lang} />
                  )}
                  <LifecycleRail
                    stages={journey.stages}
                    lang={lang}
                    ariaLabel={lang === "ar" ? "مراحل الحجز" : "Reservation lifecycle"}
                  />
                  <NextActionPanel actions={journey.nextActions} lang={lang} />
                  {journey.related.length > 0 && (
                    <>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={() => setJourneyRelatedOpen(true)}
                        className="h-auto p-0 text-xs"
                        style={{ display: "inline-flex" }}
                      >
                        {lang === "ar"
                          ? `السجلات المرتبطة (${journey.related.length})`
                          : `Related records (${journey.related.length})`}
                      </Button>
                      <RelatedContextPanel
                        open={journeyRelatedOpen}
                        onOpenChange={setJourneyRelatedOpen}
                        records={journey.related}
                        lang={lang}
                      />
                    </>
                  )}
                </div>
              )}
          </div>
        )}
      </ResponsiveDialog>

      {/* Cancel Confirmation Modal */}
      <ResponsiveDialog
        open={!!cancelDeal}
        onOpenChange={(open) => !open && setCancelDeal(null)}
        title={lang === "ar" ? "تأكيد الإلغاء" : "Confirm Cancellation"}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setCancelDeal(null)}
              style={{ display: "inline-flex" }}
            >
              {lang === "ar" ? "تراجع" : "Go Back"}
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelling}
              style={{ display: "inline-flex" }}
              className="gap-2"
            >
              {cancelling && <Loader2 className="w-4 h-4 animate-spin" />}
              {lang === "ar" ? "إلغاء الحجز" : "Cancel Reservation"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground py-2">
          {lang === "ar"
            ? `هل أنت متأكد من إلغاء الحجز الخاص بـ ${cancelDeal?.customer.name}؟ سيتم تحرير الوحدة وإتاحتها مجدداً.`
            : `Are you sure you want to cancel the reservation for ${cancelDeal?.customer.name}? The unit will be released and made available again.`}
        </p>
      </ResponsiveDialog>
    </div>
    </div>

    {/* Bulk Cancel Confirm */}
    <ConfirmDialog
      open={bulkCancelOpen}
      onOpenChange={setBulkCancelOpen}
      title={
        lang === "ar"
          ? `إلغاء ${bulkSelected.length} حجز`
          : `Cancel ${bulkSelected.length} reservation(s)`
      }
      description={
        lang === "ar"
          ? `سيتم إلغاء ${bulkSelected.length} حجز وتحرير الوحدات المرتبطة بها. الحجوزات المنتهية أو الملغاة بالفعل لن تتأثر.`
          : `${bulkSelected.length} reservation(s) will be cancelled and their units released. Already expired or cancelled reservations will be skipped.`
      }
      confirmLabel={lang === "ar" ? "إلغاء الحجوزات" : "Cancel reservations"}
      cancelLabel={lang === "ar" ? "تراجع" : "Go back"}
      onConfirm={handleBulkCancel}
    />

    {/* Bulk Delete Confirm */}
    <ConfirmDialog
      open={bulkDeleteOpen}
      onOpenChange={setBulkDeleteOpen}
      title={
        lang === "ar"
          ? `حذف ${bulkSelected.length} حجز`
          : `Delete ${bulkSelected.length} reservation(s)`
      }
      description={
        lang === "ar"
          ? `سيتم حذف ${bulkSelected.length} حجز نهائياً. لا يمكن التراجع عن هذه العملية.`
          : `${bulkSelected.length} reservation(s) will be permanently deleted. This action cannot be undone.`
      }
      confirmLabel={lang === "ar" ? "حذف" : "Delete"}
      cancelLabel={lang === "ar" ? "تراجع" : "Go back"}
      onConfirm={handleBulkDelete}
      variant="destructive"
    />
    </>
  );
}
