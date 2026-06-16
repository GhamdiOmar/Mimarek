"use client";

import { useLanguage } from "../../../components/LanguageProvider";
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
  ChevronRight,
  AlertTriangle,
  Link2,
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
  NationalIdInput,
  SaudiPhoneInput,
  SARAmountInput,
  DataTable,
  EmptyState,
  type ColumnDef,
} from "@repo/ui";
import { cn } from "@repo/ui/lib/utils";
import {
  getCustomers,
  createCustomer,
  deleteCustomer,
  getCustomerUnitAssignments,
} from "../../actions/customers";
import { getTeamMembers } from "../../actions/team";
import { usePermissions } from "../../../hooks/usePermissions";
import {
  addCustomerInterest,
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
  EMPTY_NEW_CUSTOMER,
} from "./crm-config";
import { getStatusConfig, formatSAR } from "./crm-helpers";
import { KanbanCard } from "./KanbanCard";
import { CustomerDrawer } from "./CustomerDrawer";

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CrmView({
  initialCustomers,
  initialTeamMembers,
  initialAvailableUnits,
}: {
  initialCustomers: any[];
  initialTeamMembers: any[];
  initialAvailableUnits: any[];
}) {
  const { lang } = useLanguage();
  const { can } = usePermissions();

  // Seeded from the Server Component's masked getCustomers() result — no
  // client mount-time fetch for the initial paint. `loadData()` below stays as
  // a callable refetch used after mutations to re-sync from the server.
  const [customers, setCustomers] = React.useState<any[]>(initialCustomers);
  const [teamMembers, setTeamMembers] = React.useState<any[]>(initialTeamMembers);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<"kanban" | "list">("kanban");
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [showLost, setShowLost] = React.useState(false);
  const [showPii, setShowPii] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Add modal
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [newCustomer, setNewCustomer] = React.useState(EMPTY_NEW_CUSTOMER);

  // CX-010 bulk import
  const [showImport, setShowImport] = React.useState(false);

  // Add modal — property linking (seeded server-side; refreshed by loadData())
  const [pageAvailableUnits, setPageAvailableUnits] = React.useState<any[]>(initialAvailableUnits);
  const [newCustUnitSearch, setNewCustUnitSearch] = React.useState("");
  const [newCustSelectedUnit, setNewCustSelectedUnit] = React.useState<any | null>(null);
  const [newCustIntent, setNewCustIntent] = React.useState<"BUY" | "RENT" | null>(null);

  // Delete dialog
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<any>(null);
  const [deleting, setDeleting] = React.useState(false);

  // Profile drawer
  const [drawerCustomer, setDrawerCustomer] = React.useState<any>(null);
  const [drawerAssignments, setDrawerAssignments] = React.useState<any[]>([]);
  const [loadingAssignments, setLoadingAssignments] = React.useState(false);

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
  }, [drawerCustomer?.id]);

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
      setTeamMembers(members.filter((m: any) => ["ADMIN", "MANAGER", "AGENT"].includes(m.role)));
      setPageAvailableUnits(units);
    } catch {
      setError(
        lang === "ar"
          ? "تعذّر تحميل بيانات العملاء. يرجى المحاولة مجدداً."
          : "Failed to load CRM data. Please try again."
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

  // ─── Add modal: unit search + budget comparison ─────────────────────────────

  const newCustFilteredUnits = React.useMemo(() => {
    if (!newCustUnitSearch.trim()) return [];
    const q = newCustUnitSearch.toLowerCase().trim();
    return pageAvailableUnits.filter((u) =>
      u.number?.toLowerCase().includes(q) ||
      u.city?.toLowerCase().includes(q) ||
      u.type?.toLowerCase().includes(q) ||
      u.buildingName?.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [newCustUnitSearch, pageAvailableUnits]);

  function getBudgetTag(unitPrice: number | null | undefined, budget: string, intent: "BUY" | "RENT" | null) {
    const b = Number(budget);
    if (!unitPrice || !b || b <= 0) return null;
    const ratio = unitPrice / b;
    if (ratio > 1.05) return {
      label: lang === "ar" ? "فوق الميزانية" : "Over Budget",
      color: "text-destructive bg-destructive/10",
    };
    if (ratio >= 0.9) return {
      label: lang === "ar" ? "ضمن الميزانية" : "On Budget",
      color: "text-success-strong bg-success/10",
    };
    return {
      label: lang === "ar" ? "أقل من الميزانية" : "Under Budget",
      color: "text-info-strong bg-info/10",
    };
  }

  function getUnitPrice(unit: any, intent: "BUY" | "RENT" | null) {
    if (intent === "RENT") return unit.rentalPrice ?? null;
    return unit.markupPrice ?? unit.price ?? null;
  }

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

  const listColumns = React.useMemo<ColumnDef<any, unknown>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: lang === "ar" ? "الاسم" : "Name",
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
        header: lang === "ar" ? "الهاتف" : "Phone",
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
        header: lang === "ar" ? "الميزانية" : "Budget",
        sortingFn: (a, b) => Number(a.original.budget ?? 0) - Number(b.original.budget ?? 0),
        cell: ({ row }) => {
          const b = row.original.budget;
          return (
            <span className="text-sm text-muted-foreground">
              {b
                ? `${Number(b).toLocaleString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-SA")} ${lang === "ar" ? "ر.س" : "SAR"}`
                : "—"}
            </span>
          );
        },
        meta: { numeric: true },
      },
      {
        id: "status",
        accessorKey: "status",
        header: lang === "ar" ? "الحالة" : "Status",
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
        header: lang === "ar" ? "المصدر" : "Source",
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
                aria-label={lang === "ar" ? "عرض" : "View"}
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  setDrawerCustomer(c);
                }}
              />
              {canDelete && (
                <IconButton
                  icon={Trash2}
                  aria-label={lang === "ar" ? "حذف" : "Delete"}
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
        lang === "ar"
          ? "فشل تحديث حالة العميل. يرجى المحاولة مجدداً."
          : "Failed to update status. Please try again."
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
        lang === "ar"
          ? "فشل تحديث حالة العميل. يرجى المحاولة مجدداً."
          : "Failed to update status. Please try again."
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
        lang === "ar"
          ? "فشل تحديث حالة العميل. يرجى المحاولة مجدداً."
          : "Failed to update status. Please try again."
      );
    } finally {
      setSavingLost(false);
    }
  }

  // ─── Add Customer ────────────────────────────────────────────────────────────

  async function handleAddCustomer() {
    if (!newCustomer.name.trim() || !newCustomer.phone.trim()) {
      setError(
        lang === "ar"
          ? "الاسم والهاتف حقلان مطلوبان."
          : "Name and phone are required."
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await createCustomer({
        name: newCustomer.name,
        phone: newCustomer.phone,
        email: newCustomer.email || undefined,
        nationalId: newCustomer.nationalId || undefined,
        nameArabic: newCustomer.nameArabic || undefined,
        source: newCustomer.source || undefined,
        status: newCustomer.status || undefined,
        personType: (newCustomer.personType as any) || undefined,
        gender: (newCustomer.gender as any) || undefined,
        dateOfBirth: newCustomer.dateOfBirth || undefined,
        nationality: newCustomer.nationality || undefined,
        maritalStatus: newCustomer.maritalStatus || undefined,
        budget: newCustomer.budget ? Number(newCustomer.budget) : undefined,
        agentId: newCustomer.agentId || undefined,
      });

      // Link property interest if a unit + intent was selected
      if (newCustSelectedUnit && newCustIntent) {
        await addCustomerInterest(created.id, newCustSelectedUnit.id, newCustIntent);
      }

      setCustomers((prev) => [created, ...prev]);
      trackEvent(AnalyticsEvent.CustomerCreated, { source: newCustomer.source || "manual" });
      setShowAddModal(false);
      setNewCustomer(EMPTY_NEW_CUSTOMER);
      setNewCustSelectedUnit(null);
      setNewCustIntent(null);
      setNewCustUnitSearch("");
    } catch (err: any) {
      // Only surface friendly messages — never raw Prisma/technical errors
      const msg = err?.message ?? "";
      const isFriendly = msg.length < 200 && !msg.includes("Prisma") && !msg.includes("Invalid `") && !msg.includes("invocation");
      setError(
        isFriendly && msg
          ? msg
          : lang === "ar"
            ? "تعذّر حفظ جهة الاتصال. يرجى التحقق من البيانات والمحاولة مجدداً."
            : "Failed to save contact. Please check the details and try again."
      );
    } finally {
      setSaving(false);
    }
  }

  // ─── Delete ──────────────────────────────────────────────────────────────────

  function openDelete(customer: any) {
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
    } catch (err: any) {
      setError(
        err?.message ||
          (lang === "ar"
            ? "فشل حذف العميل. يرجى المحاولة مجدداً."
            : "Failed to delete contact. Please try again.")
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

  function toneForStatus(status: string): "default" | "blue" | "green" | "amber" | "red" | "purple" {
    switch (status) {
      case "NEW":
        return "blue";
      case "CONTACTED":
      case "INTERESTED":
        return "purple";
      case "QUALIFIED":
      case "VIEWING":
        return "amber";
      case "NEGOTIATION":
      case "CONVERTED":
      case "ACTIVE_TENANT":
      case "RESERVED":
        return "green";
      case "LOST":
      case "PAST_TENANT":
        return "red";
      default:
        return "default";
    }
  }

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

  function renderMobileCardList(rows: any[], emptyLabel: { ar: string; en: string }) {
    if (rows.length === 0) {
      // No filters active AND no customers at all → first-time empty. Otherwise filter-empty.
      const isFirstTime = customers.length === 0;
      return isFirstTime ? (
        <EmptyState
          variant="first-time"
          icon={<Users className="h-12 w-12" />}
          title={lang === "ar" ? "لا يوجد عملاء بعد" : "No contacts yet"}
          description={
            lang === "ar"
              ? "أضف أول عميل محتمل وابدأ ببناء خط أعمالك."
              : "Add your first lead and start building your pipeline."
          }
          action={
            canWrite ? (
              <Button size="sm" onClick={openAddCustomerModal} style={{ display: "inline-flex" }}>
                <Plus className="h-4 w-4 me-1.5" />
                {lang === "ar" ? "إضافة عميل" : "Add contact"}
              </Button>
            ) : undefined
          }
          helpHref="/dashboard/help#crm"
          helpLabel={lang === "ar" ? "تعرّف على CRM" : "Learn about CRM"}
        />
      ) : (
        <EmptyState
          variant="filtered"
          icon={<Search className="h-10 w-10" />}
          title={emptyLabel[lang]}
          description={
            lang === "ar" ? "جرّب تعديل البحث أو الفلاتر." : "Try adjusting your search or filters."
          }
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearch("")}
              style={{ display: "inline-flex" }}
            >
              {lang === "ar" ? "مسح الفلاتر" : "Clear filters"}
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
    setNewCustomer(EMPTY_NEW_CUSTOMER);
    setNewCustSelectedUnit(null);
    setNewCustIntent(null);
    setNewCustUnitSearch("");
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
        title={lang === "ar" ? "إدارة العملاء" : "CRM"}
        lang={lang}
        trailing={
          <IconButton
            icon={Filter}
            aria-label={lang === "ar" ? "تصفية" : "Filter"}
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === "ar" ? "بحث بالاسم أو الهاتف..." : "Search by name or phone..."}
            className="h-10 ps-9"
          />
        </div>
      </div>

      <div className="px-4 pt-3">
        <MobileTabs
          ariaLabel={lang === "ar" ? "تبويبات العملاء" : "CRM tabs"}
          active={mobileTab}
          onChange={(k) => setMobileTab(k as "pipeline" | "leads" | "customers")}
          items={[
            { key: "pipeline", label: lang === "ar" ? "مسار الفرص العقارية" : "Pipeline" },
            {
              key: "leads",
              label: `${lang === "ar" ? "العملاء المحتملون" : "Leads"} (${mobileLeads.length})`,
            },
            {
              key: "customers",
              label: `${lang === "ar" ? "العملاء" : "Customers"} (${mobileCustomers.length})`,
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
                      {lang === "ar" ? "لا توجد صفقات في هذه المرحلة" : "No deals in this stage"}
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
          label={lang === "ar" ? "إضافة عميل" : "New Contact"}
          onClick={openAddCustomerModal}
        />
      )}

      {/* Mobile filters sheet */}
      <BottomSheet
        open={showMobileFilters}
        onOpenChange={setShowMobileFilters}
        title={lang === "ar" ? "تصفية" : "Filters"}
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
        <div className="space-y-5">
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {lang === "ar" ? "الحالة" : "Status"}
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
                {lang === "ar" ? "الكل" : "All"}
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
                {lang === "ar" ? "الخسائر فقط" : "Lost only"}
              </Button>
            </div>
          </div>

          {hasPiiAccess && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {lang === "ar" ? "الخصوصية" : "Privacy"}
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
                  ? lang === "ar"
                    ? "إخفاء البيانات الحساسة"
                    : "Hide PII"
                  : lang === "ar"
                    ? "عرض البيانات الحساسة"
                    : "Show PII"}
              </Button>
            </div>
          )}

          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <Handshake className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {lang === "ar"
                ? "سحب البطاقات بين مراحل مسار الفرص متاح على سطح المكتب."
                : "Drag-and-drop pipeline available on desktop."}
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
        title={lang === "ar" ? "إدارة العملاء" : "CRM"}
        description={
          lang === "ar"
            ? "تتبع العملاء المحتملين وإدارة خط أنابيب المبيعات"
            : "Track leads and manage your sales pipeline"
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
                  ? lang === "ar" ? "إخفاء البيانات الحساسة" : "Hide PII"
                  : lang === "ar" ? "عرض البيانات الحساسة" : "Show PII"}
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
                {lang === "ar" ? "تصدير" : "Export"}
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
                {lang === "ar" ? "استيراد" : "Import"}
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
                {lang === "ar" ? "إضافة عميل" : "Add Customer"}
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
            aria-label={lang === "ar" ? "إغلاق" : "Dismiss"}
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
          label={lang === "ar" ? "إجمالي جهات الاتصال" : "Active Contacts"}
          value={kpis.total}
          subtitle={lang === "ar" ? "جميع العملاء النشطين" : "All active contacts"}
          icon={<Users className="h-[18px] w-[18px]" />}
          accentColor="primary"
          loading={loading}
        />
        <KPICard
          label={lang === "ar" ? "عملاء جدد" : "New Leads"}
          value={kpis.newLeads}
          subtitle={lang === "ar" ? "بانتظار التواصل" : "Awaiting first contact"}
          icon={<UserPlus className="h-[18px] w-[18px]" />}
          accentColor="info"
          loading={loading}
        />
        <KPICard
          label={lang === "ar" ? "في مسار الفرص" : "In Pipeline"}
          value={kpis.inProgress}
          subtitle={lang === "ar" ? "في مراحل متقدمة" : "Contacted through Negotiation"}
          icon={<TrendingUp className="h-[18px] w-[18px]" />}
          accentColor="warning"
          loading={loading}
        />
        <KPICard
          label={lang === "ar" ? "خسائر" : "Lost Leads"}
          value={kpis.lost}
          subtitle={lang === "ar" ? "عملاء خرجوا من المسار" : "Exited pipeline"}
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
              {lang === "ar" ? "الكل" : "All"} {customers.filter(c => c.status !== "LOST").length}
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
              {lang === "ar" ? "خسائر" : "Lost"} {kpis.lost}
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
              {lang === "ar" ? "كانبان" : "Kanban"}
            </Button>
            <Button
              variant={viewMode === "list" ? "primary" : "subtle"}
              size="sm"
              style={{ display: "inline-flex" }}
              className="rounded-full"
              aria-pressed={viewMode === "list"}
              onClick={() => setViewMode("list")}
            >
              {lang === "ar" ? "قائمة" : "List"}
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              lang === "ar"
                ? "ابحث بالاسم أو رقم الهاتف..."
                : "Search by name or phone..."
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
                      {lang === "ar" ? "ر.س" : "SAR"}
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
                    onViewProfile={setDrawerCustomer}
                    onDelete={openDelete}
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
                      setNewCustomer((prev) => ({ ...prev, status: status.key }));
                      setShowAddModal(true);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {lang === "ar" ? "إضافة" : "Add"}
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
          emptyTitle={lang === "ar" ? "لا توجد نتائج" : "No contacts found"}
          emptyDescription={
            lang === "ar"
              ? "حاول تعديل خيارات البحث أو الفلتر، أو أضف عميلاً جديداً."
              : "Try adjusting your search or filter, or add a new contact."
          }
          emptyAction={
            !search.trim() && !statusFilter ? (
              <Button
                onClick={openAddCustomerModal}
                style={{ display: "inline-flex" }}
                className="gap-2"
              >
                <UserPlus className="h-4 w-4" />
                {lang === "ar" ? "إضافة عميل" : "Add contact"}
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
                      ? `${Number(c.budget).toLocaleString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-SA")} ${lang === "ar" ? "ر.س" : "SAR"}`
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
                      aria-label={lang === "ar" ? "عرض الملف" : "View profile"}
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
                        aria-label={lang === "ar" ? "حذف" : "Delete"}
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
        title={lang === "ar" ? "تحديد سبب الخسارة" : "Mark as Lost"}
        description={
          lang === "ar"
            ? `الرجاء تحديد سبب خسارة العميل "${lostTarget?.name}"`
            : `Please select why "${lostTarget?.name}" was lost`
        }
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              style={{ display: "inline-flex" }}
              onClick={() => setShowLostModal(false)}
              disabled={savingLost}
            >
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              variant="destructive"
              style={{ display: "inline-flex" }}
              className="gap-2"
              onClick={confirmLost}
              disabled={!lostReason || savingLost}
            >
              {savingLost && <Loader2 className="h-4 w-4 animate-spin" />}
              {lang === "ar" ? "تأكيد الخسارة" : "Confirm Lost"}
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
        title={lang === "ar" ? "تأكيد الحذف" : "Confirm Deletion"}
        description={
          lang === "ar"
            ? `هل أنت متأكد من حذف "${deleteTarget?.name}"؟ لا يمكن التراجع عن هذا الإجراء.`
            : `Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`
        }
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              style={{ display: "inline-flex" }}
              onClick={() => { setShowDeleteDialog(false); setError(null); }}
              disabled={deleting}
            >
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              variant="destructive"
              style={{ display: "inline-flex" }}
              className="gap-2"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {lang === "ar" ? "حذف" : "Delete"}
            </Button>
          </div>
        }
      >
        {error && <p className="text-sm text-destructive">{error}</p>}
      </ResponsiveDialog>
    </div>
    </div>

      {/* ── Add Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
          <div
            className="bg-card w-full max-w-lg rounded-xl shadow-2xl border border-border animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto"
            dir={lang === "ar" ? "rtl" : "ltr"}
          >
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-lg font-bold text-foreground">
                {lang === "ar" ? "إضافة عميل جديد" : "Add New Customer"}
              </h2>
              <IconButton
                icon={X}
                aria-label={lang === "ar" ? "إغلاق" : "Close"}
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowAddModal(false)}
              />
            </div>

            <div className="p-6 space-y-4">
              {/* Required fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">
                    {lang === "ar" ? "الاسم الكامل *" : "Full Name *"}
                  </label>
                  <Input
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    placeholder={lang === "ar" ? "الاسم بالكامل" : "Full name"}
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">
                    {lang === "ar" ? "الاسم بالعربية" : "Arabic Name"}
                  </label>
                  <Input
                    value={newCustomer.nameArabic}
                    onChange={(e) => setNewCustomer({ ...newCustomer, nameArabic: e.target.value })}
                    placeholder="الاسم بالعربية"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">
                    {lang === "ar" ? "رقم الجوال *" : "Phone *"}
                  </label>
                  <SaudiPhoneInput
                    value={newCustomer.phone}
                    onChange={(e164) => setNewCustomer({ ...newCustomer, phone: e164 })}
                    placeholder="+966 5x xxx xxxx"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">
                    {lang === "ar" ? "البريد الإلكتروني" : "Email"}
                  </label>
                  <Input
                    type="email"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                    placeholder="email@example.com"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">
                    {lang === "ar" ? "المصدر" : "Source"}
                  </label>
                  <select
                    value={newCustomer.source}
                    onChange={(e) => setNewCustomer({ ...newCustomer, source: e.target.value })}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">{lang === "ar" ? "اختر المصدر" : "Select source"}</option>
                    {Object.entries(SOURCE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label[lang]}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">
                    {lang === "ar" ? "الحالة" : "Status"}
                  </label>
                  <select
                    value={newCustomer.status}
                    onChange={(e) => setNewCustomer({ ...newCustomer, status: e.target.value })}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {PIPELINE_STAGES.map((s) => (
                      <option key={s.key} value={s.key}>{s.label[lang]}</option>
                    ))}
                  </select>
                </div>

                {/* CRM fields: Budget + Property Type */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">
                    {lang === "ar" ? "الميزانية (ريال)" : "Budget (SAR)"}
                  </label>
                  <SARAmountInput
                    value={newCustomer.budget === "" ? null : Number(newCustomer.budget)}
                    onChange={(n) => setNewCustomer({ ...newCustomer, budget: n == null ? "" : String(n) })}
                    placeholder={lang === "ar" ? "مثال: 500000" : "e.g. 500000"}
                    locale={lang}
                  />
                </div>
                {/* ── Link Property (Optional) ── */}
                <div className="col-span-2 space-y-2 pt-1">
                  <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                    <Link2 className="h-3.5 w-3.5" />
                    {lang === "ar" ? "ربط عقار (اختياري)" : "Link Property (Optional)"}
                  </label>

                  {/* Selected unit pill */}
                  {newCustSelectedUnit ? (
                    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-foreground truncate">
                          {newCustSelectedUnit.number}
                        </span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{newCustSelectedUnit.type}</span>
                        {newCustSelectedUnit.city && (
                          <>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">{newCustSelectedUnit.city}</span>
                          </>
                        )}
                        {newCustIntent && (
                          <span className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                            newCustIntent === "BUY"
                              ? "bg-info/15 text-info-strong"
                              : "bg-primary/15 text-primary"
                          )}>
                            {newCustIntent === "BUY" ? (lang === "ar" ? "شراء" : "BUY") : (lang === "ar" ? "إيجار" : "RENT")}
                          </span>
                        )}
                      </div>
                      <IconButton
                        icon={X}
                        aria-label={lang === "ar" ? "إزالة" : "Remove"}
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => { setNewCustSelectedUnit(null); setNewCustIntent(null); setNewCustUnitSearch(""); }}
                      />
                    </div>
                  ) : (
                    <>
                      {/* Search input */}
                      <div className="relative">
                        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                          value={newCustUnitSearch}
                          onChange={(e) => setNewCustUnitSearch(e.target.value)}
                          placeholder={lang === "ar" ? "ابحث برقم الوحدة أو المدينة..." : "Search by unit number or city..."}
                          className="ps-9 text-sm"
                        />
                      </div>

                      {/* Results list */}
                      {newCustUnitSearch.trim() ? (
                        newCustFilteredUnits.length > 0 ? (
                          <div className="border border-border rounded-lg overflow-hidden divide-y divide-border max-h-48 overflow-y-auto">
                            {newCustFilteredUnits.map((unit) => {
                              const price = getUnitPrice(unit, newCustIntent);
                              const tag = getBudgetTag(price, newCustomer.budget, newCustIntent);
                              return (
                                <Button
                                  key={unit.id}
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  style={{ display: "flex", width: "100%" }}
                                  className="items-center justify-between gap-3 px-3 py-2.5 text-start h-auto rounded-none"
                                  onClick={() => { setNewCustSelectedUnit(unit); setNewCustUnitSearch(""); }}
                                >
                                  <div className="flex items-center gap-1.5 min-w-0 text-sm">
                                    <span className="font-medium text-foreground truncate">{unit.number}</span>
                                    <span className="text-muted-foreground">·</span>
                                    <span className="text-muted-foreground text-xs">{unit.type}</span>
                                    {unit.city && (
                                      <>
                                        <span className="text-muted-foreground">·</span>
                                        <span className="text-muted-foreground text-xs truncate">{unit.city}</span>
                                      </>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {price && (
                                      <span className="text-xs font-mono text-muted-foreground" dir="ltr">
                                        {Number(price).toLocaleString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-SA")} {lang === "ar" ? "ر.س" : "SAR"}
                                      </span>
                                    )}
                                    {tag && (
                                      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", tag.color)}>
                                        {tag.label}
                                      </span>
                                    )}
                                  </div>
                                </Button>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground text-center py-3">
                            {lang === "ar" ? "لا توجد وحدات مطابقة للبحث" : "No units match your search"}
                          </p>
                        )
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2 px-1">
                          <Search className="h-3.5 w-3.5 shrink-0" />
                          {lang === "ar" ? "ابدأ البحث للعثور على وحدات متاحة" : "Search to find available units"}
                        </div>
                      )}
                    </>
                  )}

                  {/* Intent selection — shown after unit is selected */}
                  {newCustSelectedUnit && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-muted-foreground">
                        {lang === "ar" ? "نوع الاهتمام" : "Interest Type"}
                      </label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={newCustIntent === "BUY" ? "primary" : "outline"}
                          size="sm"
                          style={{ display: "inline-flex", flex: 1 }}
                          className={cn(
                            "py-2 text-sm h-auto justify-center",
                            newCustIntent === "BUY"
                              ? "bg-info text-info-foreground border-info hover:bg-info/90"
                              : ""
                          )}
                          onClick={() => setNewCustIntent("BUY")}
                        >
                          {lang === "ar" ? "شراء" : "Buy"}
                        </Button>
                        <Button
                          type="button"
                          variant={newCustIntent === "RENT" ? "primary" : "outline"}
                          size="sm"
                          style={{ display: "inline-flex", flex: 1 }}
                          className="py-2 text-sm h-auto justify-center"
                          onClick={() => setNewCustIntent("RENT")}
                        >
                          {lang === "ar" ? "إيجار" : "Rent"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Agent Assignment */}
                {teamMembers.length > 0 && (
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs font-bold text-muted-foreground">
                      {lang === "ar" ? "تعيين المسؤول" : "Assign Agent"}
                    </label>
                    <select
                      value={newCustomer.agentId}
                      onChange={(e) => setNewCustomer({ ...newCustomer, agentId: e.target.value })}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">{lang === "ar" ? "غير معين" : "Unassigned"}</option>
                      {teamMembers.map((m: any) => (
                        <option key={m.id} value={m.id}>{m.name ?? m.email}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Optional Absher fields */}
              <details className="group">
                <summary className="cursor-pointer text-xs font-bold text-muted-foreground hover:text-foreground transition-colors list-none flex items-center gap-2 py-1">
                  {/* Disclosure caret (rotates to open), not a nav arrow — do not wrap in DirectionalIcon */}
                  <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
                  {lang === "ar" ? "بيانات إضافية (أبشر)" : "Additional Details (Absher)"}
                </summary>
                <div className="pt-3 grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground">
                      {lang === "ar" ? "رقم الهوية" : "National ID"}
                    </label>
                    <NationalIdInput
                      value={newCustomer.nationalId}
                      onChange={(raw) => setNewCustomer({ ...newCustomer, nationalId: raw })}
                      placeholder="10x xxx xxxx"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground">
                      {lang === "ar" ? "نوع الشخص" : "Person Type"}
                    </label>
                    <select
                      value={newCustomer.personType}
                      onChange={(e) => setNewCustomer({ ...newCustomer, personType: e.target.value })}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">—</option>
                      <option value="INDIVIDUAL">{lang === "ar" ? "فرد" : "Individual"}</option>
                      <option value="COMPANY">{lang === "ar" ? "شركة" : "Company"}</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground">
                      {lang === "ar" ? "الجنس" : "Gender"}
                    </label>
                    <select
                      value={newCustomer.gender}
                      onChange={(e) => setNewCustomer({ ...newCustomer, gender: e.target.value })}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">—</option>
                      <option value="MALE">{lang === "ar" ? "ذكر" : "Male"}</option>
                      <option value="FEMALE">{lang === "ar" ? "أنثى" : "Female"}</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground">
                      {lang === "ar" ? "الجنسية" : "Nationality"}
                    </label>
                    <Input
                      value={newCustomer.nationality}
                      onChange={(e) => setNewCustomer({ ...newCustomer, nationality: e.target.value })}
                      placeholder={lang === "ar" ? "سعودي" : "Saudi"}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground">
                      {lang === "ar" ? "الحالة الاجتماعية" : "Marital Status"}
                    </label>
                    <select
                      value={newCustomer.maritalStatus}
                      onChange={(e) => setNewCustomer({ ...newCustomer, maritalStatus: e.target.value })}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">—</option>
                      <option value="SINGLE">{lang === "ar" ? "أعزب" : "Single"}</option>
                      <option value="MARRIED">{lang === "ar" ? "متزوج" : "Married"}</option>
                      <option value="DIVORCED">{lang === "ar" ? "مطلق" : "Divorced"}</option>
                      <option value="WIDOWED">{lang === "ar" ? "أرمل" : "Widowed"}</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground">
                      {lang === "ar" ? "تاريخ الميلاد" : "Date of Birth"}
                    </label>
                    <Input
                      type="date"
                      value={newCustomer.dateOfBirth}
                      onChange={(e) => setNewCustomer({ ...newCustomer, dateOfBirth: e.target.value })}
                    />
                  </div>
                </div>
              </details>

              {/* Inline error */}
              {error && (
                <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 pb-6">
              <Button
                variant="secondary"
                style={{ display: "inline-flex" }}
                onClick={() => { setShowAddModal(false); setError(null); setNewCustSelectedUnit(null); setNewCustIntent(null); setNewCustUnitSearch(""); }}
                disabled={saving}
              >
                {lang === "ar" ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                onClick={handleAddCustomer}
                disabled={saving}
                style={{ display: "inline-flex" }}
                className="gap-2"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {lang === "ar" ? "حفظ جهة الاتصال" : "Save Contact"}
              </Button>
            </div>
          </div>
        </div>
      )}

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
