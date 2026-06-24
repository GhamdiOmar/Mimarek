"use client";

import { useLanguage } from "../../../components/LanguageProvider";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import {
  Users,
  Plus,
  Loader2,
  X,
  Search,
  Trash2,
  Eye,
  FileDown,
  UserPlus,
  TrendingUp,
  Phone,
  AlertTriangle,
  Filter,
  Handshake,
  Building2,
} from "lucide-react";
import {
  Button,
  IconButton,
  Input,
  Card,
  PageIntro,
  KPICard,
  ResponsiveDialog,
  AppBar,
  MobileTabs,
  MobileKanban,
  CustomerCard,
  BottomSheet,
  FAB,
  DataTable,
  EmptyState,
  type ColumnDef,
} from "@repo/ui";
import { cn } from "@repo/ui/lib/utils";
import {
  getCustomers,
  deleteCustomer,
  getCustomerUnitAssignments,
} from "../../actions/customers";
import { getTeamMembers } from "../../actions/team";
import { usePermissions } from "../../../hooks/usePermissions";
import {
  getAvailableUnitsForInterest,
  setCustomerPipelineStage,
} from "../../actions/customer-interests";
import { maskPhone } from "@/lib/pii-masking";
import { trackEvent, AnalyticsEvent } from "../../../lib/analytics";
import { Upload } from "lucide-react";
import { ImportWizard } from "../../../components/import/ImportWizard";
import { CUSTOMER_IMPORT_CONFIG } from "../../../components/import/import-config";
import { validateCustomerImport, commitCustomerImport } from "../../actions/customer-import";
import {
  PIPELINE_STAGES,
  STAGE_HUES,
  LOST_REASONS,
  PROPERTY_TYPES,
  SOURCE_LABELS,
} from "./crm-config";
import { getStatusConfig, formatSAR } from "./crm-helpers";
import { KanbanCard } from "./KanbanCard";
import { CustomerDrawer } from "./CustomerDrawer";
import { AddCustomerModal } from "./AddCustomerModal";

// ─── Shared CRM DTOs (serialized + masked payloads from the server actions) ──

// Masked + serialized customer row from getCustomers(). PII fields are masked
// strings (or raw when showPii), Decimals/Dates are serialized, and the server
// adds contactPhoneE164. Index signature keeps it assignable to KanbanCustomer
// and forward-compatible with the fields the drawer/table read.
type CrmCustomer = {
  id: string;
  name: string;
  nameArabic?: string | null;
  phone?: string | null;
  email?: string | null;
  source?: string | null;
  status: string;
  lostReason?: string | null;
  agentId?: string | null;
  budget?: number | string | null;
  propertyTypeInterest?: string | null;
  nationality?: string | null;
  gender?: string | null;
  maritalStatus?: string | null;
  dateOfBirth?: string | Date | null;
  agent?: { id?: string; name?: string | null; email?: string | null } | null;
  contactPhoneE164?: string | null;
  [key: string]: unknown;
};

type TeamMember = {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  [key: string]: unknown;
};

type AvailableUnit = {
  id: string;
  number?: string | null;
  type?: string | null;
  city?: string | null;
  buildingName?: string | null;
  rentalPrice?: number | string | null;
  markupPrice?: number | string | null;
  price?: number | string | null;
  [key: string]: unknown;
};

type UnitAssignment = {
  unitId: string;
  unitNumber: string;
  building: string;
  type: "reservation" | "contract" | "lease";
  status: string;
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CrmView({
  initialCustomers,
  initialTeamMembers,
  initialAvailableUnits,
}: {
  initialCustomers: CrmCustomer[];
  initialTeamMembers: TeamMember[];
  initialAvailableUnits: AvailableUnit[];
}) {
  const { t, lang } = useLanguage();
  const { can } = usePermissions();
  const searchParams = useSearchParams();

  // Seeded from the Server Component's masked getCustomers() result — no
  // client mount-time fetch for the initial paint. `loadData()` below stays as
  // a callable refetch used after mutations to re-sync from the server.
  const [customers, setCustomers] = React.useState<CrmCustomer[]>(initialCustomers);
  const [teamMembers, setTeamMembers] = React.useState<TeamMember[]>(initialTeamMembers);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<"kanban" | "list">("kanban");
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [showLost, setShowLost] = React.useState(false);
  const [showPii, setShowPii] = React.useState(false);

  // Add modal — the form + property-linking now live inside AddCustomerModal.
  // `addInitialStatus` lets the Kanban per-column "Add" button preset the stage.
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [addInitialStatus, setAddInitialStatus] = React.useState<string>("NEW");

  // CX-010 bulk import
  const [showImport, setShowImport] = React.useState(false);

  // Available units seeded server-side (refreshed by loadData()); passed to the
  // add-customer modal for its property-linking search.
  const [pageAvailableUnits, setPageAvailableUnits] = React.useState<AvailableUnit[]>(initialAvailableUnits);

  // Delete dialog
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<CrmCustomer | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  // Profile drawer
  const [drawerCustomer, setDrawerCustomer] = React.useState<CrmCustomer | null>(null);
  const [drawerAssignments, setDrawerAssignments] = React.useState<UnitAssignment[]>([]);
  const [, setLoadingAssignments] = React.useState(false);

  // Lost reason modal (triggered when dropping into LOST)
  const [showLostModal, setShowLostModal] = React.useState(false);
  const [lostTarget, setLostTarget] = React.useState<{ id: string; name: string } | null>(null);
  const [lostReason, setLostReason] = React.useState("");
  const [savingLost, setSavingLost] = React.useState(false);

  // Drag state
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = React.useState<string | null>(null);

  // Accessible move announcement (aria-live region text)
  const [moveAnnouncement, setMoveAnnouncement] = React.useState<string | null>(null);

  // Mobile-only UI state (reuses desktop state for search/statusFilter/showLost)
  const [mobileTab, setMobileTab] = React.useState<"pipeline" | "leads" | "customers">("pipeline");
  const [showMobileFilters, setShowMobileFilters] = React.useState(false);

  const canWrite = can("crm:write") || can("customers:write");
  const canDelete = can("crm:delete") || can("customers:delete");
  const canExport = can("crm:export") || can("customers:export");
  const hasPiiAccess = can("customers:read_pii");

  // ─── Load ───────────────────────────────────────────────────────────────────
  // NOTE: no mount-time fetch — initial customers/team/units are server-rendered
  // and seeded into state above. `loadData()` remains a callable refetch used
  // after profile edits (via onCustomerUpdated) to re-sync masked data.

  // Load assignments when drawer customer changes
  React.useEffect(() => {
    if (drawerCustomer) {
      loadAssignments(drawerCustomer.id);
    } else {
      setDrawerAssignments([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the drawer customer id only; the stable loadAssignments closure refetches whenever a different customer opens, and re-running on the full object would refetch on every unrelated re-render
  }, [drawerCustomer?.id]);

  // Deep-link: `?customerId=<id>` opens that customer's drawer (the HELD-invoice
  // recovery path links here to complete a buyer's ZATCA data). Limitation: this
  // only opens customers already in the initial server-rendered list; the drawer
  // does not fetch by id, so a customer outside the loaded set is a no-op.
  React.useEffect(() => {
    const id = searchParams.get("customerId");
    if (!id) return;
    const target = customers.find((c) => c.id === id);
    if (target) setDrawerCustomer(target);
    // Run once on mount / when the param changes; opening a stale row is avoided
    // by re-resolving from the current `customers` snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally keyed on the param only; `customers` is the initial server-rendered set and re-running on every list mutation would re-open the drawer after the user closes it
  }, [searchParams]);

  async function loadAssignments(customerId: string) {
    setLoadingAssignments(true);
    try {
      const data = await getCustomerUnitAssignments(customerId);
      setDrawerAssignments(data);
    } catch {
      // silent
    } finally {
      setLoadingAssignments(false);
    }
  }

  async function loadData() {
    try {
      setLoading(true);
      const [data, members, units] = await Promise.all([getCustomers(), getTeamMembers(), getAvailableUnitsForInterest()]);
      setCustomers(data);
      setTeamMembers(members.filter((m: TeamMember) => ["ADMIN", "MANAGER", "AGENT"].includes(m.role ?? "")));
      setPageAvailableUnits(units);
    } catch {
      setError(
        t("تعذّر تحميل بيانات العملاء. يرجى المحاولة مجدداً.", "Failed to load CRM data. Please try again.")
      );
    } finally {
      setLoading(false);
    }
  }

  // ─── Filtered ───────────────────────────────────────────────────────────────

  const filteredCustomers = React.useMemo(() => {
    return customers.filter((c) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        c.name?.toLowerCase().includes(q) ||
        c.nameArabic?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.email?.toLowerCase().includes(q);
      const matchStatus = !statusFilter || c.status === statusFilter;
      const matchLost = showLost ? c.status === "LOST" : c.status !== "LOST";
      return matchSearch && matchStatus && (statusFilter ? true : matchLost);
    });
  }, [customers, search, statusFilter, showLost]);

  // ─── KPIs ───────────────────────────────────────────────────────────────────

  const kpis = React.useMemo(
    () => ({
      total: customers.filter((c) => c.status !== "LOST").length,
      newLeads: customers.filter((c) => c.status === "NEW").length,
      inProgress: customers.filter((c) =>
        ["CONTACTED", "QUALIFIED", "VIEWING", "NEGOTIATION"].includes(c.status)
      ).length,
      lost: customers.filter((c) => c.status === "LOST").length,
    }),
    [customers]
  );

  // ─── Mobile-only derivations ─────────────────────────────────────────────
  // Declared here (before the `if (loading)` early-return) so hook order is stable.
  const mobileLeads = React.useMemo(
    () =>
      filteredCustomers.filter((c) =>
        ["NEW", "CONTACTED", "QUALIFIED", "VIEWING", "NEGOTIATION", "INTERESTED"].includes(c.status),
      ),
    [filteredCustomers],
  );
  const mobileCustomers = React.useMemo(
    () =>
      filteredCustomers.filter((c) =>
        ["CONVERTED", "RESERVED", "ACTIVE_TENANT", "PAST_TENANT"].includes(c.status),
      ),
    [filteredCustomers],
  );

  // ─── List-view columns (TanStack DataTable) ────────────────────────────────

  const listColumns = React.useMemo<ColumnDef<CrmCustomer, unknown>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: t("الاسم", "Name"),
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div>
              <p className="font-semibold text-foreground">{c.name}</p>
              {c.nameArabic && c.nameArabic !== c.name && (
                <p className="text-xs text-muted-foreground">{c.nameArabic}</p>
              )}
            </div>
          );
        },
      },
      {
        id: "phone",
        accessorKey: "phone",
        header: t("الهاتف", "Phone"),
        cell: ({ row }) =>
          row.original.phone ? (
            <span className="inline-flex items-center gap-1.5 font-mono text-sm text-muted-foreground" dir="ltr">
              <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
              {showPii ? row.original.phone : maskPhone(row.original.phone)}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          ),
      },
      {
        id: "budget",
        accessorKey: "budget",
        header: t("الميزانية", "Budget"),
        sortingFn: (a, b) => Number(a.original.budget ?? 0) - Number(b.original.budget ?? 0),
        cell: ({ row }) => {
          const b = row.original.budget;
          return (
            <span className="text-sm text-muted-foreground">
              {b
                ? `${Number(b).toLocaleString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-SA")} ${t("ر.س", "SAR")}`
                : "—"}
            </span>
          );
        },
        meta: { numeric: true },
      },
      {
        id: "status",
        accessorKey: "status",
        header: t("الحالة", "Status"),
        cell: ({ row }) => {
          const statusCfg = getStatusConfig(row.original.status);
          return (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border",
                statusCfg.color,
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", statusCfg.dotColor)} />
              {statusCfg.label[lang]}
            </span>
          );
        },
      },
      {
        id: "source",
        accessorKey: "source",
        header: t("المصدر", "Source"),
        cell: ({ row }) => {
          const s = row.original.source;
          return (
            <span className="text-sm text-muted-foreground">
              {s && SOURCE_LABELS[s]
                ? (SOURCE_LABELS[s] as { ar: string; en: string })[lang]
                : "—"}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        enableHiding: false,
        enableColumnFilter: false,
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <IconButton
                icon={Eye}
                aria-label={t("عرض", "View")}
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  setDrawerCustomer(c);
                }}
              />
              {canDelete && (
                <IconButton
                  icon={Trash2}
                  aria-label={t("حذف", "Delete")}
                  variant="ghost"
                  className="text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    openDelete(c);
                  }}
                />
              )}
            </div>
          );
        },
        meta: { align: "end" },
      },
    ],
    // openDelete is a stable function declared in this component; setDrawerCustomer is a stable setState.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang, showPii, canDelete],
  );

  // ─── Kanban drag ────────────────────────────────────────────────────────────

  function handleDragStart(e: React.DragEvent, customerId: string) {
    setDraggingId(customerId);
    e.dataTransfer.effectAllowed = "move";
  }

  async function handleDrop(status: string) {
    if (!draggingId) return;
    const customer = customers.find((c) => c.id === draggingId);
    setDraggingId(null);
    setDragOverStatus(null);

    if (status === "LOST") {
      // Open the lost reason modal instead of immediately updating
      setLostTarget({ id: draggingId, name: customer?.name ?? "" });
      setLostReason("");
      setShowLostModal(true);
      return;
    }

    const prev = customers;
    setCustomers((c) =>
      c.map((cust) => (cust.id === draggingId ? { ...cust, status } : cust))
    );
    try {
      // Pipeline is owned by the Deal entity now (R3). This advances the
      // customer's primary active deal's stage then derives Customer.status;
      // leads with no linked deal fall back to the manual status setter.
      await setCustomerPipelineStage(draggingId, status);
    } catch {
      setCustomers(prev);
      setError(
        t("فشل تحديث حالة العميل. يرجى المحاولة مجدداً.", "Failed to update status. Please try again.")
      );
    }
  }

  // ─── Keyboard / SR move (overflow menu — redundant drag path) ───────────────

  async function handleMoveToStage(customerId: string, targetStage: string) {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return;

    if (targetStage === "LOST") {
      setLostTarget({ id: customerId, name: customer.name ?? "" });
      setLostReason("");
      setShowLostModal(true);
      return;
    }

    const fromStage = PIPELINE_STAGES.find((s) => s.key === customer.status);
    const toStage = PIPELINE_STAGES.find((s) => s.key === targetStage);
    const prev = customers;
    setCustomers((c) =>
      c.map((cust) => (cust.id === customerId ? { ...cust, status: targetStage } : cust))
    );

    // Announce to screen readers
    const fromLabel = fromStage?.label[lang] ?? customer.status;
    const toLabel = toStage?.label[lang] ?? targetStage;
    setMoveAnnouncement(
      lang === "ar"
        ? `تم نقل ${customer.name} من ${fromLabel} إلى ${toLabel}`
        : `Moved ${customer.name ?? "customer"} from ${fromLabel} to ${toLabel}`
    );
    setTimeout(() => setMoveAnnouncement(null), 3000);

    try {
      await setCustomerPipelineStage(customerId, targetStage);
    } catch {
      setCustomers(prev);
      setMoveAnnouncement(null);
      setError(
        t("فشل تحديث حالة العميل. يرجى المحاولة مجدداً.", "Failed to update status. Please try again.")
      );
    }
  }

  // ─── Mark as Lost (with reason) ─────────────────────────────────────────────

  async function confirmLost() {
    if (!lostTarget || !lostReason) return;
    setSavingLost(true);
    const prev = customers;
    setCustomers((c) =>
      c.map((cust) =>
        cust.id === lostTarget.id
          ? { ...cust, status: "LOST", lostReason }
          : cust
      )
    );
    try {
      // Marking lost flows through the Deal entity (sets the primary deal's
      // stage=LOST + lostReason); leads with no linked deal fall back to the
      // manual LOST setter (which also cascades the LOST state).
      await setCustomerPipelineStage(lostTarget.id, "LOST", lostReason);
      setShowLostModal(false);
      setLostTarget(null);
    } catch {
      setCustomers(prev);
      setError(
        t("فشل تحديث حالة العميل. يرجى المحاولة مجدداً.", "Failed to update status. Please try again.")
      );
    } finally {
      setSavingLost(false);
    }
  }

  // ─── Add Customer ────────────────────────────────────────────────────────────
  // The create flow (form + validation + createCustomer/addCustomerInterest/
  // trackEvent) now lives in <AddCustomerModal>. CrmView only opens the modal and
  // receives the created record via onCreated → optimistic setCustomers insert.

  // ─── Delete ──────────────────────────────────────────────────────────────────

  function openDelete(customer: CrmCustomer) {
    setDeleteTarget(customer);
    setShowDeleteDialog(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteCustomer(deleteTarget.id);
      setCustomers((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setShowDeleteDialog(false);
      setDeleteTarget(null);
    } catch (err: unknown) {
      setError(
        (err instanceof Error ? err.message : "") ||
          (t("فشل حذف العميل. يرجى المحاولة مجدداً.", "Failed to delete contact. Please try again."))
      );
    } finally {
      setDeleting(false);
    }
  }

  // ─── Export (CSV) ────────────────────────────────────────────────────────────

  function handleExport() {
    trackEvent(AnalyticsEvent.ExportPerformed, { kind: "customers", count: Number(filteredCustomers.length) });
    const rows = [
      ["Name", "Phone", "Email", "Status", "Source", "Budget", "Property Interest"],
      ...filteredCustomers.map((c) => [
        c.name,
        showPii ? c.phone : maskPhone(c.phone),
        showPii ? (c.email ?? "") : "",
        c.status,
        c.source ?? "",
        c.budget ?? "",
        c.propertyTypeInterest ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "crm-contacts.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-200px)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Kanban columns — pipeline stages only (LOST shown as separate toggle section)
  const kanbanColumns = showLost
    ? [
        {
          key: "LOST",
          label: { ar: "خسارة", en: "Lost" },
          color: "bg-destructive/10 text-destructive border-destructive/30",
          dotColor: "bg-destructive",
        },
      ]
    : PIPELINE_STAGES;

  function customerCardStatus(
    status: string,
  ): "hot" | "warm" | "cold" | "converted" | "churned" | "neutral" {
    switch (status) {
      case "NEW":
        return "hot";
      case "CONTACTED":
      case "QUALIFIED":
      case "VIEWING":
      case "NEGOTIATION":
      case "INTERESTED":
        return "warm";
      case "CONVERTED":
      case "RESERVED":
      case "ACTIVE_TENANT":
        return "converted";
      case "LOST":
      case "PAST_TENANT":
        return "churned";
      default:
        return "neutral";
    }
  }

  function renderMobileCardList(rows: CrmCustomer[], emptyLabel: { ar: string; en: string }) {
    if (rows.length === 0) {
      // No filters active AND no customers at all → first-time empty. Otherwise filter-empty.
      const isFirstTime = customers.length === 0;
      return isFirstTime ? (
        <EmptyState
          variant="first-time"
          icon={<Users className="h-12 w-12" />}
          title={t("لا يوجد عملاء بعد", "No contacts yet")}
          description={
            t("أضف أول عميل محتمل وابدأ ببناء خط أعمالك.", "Add your first lead and start building your pipeline.")
          }
          action={
            canWrite ? (
              <Button size="sm" onClick={openAddCustomerModal} style={{ display: "inline-flex" }}>
                <Plus className="h-4 w-4 me-1.5" />
                {t("إضافة عميل", "Add contact")}
              </Button>
            ) : undefined
          }
          helpHref="/dashboard/help#crm"
          helpLabel={t("تعرّف على CRM", "Learn about CRM")}
        />
      ) : (
        <EmptyState
          variant="filtered"
          icon={<Search className="h-10 w-10" />}
          title={emptyLabel[lang]}
          description={
            t("جرّب تعديل البحث أو الفلاتر.", "Try adjusting your search or filters.")
          }
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearch("")}
              style={{ display: "inline-flex" }}
            >
              {t("مسح الفلاتر", "Clear filters")}
            </Button>
          }
        />
      );
    }
    return (
      <div className="space-y-2">
        {rows.map((c) => {
          const phoneDisplay = c.phone
            ? showPii
              ? c.phone
              : maskPhone(c.phone)
            : null;
          const interest = c.propertyTypeInterest
            ? PROPERTY_TYPES.find((pt) => pt.key === c.propertyTypeInterest)
                ?.label[lang] ?? c.propertyTypeInterest
            : null;
          const activity: React.ReactNode =
            phoneDisplay && interest ? (
              <><span dir="ltr">{phoneDisplay}</span>{" · "}{interest}</>
            ) : phoneDisplay ? (
              <span dir="ltr">{phoneDisplay}</span>
            ) : interest || null;
          return (
            <CustomerCard
              key={c.id}
              name={c.name}
              lastActivity={activity}
              status={customerCardStatus(c.status)}
              phone={showPii ? c.phone ?? null : null}
              onClick={() => setDrawerCustomer(c)}
              lang={lang}
            />
          );
        })}
      </div>
    );
  }

  function openAddCustomerModal() {
    // The modal resets its own form + property-linking state on open.
    setAddInitialStatus("NEW");
    setShowAddModal(true);
  }

  return (
    <>
    {/* Accessible live region for keyboard/SR move announcements */}
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {moveAnnouncement}
    </div>

    {/* ─── Mobile (< md) ─────────────────────────────────────────────── */}
    <div
      className="md:hidden -m-4 sm:-m-6 min-h-dvh flex flex-col bg-background"
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <AppBar
        title={t("إدارة العملاء", "CRM")}
        lang={lang}
        trailing={
          <IconButton
            icon={Filter}
            aria-label={t("تصفية", "Filter")}
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full"
            onClick={() => setShowMobileFilters(true)}
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
            aria-label={t("بحث بالاسم أو الهاتف", "Search by name or phone")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("بحث بالاسم أو الهاتف...", "Search by name or phone...")}
            className="h-10 ps-9"
          />
        </div>
      </div>

      <div className="px-4 pt-3">
        <MobileTabs
          ariaLabel={t("تبويبات العملاء", "CRM tabs")}
          active={mobileTab}
          onChange={(k) => setMobileTab(k as "pipeline" | "leads" | "customers")}
          items={[
            { key: "pipeline", label: t("مسار الفرص العقارية", "Pipeline") },
            {
              key: "leads",
              label: `${t("العملاء المحتملون", "Leads")} (${mobileLeads.length})`,
            },
            {
              key: "customers",
              label: `${t("العملاء", "Customers")} (${mobileCustomers.length})`,
            },
          ]}
        />
      </div>

      <div className="flex-1 px-4 py-3">
        {error && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {mobileTab === "pipeline" ? (
          <MobileKanban
            columns={PIPELINE_STAGES.map((stage) => {
              const stageCustomers = filteredCustomers.filter((c) => c.status === stage.key);
              return {
                key: stage.key,
                title: (
                  <span className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", stage.dotColor)} aria-hidden="true" />
                    <span>{stage.label[lang]}</span>
                    <span className="text-muted-foreground">({stageCustomers.length})</span>
                  </span>
                ),
                children:
                  stageCustomers.length === 0 ? (
                    <p className="py-4 text-center text-xs text-muted-foreground">
                      {t("لا توجد صفقات في هذه المرحلة", "No deals in this stage")}
                    </p>
                  ) : (
                    stageCustomers.map((c) => (
                      <Button
                        key={c.id}
                        type="button"
                        variant="ghost"
                        style={{ display: "block" }}
                        onClick={() => setDrawerCustomer(c)}
                        className="w-full rounded-xl border border-border bg-card p-3 text-start h-auto hover:border-foreground/20 active:scale-[0.99] transition-colors"
                      >
                        <div className="truncate text-sm font-semibold text-foreground">
                          {c.name}
                        </div>
                        {c.phone ? (
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" aria-hidden="true" />
                            <span className="truncate" dir="ltr">
                              {showPii ? c.phone : maskPhone(c.phone)}
                            </span>
                          </div>
                        ) : null}
                        {c.budget ? (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {formatSAR(c.budget, lang)}
                          </div>
                        ) : null}
                      </Button>
                    ))
                  ),
              };
            })}
          />
        ) : mobileTab === "leads" ? (
          renderMobileCardList(mobileLeads, {
            ar: "لا يوجد عملاء محتملون مطابقون.",
            en: "No matching leads.",
          })
        ) : (
          renderMobileCardList(mobileCustomers, {
            ar: "لا يوجد عملاء مطابقون.",
            en: "No matching customers.",
          })
        )}
      </div>

      {canWrite && (
        <FAB
          icon={Plus}
          label={t("إضافة عميل", "New Contact")}
          onClick={openAddCustomerModal}
        />
      )}

      {/* Mobile filters sheet */}
      <BottomSheet
        open={showMobileFilters}
        onOpenChange={setShowMobileFilters}
        title={t("تصفية", "Filters")}
        footer={
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="secondary"
              style={{ display: "inline-flex" }}
              onClick={() => {
                setStatusFilter("");
                setShowLost(false);
              }}
            >
              {t("مسح", "Reset")}
            </Button>
            <Button
              style={{ display: "inline-flex" }}
              onClick={() => setShowMobileFilters(false)}
            >
              {t("تطبيق", "Apply")}
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("الحالة", "Status")}
            </h4>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={!statusFilter && !showLost ? "primary" : "subtle"}
                size="sm"
                style={{ display: "inline-flex" }}
                className="rounded-full"
                aria-pressed={!statusFilter && !showLost}
                onClick={() => {
                  setStatusFilter("");
                  setShowLost(false);
                }}
              >
                {t("الكل", "All")}
              </Button>
              {PIPELINE_STAGES.map((s) => (
                <Button
                  key={s.key}
                  type="button"
                  variant={statusFilter === s.key ? "primary" : "subtle"}
                  size="sm"
                  style={{ display: "inline-flex" }}
                  className="rounded-full"
                  aria-pressed={statusFilter === s.key}
                  onClick={() => {
                    setStatusFilter(statusFilter === s.key ? "" : s.key);
                    setShowLost(false);
                  }}
                >
                  {s.label[lang]}
                </Button>
              ))}
              <Button
                type="button"
                variant={showLost ? "primary" : "subtle"}
                size="sm"
                style={{ display: "inline-flex" }}
                className="rounded-full"
                aria-pressed={showLost}
                onClick={() => {
                  setShowLost((v) => !v);
                  setStatusFilter("");
                }}
              >
                {t("الخسائر فقط", "Lost only")}
              </Button>
            </div>
          </div>

          {hasPiiAccess && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("الخصوصية", "Privacy")}
              </h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                style={{ display: "inline-flex" }}
                className={cn(
                  "rounded-full gap-2 px-3 py-1.5 text-xs h-auto",
                  showPii
                    ? "border-warning/40 bg-warning/10 text-warning-strong hover:bg-warning/20"
                    : ""
                )}
                onClick={() => setShowPii((v) => !v)}
              >
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                {showPii
                  ? t("إخفاء البيانات الحساسة", "Hide PII")
                  : t("عرض البيانات الحساسة", "Show PII")}
              </Button>
            </div>
          )}

          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <Handshake className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {t("سحب البطاقات بين مراحل مسار الفرص متاح على سطح المكتب.", "Drag-and-drop pipeline available on desktop.")}
            </span>
            <Building2 className="hidden h-4 w-4 shrink-0" aria-hidden="true" />
          </div>
        </div>
      </BottomSheet>
    </div>

    {/* ─── Desktop (≥ md) ─ unchanged ───────────────────────────────── */}
    <div className="hidden md:block">
    <div
      className="space-y-8 animate-in fade-in duration-500"
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      {/* ── Header ── */}
      <PageIntro
        title={t("إدارة العملاء", "CRM")}
        description={
          t("تتبع العملاء المحتملين وإدارة خط أنابيب المبيعات", "Track leads and manage your sales pipeline")
        }
        actions={
          <>
            {hasPiiAccess && (
              <Button
                variant="outline"
                size="sm"
                style={{ display: "inline-flex" }}
                className={cn(
                  "gap-1.5 text-xs",
                  showPii
                    ? "border-warning/50 bg-warning/10 text-warning-strong hover:bg-warning/20"
                    : ""
                )}
                onClick={() => setShowPii((v) => !v)}
              >
                <Eye className="h-3.5 w-3.5" />
                {showPii
                  ? t("إخفاء البيانات الحساسة", "Hide PII")
                  : t("عرض البيانات الحساسة", "Show PII")}
              </Button>
            )}
            {canExport && (
              <Button
                variant="outline"
                size="sm"
                style={{ display: "inline-flex" }}
                className="gap-2"
                onClick={handleExport}
              >
                <FileDown className="h-3.5 w-3.5" />
                {t("تصدير", "Export")}
              </Button>
            )}
            {canWrite && (
              <Button
                variant="outline"
                size="sm"
                style={{ display: "inline-flex" }}
                className="gap-2"
                onClick={() => setShowImport(true)}
              >
                <Upload className="h-3.5 w-3.5" />
                {t("استيراد", "Import")}
              </Button>
            )}
            {canWrite && (
              <Button
                variant="primary"
                size="sm"
                style={{ display: "inline-flex" }}
                className="gap-2"
                onClick={() => setShowAddModal(true)}
              >
                <UserPlus className="h-3.5 w-3.5" />
                {t("إضافة عميل", "Add Customer")}
              </Button>
            )}
          </>
        }
      />

      {/* CX-010: bulk customer import wizard */}
      <ImportWizard
        open={showImport}
        onOpenChange={setShowImport}
        config={CUSTOMER_IMPORT_CONFIG}
        parsePermission="customers:write"
        onValidate={validateCustomerImport}
        onCommit={commitCustomerImport}
        onImported={() => {
          void loadData();
        }}
      />

      {/* ── Error Banner ── */}
      {error && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
          <p className="text-sm text-destructive">{error}</p>
          <IconButton
            icon={X}
            aria-label={t("إغلاق", "Dismiss")}
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive/70 hover:text-destructive"
            onClick={() => setError(null)}
          />
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label={t("إجمالي جهات الاتصال", "Active Contacts")}
          value={kpis.total}
          subtitle={t("جميع العملاء النشطين", "All active contacts")}
          icon={<Users className="h-[18px] w-[18px]" />}
          accentColor="primary"
          loading={loading}
        />
        <KPICard
          label={t("عملاء جدد", "New Leads")}
          value={kpis.newLeads}
          subtitle={t("بانتظار التواصل", "Awaiting first contact")}
          icon={<UserPlus className="h-[18px] w-[18px]" />}
          accentColor="info"
          loading={loading}
        />
        <KPICard
          label={t("في مسار الفرص", "In Pipeline")}
          value={kpis.inProgress}
          subtitle={t("في مراحل متقدمة", "Contacted through Negotiation")}
          icon={<TrendingUp className="h-[18px] w-[18px]" />}
          accentColor="warning"
          loading={loading}
        />
        <KPICard
          label={t("خسائر", "Lost Leads")}
          value={kpis.lost}
          subtitle={t("عملاء خرجوا من المسار", "Exited pipeline")}
          icon={<AlertTriangle className="h-[18px] w-[18px]" />}
          accentColor="warning"
          loading={loading}
        />
      </div>

      {/* ── Toolbar ── */}
      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Status filters */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={!statusFilter && !showLost ? "primary" : "subtle"}
              size="sm"
              style={{ display: "inline-flex" }}
              className="rounded-full"
              aria-pressed={!statusFilter && !showLost}
              onClick={() => { setStatusFilter(""); setShowLost(false); }}
            >
              {t("الكل", "All")} {customers.filter(c => c.status !== "LOST").length}
            </Button>
            {PIPELINE_STAGES.map((s) => {
              const count = customers.filter((c) => c.status === s.key).length;
              return (
                <Button
                  key={s.key}
                  variant={statusFilter === s.key ? "primary" : "subtle"}
                  size="sm"
                  style={{ display: "inline-flex" }}
                  className="rounded-full"
                  aria-pressed={statusFilter === s.key}
                  onClick={() => { setStatusFilter(statusFilter === s.key ? "" : s.key); setShowLost(false); }}
                >
                  {s.label[lang]} {count}
                </Button>
              );
            })}
            {/* Lost toggle */}
            <Button
              variant={showLost ? "primary" : "subtle"}
              size="sm"
              style={{ display: "inline-flex" }}
              className="rounded-full"
              aria-pressed={showLost}
              onClick={() => { setShowLost((v) => !v); setStatusFilter(""); }}
            >
              {t("خسائر", "Lost")} {kpis.lost}
            </Button>
          </div>

          {/* View toggle */}
          <div className="flex gap-2">
            <Button
              variant={viewMode === "kanban" ? "primary" : "subtle"}
              size="sm"
              style={{ display: "inline-flex" }}
              className="rounded-full"
              aria-pressed={viewMode === "kanban"}
              onClick={() => setViewMode("kanban")}
            >
              {t("كانبان", "Kanban")}
            </Button>
            <Button
              variant={viewMode === "list" ? "primary" : "subtle"}
              size="sm"
              style={{ display: "inline-flex" }}
              className="rounded-full"
              aria-pressed={viewMode === "list"}
              onClick={() => setViewMode("list")}
            >
              {t("قائمة", "List")}
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            aria-label={t("ابحث بالاسم أو رقم الهاتف", "Search by name or phone")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              t("ابحث بالاسم أو رقم الهاتف...", "Search by name or phone...")
            }
            className="w-full h-10 bg-background border border-input rounded-xl ps-10 pe-4 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </div>
      </Card>

      {/* ── Kanban Board ── */}
      {viewMode === "kanban" && (
        <div
          className={cn(
            "grid gap-4 overflow-x-auto pb-4",
            showLost
              ? "grid-cols-1 max-w-sm"
              : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
          )}
        >
          {kanbanColumns.map((status) => {
            const colCustomers = filteredCustomers.filter(
              (c) => c.status === status.key
            );
            const isDragOver = dragOverStatus === status.key;
            const stageHue = STAGE_HUES[status.key];
            const colValue = colCustomers.reduce(
              (sum, c) => sum + (Number(c.budget) || 0),
              0,
            );

            return (
              <div
                key={status.key}
                className={cn(
                  "flex flex-col gap-3 min-h-[400px] rounded-xl p-3 transition-colors",
                  isDragOver && "bg-primary/5 ring-2 ring-primary/20"
                )}
                style={
                  !isDragOver && stageHue
                    ? {
                        backgroundColor: `color-mix(in srgb, ${stageHue} 4%, hsl(var(--card)))`,
                      }
                    : undefined
                }
                onDragOver={(e) => { e.preventDefault(); setDragOverStatus(status.key); }}
                onDragLeave={() => setDragOverStatus(null)}
                onDrop={() => handleDrop(status.key)}
              >
                {/* Column header */}
                <div className="mb-2 px-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={stageHue ? { backgroundColor: stageHue } : undefined}
                      />
                      <span className="text-xs font-bold text-foreground truncate">
                        {status.label[lang]}
                      </span>
                    </div>
                    <span className="shrink-0 rounded-full bg-muted/60 px-2 py-0.5 text-[11px] font-bold tabular-nums text-muted-foreground">
                      {colCustomers.length}
                    </span>
                  </div>
                  {colValue > 0 && (
                    <p
                      dir="ltr"
                      className="number-ltr mt-1 text-[11px] font-medium tabular-nums text-muted-foreground"
                    >
                      {colValue.toLocaleString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-SA")}{" "}
                      {t("ر.س", "SAR")}
                    </p>
                  )}
                </div>

                {/* Cards */}
                {colCustomers.map((c) => (
                  <KanbanCard
                    key={c.id}
                    customer={c}
                    lang={lang}
                    showPii={showPii}
                    onDragStart={handleDragStart}
                    onViewProfile={(kc) => {
                      const full = filteredCustomers.find((x) => x.id === kc.id);
                      if (full) setDrawerCustomer(full);
                    }}
                    onDelete={(kc) => {
                      const full = filteredCustomers.find((x) => x.id === kc.id);
                      if (full) openDelete(full);
                    }}
                    canDelete={canDelete}
                    onMoveToStage={handleMoveToStage}
                    currentStage={status.key}
                  />
                ))}

                {/* Add shortcut (not on LOST column) */}
                {canWrite && !showLost && (
                  <Button
                    variant="outline"
                    size="sm"
                    style={{ display: "inline-flex", width: "100%" }}
                    className="mt-auto gap-1.5 p-2 rounded-xl border-2 border-dashed text-muted-foreground hover:border-primary/40 hover:text-primary h-auto text-xs justify-center"
                    onClick={() => {
                      setAddInitialStatus(status.key);
                      setShowAddModal(true);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t("إضافة", "Add")}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── List View ── */}
      {viewMode === "list" && (
        <DataTable
          columns={listColumns}
          data={filteredCustomers}
          locale={lang}
          getRowId={(c) => c.id}
          pageSize={25}
          emptyIcon={<Users className="h-12 w-12" aria-hidden="true" />}
          emptyTitle={t("لا توجد نتائج", "No contacts found")}
          emptyDescription={
            t("حاول تعديل خيارات البحث أو الفلتر، أو أضف عميلاً جديداً.", "Try adjusting your search or filter, or add a new contact.")
          }
          emptyAction={
            !search.trim() && !statusFilter ? (
              <Button
                onClick={openAddCustomerModal}
                style={{ display: "inline-flex" }}
                className="gap-2"
              >
                <UserPlus className="h-4 w-4" />
                {t("إضافة عميل", "Add contact")}
              </Button>
            ) : undefined
          }
          mobileCard={(c) => {
            const statusCfg = getStatusConfig(c.status);
            return (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground truncate">{c.name}</p>
                    {c.nameArabic && c.nameArabic !== c.name && (
                      <p className="text-xs text-muted-foreground truncate">{c.nameArabic}</p>
                    )}
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border shrink-0",
                      statusCfg.color,
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", statusCfg.dotColor)} />
                    {statusCfg.label[lang]}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  {c.phone ? (
                    <span className="inline-flex items-center gap-1.5 font-mono" dir="ltr">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
                      {showPii ? c.phone : maskPhone(c.phone)}
                    </span>
                  ) : (
                    <span>—</span>
                  )}
                  <span>
                    {c.budget
                      ? `${Number(c.budget).toLocaleString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-SA")} ${t("ر.س", "SAR")}`
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-xs text-muted-foreground">
                    {c.source && SOURCE_LABELS[c.source]
                      ? (SOURCE_LABELS[c.source] as { ar: string; en: string })[lang]
                      : "—"}
                  </span>
                  <div className="flex items-center gap-2">
                    <IconButton
                      icon={Eye}
                      aria-label={t("عرض الملف", "View profile")}
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 sm:h-8 sm:w-8 border border-border bg-background"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDrawerCustomer(c);
                      }}
                    />
                    {canDelete && (
                      <IconButton
                        icon={Trash2}
                        aria-label={t("حذف", "Delete")}
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 sm:h-8 sm:w-8 border border-border bg-background"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDelete(c);
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          }}
        />
      )}


      {/* ── Lost Reason Modal ── */}
      <ResponsiveDialog
        open={showLostModal}
        onOpenChange={(open) => { if (!open) setShowLostModal(false); }}
        title={t("تحديد سبب الخسارة", "Mark as Lost")}
        description={
          t(`الرجاء تحديد سبب خسارة العميل "${lostTarget?.name}"`, `Please select why "${lostTarget?.name}" was lost`)
        }
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              style={{ display: "inline-flex" }}
              onClick={() => setShowLostModal(false)}
              disabled={savingLost}
            >
              {t("إلغاء", "Cancel")}
            </Button>
            <Button
              variant="destructive"
              style={{ display: "inline-flex" }}
              className="gap-2"
              onClick={confirmLost}
              disabled={!lostReason || savingLost}
            >
              {savingLost && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("تأكيد الخسارة", "Confirm Lost")}
            </Button>
          </div>
        }
      >
        <div dir={lang === "ar" ? "rtl" : "ltr"} className="space-y-2 py-2">
            {LOST_REASONS.map((reason) => (
              <Button
                key={reason.key}
                type="button"
                variant={lostReason === reason.key ? "outline" : "outline"}
                size="sm"
                style={{ display: "block", width: "100%" }}
                className={cn(
                  "text-start px-4 py-3 h-auto text-sm justify-start",
                  lostReason === reason.key
                    ? "border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/15"
                    : "hover:bg-muted/30"
                )}
                onClick={() => setLostReason(reason.key)}
              >
                {reason.label[lang]}
              </Button>
            ))}
        </div>
      </ResponsiveDialog>

      {/* ── Delete Dialog ── */}
      <ResponsiveDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={t("تأكيد الحذف", "Confirm Deletion")}
        description={
          t(`هل أنت متأكد من حذف "${deleteTarget?.name}"؟ لا يمكن التراجع عن هذا الإجراء.`, `Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`)
        }
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              style={{ display: "inline-flex" }}
              onClick={() => { setShowDeleteDialog(false); setError(null); }}
              disabled={deleting}
            >
              {t("إلغاء", "Cancel")}
            </Button>
            <Button
              variant="destructive"
              style={{ display: "inline-flex" }}
              className="gap-2"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("حذف", "Delete")}
            </Button>
          </div>
        }
      >
        {error && <p className="text-sm text-destructive">{error}</p>}
      </ResponsiveDialog>
    </div>
    </div>

      {/* ── Add Modal ── */}
      <AddCustomerModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        pageAvailableUnits={pageAvailableUnits}
        teamMembers={teamMembers}
        lang={lang}
        initialStatus={addInitialStatus}
        onCreated={(created) => setCustomers((prev) => [created, ...prev])}
      />
    {/* ── Profile Drawer (shared across mobile + desktop) ── */}
    {drawerCustomer && (
      <CustomerDrawer
        customer={drawerCustomer}
        onClose={() => setDrawerCustomer(null)}
        onCustomerUpdated={(updated) => {
          setDrawerCustomer(updated);
          setCustomers((prev) =>
            prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
          );
          loadData();
        }}
        onMarkLost={(id, name) => {
          setLostTarget({ id, name });
          setLostReason("");
          setShowLostModal(true);
        }}
        lang={lang}
        teamMembers={teamMembers}
        assignments={drawerAssignments}
        showPii={showPii}
        hasPiiAccess={hasPiiAccess}
      />
    )}
    </>
  );
}
