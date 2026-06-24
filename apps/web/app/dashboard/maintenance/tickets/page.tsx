"use client";

import { useLanguage } from "../../../../components/LanguageProvider";
import * as React from "react";
import {
  Wrench,
  Clock,
  CheckCircle,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Loader2,
  Search,
  Pencil,
  Trash2,
  Eye,
  CalendarCheck,
  UserCircle,
  Download,
  Filter,
} from "lucide-react";
import { exportToExcel } from "../../../../lib/export";
import {
  Button,
  IconButton,
  ConfirmDialog,
  ResponsiveDialog,
  KPICard,
  DataTable,
  type ColumnDef,
  PageIntro,
  FilterBar,
  StatusBadge,
  AppBar,
  MobileTabs,
  DataCard,
  BottomSheet,
  FAB,
  EmptyState,
  Field,
  SelectField,
  Input,
  HijriDatePicker,
} from "@repo/ui";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useUnsavedChanges } from "../../../../hooks/useUnsavedChanges";
import {
  getMaintenanceRequests,
  getMaintenanceStats,
  createMaintenanceRequest,
  updateMaintenanceRequest,
  deleteMaintenanceRequest,
  getAssignableUsers,
  getUnitsForMaintenance,
} from "../../../actions/maintenance";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  MAINTENANCE_CATEGORY_LABEL as categoryLabels,
  MAINTENANCE_PRIORITY_LABEL as priorityLabels,
  MAINTENANCE_STATUS_LABEL as statusLabels,
} from "../../../../lib/domain-labels";
import { trackEvent, AnalyticsEvent } from "../../../../lib/analytics";
import type {
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceStatus,
  UserRole,
} from "@repo/db";

// ─── Serialized view-model types ──────────────────────────────────────────────
// These mirror the runtime shapes returned by the maintenance server actions
// after `serialize()` (Prisma `Date`/`Decimal` → string across the RSC boundary).

/** Unit shape returned by `getUnitsForMaintenance` / nested in a request's `unit`.
 *  `building` is an optional relation the UI defensively reads; it is not part of
 *  the action's `include`, so it is typed optional to match runtime. */
type MaintenanceUnitVM = {
  id: string;
  number: string;
  buildingName: string | null;
  building?: { name: string | null } | null;
};

/** Assignee shape (`assignedTo` select / `getAssignableUsers`). */
type MaintenanceUserVM = {
  id: string;
  name: string | null;
  role?: UserRole;
};

/** A maintenance request as serialized by `getMaintenanceRequests`. */
type MaintenanceRequestVM = {
  id: string;
  title: string;
  description: string | null;
  category: MaintenanceCategory;
  status: MaintenanceStatus;
  priority: MaintenancePriority;
  unitId: string;
  unit: MaintenanceUnitVM | null;
  assignedToId: string | null;
  assignedTo: MaintenanceUserVM | null;
  scheduledDate: string | null;
  dueDate: string | null;
  estimatedCost: string | null;
  notes: string | null;
  isPreventive: boolean;
};

/** Aggregate counts returned by `getMaintenanceStats`. */
type MaintenanceStats = {
  open: number;
  assigned: number;
  inProgress: number;
  onHold: number;
  overdue: number;
  completedThisMonth: number;
};

function MaintenancePageInner() {
  const { t, lang } = useLanguage();
  const searchParams = useSearchParams();
  // When arriving from a unit's "New Request" action: prefill + lock the unit so a
  // ticket can never be filed against the wrong unit (was defaulting to units[0]).
  const presetUnitId = searchParams.get("unitId");
  const autoOpenNew = searchParams.get("new") === "1";
  const [requests, setRequests] = React.useState<MaintenanceRequestVM[]>([]);
  const [stats, setStats] = React.useState<MaintenanceStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [users, setUsers] = React.useState<MaintenanceUserVM[]>([]);
  const [units, setUnits] = React.useState<MaintenanceUnitVM[]>([]);

  // Filters
  const [search, setSearch] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState("");
  const [filterPriority, setFilterPriority] = React.useState("");
  const [filterCategory, setFilterCategory] = React.useState("");

  // Mobile filter sheet
  const [showFilters, setShowFilters] = React.useState(false);

  // Delete confirmation
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null);

  // Modal
  const [showModal, setShowModal] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  // Form-level save error (§6.11.4 — never fail silently). Parity with Units.
  const [saveError, setSaveError] = React.useState<string | null>(null);

  // ── RHF + zod (QA-FE-02) — schema rebuilt per lang/edit-mode so messages and
  // the create-only `unitId` requirement track the current state. ────────────
  const ticketSchema = React.useMemo(
    () =>
      z.object({
        title: z
          .string()
          .min(1, t("العنوان مطلوب", "Title is required")),
        description: z
          .string()
          .min(1, t("الوصف مطلوب", "Description is required")),
        category: z
          .string()
          .min(1, t("التصنيف مطلوب", "Category is required")),
        priority: z
          .string()
          .min(1, t("الأولوية مطلوبة", "Priority is required")),
        // Unit is required only when creating; the edit path does not send it.
        unitId: editingId
          ? z.string().optional()
          : z.string().min(1, t("الوحدة مطلوبة", "Unit is required")),
        assignedToId: z.string().optional(),
        scheduledDate: z.string().optional(),
        estimatedCost: z.string().optional(),
        notes: z.string().optional(),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` is derived from `lang`, which is already a dep; listing `lang` covers every translation read here.
    [lang, editingId],
  );

  type TicketFormValues = z.infer<typeof ticketSchema>;

  const EMPTY_DEFAULTS: TicketFormValues = {
    title: "",
    description: "",
    category: "GENERAL",
    priority: "MEDIUM",
    unitId: "",
    assignedToId: "",
    scheduledDate: "",
    estimatedCost: "",
    notes: "",
  };

  const { control, handleSubmit, reset, formState } = useForm<TicketFormValues>({
    resolver: zodResolver(ticketSchema),
    mode: "onTouched",
    defaultValues: EMPTY_DEFAULTS,
  });

  useUnsavedChanges(formState.isDirty);

  React.useEffect(() => {
    load();
    loadRefs();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only initial fetch; `load`/`loadRefs` are recreated each render and the debounced effect below handles every subsequent refresh.
  }, []);

  async function load() {
    setLoading(true);
    try {
      const filters: {
        status?: string;
        priority?: string;
        category?: string;
        search?: string;
      } = {};
      if (filterStatus) filters.status = filterStatus;
      if (filterPriority) filters.priority = filterPriority;
      if (filterCategory) filters.category = filterCategory;
      if (search) filters.search = search;

      const [data, statsData] = await Promise.all([
        getMaintenanceRequests(filters),
        getMaintenanceStats(),
      ]);
      setRequests(data);
      setStats(statsData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadRefs() {
    try {
      const [u, un] = await Promise.all([getAssignableUsers(), getUnitsForMaintenance()]);
      setUsers(u);
      setUnits(un);
    } catch (e) {
      console.error(e);
    }
  }

  React.useEffect(() => {
    const timer = setTimeout(() => load(), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally re-runs only when a filter/search input changes; `load` is recreated each render and reads the latest filter state via closure.
  }, [search, filterStatus, filterPriority, filterCategory]);

  function openCreate(lockedUnitId?: string) {
    setEditingId(null);
    setSaveError(null);
    reset({
      ...EMPTY_DEFAULTS,
      // When launched from a unit, pin that unit; otherwise no default (force the
      // user to pick) rather than silently picking units[0] — that was how a ticket
      // could be filed against the wrong unit.
      unitId: lockedUnitId ?? "",
    });
    setShowModal(true);
  }

  // Auto-open the create form when arriving from a unit's "New Request" action
  // (?new=1&unitId=…). Runs once units are loaded so the locked unit resolves; a
  // ref guard makes it fire a single time even though `units` changes by reference.
  const autoOpenedRef = React.useRef(false);
  React.useEffect(() => {
    if (autoOpenedRef.current) return;
    if (!autoOpenNew) return;
    if (units.length === 0) return; // wait for refs so the locked unit is selectable
    autoOpenedRef.current = true;
    openCreate(presetUnitId ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot launcher guarded by autoOpenedRef; intentionally keyed to units readiness, not openCreate identity.
  }, [autoOpenNew, presetUnitId, units]);

  function openEdit(req: MaintenanceRequestVM) {
    setEditingId(req.id);
    setSaveError(null);
    reset({
      title: req.title ?? "",
      description: req.description ?? "",
      category: req.category ?? "GENERAL",
      priority: req.priority ?? "MEDIUM",
      unitId: req.unitId ?? "",
      assignedToId: req.assignedToId ?? "",
      scheduledDate: req.scheduledDate
        ? new Date(req.scheduledDate).toISOString().slice(0, 10)
        : "",
      estimatedCost: req.estimatedCost?.toString() ?? "",
      notes: req.notes ?? "",
    });
    setShowModal(true);
  }

  const onSubmit = handleSubmit(async (values) => {
    setSaving(true);
    setSaveError(null);
    try {
      if (editingId) {
        await updateMaintenanceRequest(editingId, {
          title: values.title,
          description: values.description || undefined,
          category: values.category,
          priority: values.priority,
          assignedToId: values.assignedToId || null,
          scheduledDate: values.scheduledDate || null,
          estimatedCost: values.estimatedCost ? parseFloat(values.estimatedCost) : null,
          notes: values.notes || null,
        });
      } else {
        await createMaintenanceRequest({
          title: values.title,
          description: values.description || undefined,
          category: values.category,
          priority: values.priority,
          unitId: values.unitId ?? "",
          assignedToId: values.assignedToId || undefined,
          scheduledDate: values.scheduledDate || undefined,
          estimatedCost: values.estimatedCost ? parseFloat(values.estimatedCost) : undefined,
          notes: values.notes || undefined,
        });
        trackEvent(AnalyticsEvent.MaintenanceTicketCreated, {
          category: values.category,
          priority: values.priority,
        });
      }
      setShowModal(false);
      reset(EMPTY_DEFAULTS);
      await load();
    } catch (e) {
      console.error(e);
      setSaveError(
        t("تعذّر حفظ الطلب. حاول مرة أخرى أو تواصل مع الدعم.", "We couldn't save the request. Try again or contact support."),
      );
    } finally {
      setSaving(false);
    }
  });

  function handleDelete(id: string) {
    setPendingDeleteId(id);
    setConfirmDeleteOpen(true);
  }

  async function executeDelete() {
    if (!pendingDeleteId) return;
    try {
      await deleteMaintenanceRequest(pendingDeleteId);
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setPendingDeleteId(null);
    }
  }

  function handleExport() {
    exportToExcel({
      data: requests,
      filename: t("طلبات_الصيانة", "maintenance_requests"),
      title: t("تقرير طلبات الصيانة", "Maintenance Requests Report"),
      lang,
      columns: [
        {
          header: t("رقم الطلب", "Request #"),
          key: "requestNumber",
          width: 18,
        },
        {
          header: t("العنوان", "Title"),
          key: "title",
          width: 30,
        },
        {
          header: t("التصنيف", "Category"),
          key: "category",
          width: 18,
          render: (val: string) => categoryLabels[val]?.[lang] ?? val,
        },
        {
          header: t("الأولوية", "Priority"),
          key: "priority",
          width: 15,
          render: (val: string) => priorityLabels[val]?.[lang] ?? val,
        },
        {
          header: t("الحالة", "Status"),
          key: "status",
          width: 18,
          render: (val: string) => statusLabels[val]?.[lang] ?? val,
        },
        {
          header: t("المُعيَّن إليه", "Assigned To"),
          key: "assignedTo",
          width: 22,
          render: (val: MaintenanceUserVM | null) => val?.name ?? (t("غير معيّن", "Unassigned")),
        },
        {
          header: t("تاريخ الإنشاء", "Created Date"),
          key: "createdAt",
          width: 18,
          render: (val: string) => val ? new Date(val).toLocaleDateString("en-SA") : "—",
        },
      ],
    });
  }

  // Build status filter tabs for FilterBar
  const statusFilterOptions = [
    { label: t("الكل", "All"), value: "" },
    ...Object.entries(statusLabels).map(([k, v]) => ({
      label: v[lang],
      value: k,
    })),
  ];

  const inputClass =
    "w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors";

  // ─── Mobile helpers ───────────────────────────────────────────
  // Mobile tabs reflect status (aligned with desktop FilterBar tabs)
  const mobileTabs = [
    { key: "", label: t("الكل", "All") },
    { key: "OPEN", label: statusLabels.OPEN![lang] },
    { key: "IN_PROGRESS", label: statusLabels.IN_PROGRESS![lang] },
    { key: "OVERDUE", label: t("متأخرة", "Overdue") },
    { key: "RESOLVED", label: statusLabels.RESOLVED![lang] },
  ];

  function isTicketOverdue(t: MaintenanceRequestVM): boolean {
    return Boolean(
      t.dueDate &&
        new Date(t.dueDate) < new Date() &&
        !["RESOLVED", "CLOSED"].includes(t.status),
    );
  }

  function toneForTicket(t: MaintenanceRequestVM): "red" | "amber" | "green" | "blue" | "default" {
    if (isTicketOverdue(t)) return "red";
    if (["RESOLVED", "CLOSED"].includes(t.status)) return "green";
    if (t.priority === "URGENT") return "red";
    if (t.priority === "HIGH") return "amber";
    if (["ASSIGNED", "IN_PROGRESS"].includes(t.status)) return "blue";
    if (t.status === "OPEN") return "amber";
    return "default";
  }

  function iconForTicket(t: MaintenanceRequestVM) {
    if (isTicketOverdue(t)) return AlertTriangle;
    if (["RESOLVED", "CLOSED"].includes(t.status)) return CheckCircle2;
    if (["ASSIGNED", "IN_PROGRESS"].includes(t.status)) return Clock;
    return Wrench;
  }

  // Apply mobile tab filter client-side on top of server-filtered list
  const visibleRequests = React.useMemo(() => {
    if (!filterStatus) return requests;
    if (filterStatus === "OVERDUE") return requests.filter(isTicketOverdue);
    return requests.filter((r) => r.status === filterStatus);
  }, [requests, filterStatus]);

  function formatShortDate(d: string | Date | null | undefined): string {
    if (!d) return t("بدون موعد", "No date");
    return new Date(d).toLocaleDateString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-SA", {
      month: "short",
      day: "numeric",
    });
  }

  // ─── DataTable column definitions ────────────────────────────
  const columns: ColumnDef<MaintenanceRequestVM, unknown>[] = [
    {
      accessorKey: "title",
      header: t("العنوان", "Title"),
      cell: ({ row }) => {
        const r = row.original;
        return (
          <Link
            href={`/dashboard/maintenance/${r.id}`}
            className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
          >
            {r.title}
            {r.isPreventive && (
              <span className="text-[9px] text-success me-1">[{t("وقائي", "Preventive")}]</span>
            )}
          </Link>
        );
      },
      enableSorting: true,
    },
    {
      accessorKey: "unit",
      header: t("الوحدة", "Unit"),
      cell: ({ row }) => {
        const r = row.original;
        return (
          <span className="text-sm text-foreground">
            {r.unit?.number ?? "—"}{r.unit?.building?.name ? ` — ${r.unit.building.name}` : ""}
          </span>
        );
      },
      enableSorting: false,
    },
    {
      accessorKey: "category",
      header: t("التصنيف", "Category"),
      cell: ({ row }) => {
        const cat = categoryLabels[row.original.category] ?? { ar: row.original.category, en: row.original.category };
        return <span className="text-xs text-muted-foreground">{cat[lang]}</span>;
      },
      enableSorting: true,
    },
    {
      accessorKey: "priority",
      header: t("الأولوية", "Priority"),
      cell: ({ row }) => {
        const priority = priorityLabels[row.original.priority] ?? { ar: row.original.priority, en: row.original.priority, color: "text-muted-foreground" };
        return <span className={`text-xs font-semibold ${priority.color}`}>{priority[lang]}</span>;
      },
      enableSorting: true,
    },
    {
      accessorKey: "status",
      header: t("الحالة", "Status"),
      cell: ({ row }) => {
        const r = row.original;
        const statusLabel = statusLabels[r.status] ?? { ar: r.status, en: r.status };
        return (
          <StatusBadge
            entityType="maintenance"
            status={r.status}
            label={statusLabel[lang]}
            className="text-[10px]"
          />
        );
      },
      enableSorting: true,
    },
    {
      accessorKey: "assignedTo",
      header: t("المُعيَّن", "Assigned"),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.assignedTo?.name ?? "—"}
        </span>
      ),
      enableSorting: false,
    },
    {
      accessorKey: "dueDate",
      header: t("الاستحقاق", "Due"),
      cell: ({ row }) => {
        const r = row.original;
        const isOverdue = r.dueDate && new Date(r.dueDate) < new Date() && !["RESOLVED", "CLOSED"].includes(r.status);
        return r.dueDate ? (
          <span className={`text-xs ${isOverdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
            {new Date(r.dueDate).toLocaleDateString("en-SA")}
            {isOverdue && <AlertTriangle className="inline h-3 w-3 me-1" />}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">{"—"}</span>
        );
      },
      enableSorting: true,
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="flex items-center gap-1">
            <Link href={`/dashboard/maintenance/${r.id}`}>
              <IconButton
                icon={Eye}
                aria-label={t("عرض", "View")}
                variant="ghost"
              />
            </Link>
            <IconButton
              icon={Pencil}
              aria-label={t("تعديل", "Edit")}
              variant="ghost"
              onClick={() => openEdit(r)}
            />
            <IconButton
              icon={Trash2}
              aria-label={t("حذف", "Delete")}
              variant="ghost"
              className="text-destructive hover:text-destructive/80"
              onClick={() => handleDelete(r.id)}
            />
          </div>
        );
      },
    },
  ];

  return (
    <>
    <div className="md:hidden -m-4 sm:-m-6 min-h-dvh flex flex-col bg-background">
      <AppBar
        title={t("الصيانة", "Maintenance")}
        lang={lang}
        trailing={
          <IconButton
            icon={Filter}
            aria-label={t("تصفية", "Filter")}
            onClick={() => setShowFilters(true)}
            variant="ghost"
            className="h-11 w-11 rounded-full"
          />
        }
      />

      <div className="px-4 pt-3">
        <MobileTabs
          items={mobileTabs}
          active={
            filterStatus === "OVERDUE"
              ? "OVERDUE"
              : mobileTabs.find((t) => t.key === filterStatus)
              ? filterStatus
              : ""
          }
          onChange={(k) => setFilterStatus(k)}
          ariaLabel={t("تصفية الحالة", "Status filter")}
        />
      </div>

      <div className="flex-1 px-4 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : visibleRequests.length === 0 ? (
          filterStatus || search || filterPriority || filterCategory ? (
            <EmptyState
              variant="filtered"
              icon={<Search className="h-10 w-10" />}
              title={t("لا توجد نتائج مطابقة", "No matching requests")}
              description={
                t("جرّب تعديل الفلاتر أو البحث بكلمات أخرى.", "Try adjusting the filters or search terms.")
              }
              action={
                <Button
                  variant="outline"
                  size="sm"
                  style={{ display: "inline-flex" }}
                  onClick={() => {
                    setFilterStatus("");
                    setFilterPriority("");
                    setFilterCategory("");
                    setSearch("");
                  }}
                >
                  {t("مسح الفلاتر", "Clear filters")}
                </Button>
              }
            />
          ) : (
            <EmptyState
              variant="first-time"
              icon={<Wrench className="h-12 w-12" />}
              title={t("لا توجد طلبات صيانة بعد", "No maintenance requests yet")}
              description={
                t("أنشئ طلبات صيانة وتابع حالتها حتى الإغلاق.", "Log maintenance requests and track them through to resolution.")
              }
              action={
                <Button size="sm" onClick={() => openCreate()} style={{ display: "inline-flex" }}>
                  <Plus className="h-4 w-4 me-1.5" />
                  {t("طلب جديد", "New request")}
                </Button>
              }
              helpHref="/dashboard/help#maintenance"
              helpLabel={t("تعرّف على الصيانة", "Learn about maintenance")}
            />
          )
        ) : (
          <div>
            {visibleRequests.map((t) => {
              const statusLabel =
                statusLabels[t.status] ?? { ar: t.status, en: t.status };
              const priorityLabel =
                priorityLabels[t.priority] ?? {
                  ar: t.priority,
                  en: t.priority,
                };
              return (
                <DataCard
                  key={t.id}
                  icon={iconForTicket(t)}
                  iconTone={toneForTicket(t)}
                  title={t.title}
                  subtitle={[
                    t.unit?.number,
                    formatShortDate(t.scheduledDate ?? t.dueDate),
                    priorityLabel[lang],
                  ]}
                  trailing={
                    <StatusBadge
                      entityType="maintenance"
                      status={t.status}
                      label={statusLabel[lang]}
                      className="text-[10px]"
                    />
                  }
                  href={`/dashboard/maintenance/${t.id}`}
                />
              );
            })}
          </div>
        )}
      </div>

      <FAB
        icon={Plus}
        label={t("طلب جديد", "New ticket")}
        onClick={() => openCreate()}
      />

      <BottomSheet
        open={showFilters}
        onOpenChange={setShowFilters}
        title={t("تصفية الطلبات", "Filter requests")}
        footer={
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              style={{ display: "inline-flex" }}
              onClick={() => {
                setFilterPriority("");
                setFilterCategory("");
                setSearch("");
              }}
            >
              {t("مسح الكل", "Clear all")}
            </Button>
            <Button
              size="sm"
              style={{ display: "inline-flex" }}
              onClick={() => setShowFilters(false)}
            >
              {t("تطبيق", "Apply")}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              {t("بحث", "Search")}
            </label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={inputClass}
              placeholder={
                t("بحث بالعنوان...", "Search by title...")
              }
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              {t("الوحدة", "Unit")}
            </label>
            <SelectField
              aria-label={t("الوحدة", "Unit")}
              value={/* no unit filter in server action yet, use category proxy */ ""}
              onChange={() => {
                /* Unit filter is not wired to server action; kept for future */
              }}
              className={inputClass}
              disabled
            >
              <option value="">
                {t("كل الوحدات", "All units")}
              </option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.number} — {u.building?.name ?? ""}
                </option>
              ))}
            </SelectField>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              {t("الأولوية", "Priority")}
            </label>
            <SelectField
              aria-label={t("الأولوية", "Priority")}
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className={inputClass}
            >
              <option value="">
                {t("كل الأولويات", "All priorities")}
              </option>
              {Object.entries(priorityLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v[lang]}
                </option>
              ))}
            </SelectField>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              {t("المُعيَّن إليه", "Assignee")}
            </label>
            <SelectField
              aria-label={t("المُعيَّن إليه", "Assignee")}
              value=""
              onChange={() => {
                /* Assignee filter is not wired to server action; kept for future */
              }}
              className={inputClass}
              disabled
            >
              <option value="">
                {t("الجميع", "Everyone")}
              </option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </SelectField>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              {t("التصنيف", "Category")}
            </label>
            <SelectField
              aria-label={t("التصنيف", "Category")}
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className={inputClass}
            >
              <option value="">
                {t("كل التصنيفات", "All categories")}
              </option>
              {Object.entries(categoryLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v[lang]}
                </option>
              ))}
            </SelectField>
          </div>
        </div>
      </BottomSheet>
    </div>

    <div className="hidden md:block space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <PageIntro
        title={t("الصيانة", "Maintenance")}
        description={
          t("تتبع طلبات الصيانة وإدارة الأولويات وقياس مستوى الخدمة", "Track maintenance requests, manage priorities, and measure SLA performance")
        }
        actions={
          <>
            <Button size="sm" className="gap-2" onClick={() => openCreate()} style={{ display: "inline-flex" }}>
              <Plus className="h-4 w-4" />
              {t("طلب جديد", "New Request")}
            </Button>
            <Button variant="outline" size="sm" style={{ display: "inline-flex" }} onClick={handleExport}>
              <Download className="h-4 w-4" />
              {t("تصدير", "Export")}
            </Button>
            <Link href="/dashboard/maintenance/preventive">
              <Button variant="outline" size="sm" className="gap-2" style={{ display: "inline-flex" }}>
                <CalendarCheck className="h-4 w-4" />
                {t("الصيانة الوقائية", "Preventive Plans")}
              </Button>
            </Link>
          </>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard
          label={t("مفتوحة", "Open")}
          value={stats?.open ?? "—"}
          subtitle={t("طلبات بانتظار التعيين", "Awaiting assignment")}
          icon={<AlertTriangle className="h-5 w-5" />}
          accentColor="warning"
          loading={loading}
          compact
        />
        <KPICard
          label={t("معيّنة", "Assigned")}
          value={stats?.assigned ?? "—"}
          subtitle={t("تم تعيين فني", "Technician assigned")}
          icon={<UserCircle className="h-5 w-5" />}
          accentColor="info"
          loading={loading}
          compact
        />
        <KPICard
          label={t("قيد التنفيذ", "In Progress")}
          value={stats?.inProgress ?? "—"}
          subtitle={t("جارٍ العمل عليها", "Work underway")}
          icon={<Clock className="h-5 w-5" />}
          accentColor="primary"
          loading={loading}
          compact
        />
        <KPICard
          label={t("متأخرة", "Overdue")}
          value={stats?.overdue ?? "—"}
          subtitle={t("تجاوزت الموعد المحدد", "Past due date")}
          icon={<AlertTriangle className="h-5 w-5" />}
          accentColor="destructive"
          loading={loading}
          compact
        />
        <KPICard
          label={t("مكتملة هذا الشهر", "Completed (Month)")}
          value={stats?.completedThisMonth ?? "—"}
          subtitle={t("تم الحل هذا الشهر", "Resolved this month")}
          icon={<CheckCircle className="h-5 w-5" />}
          accentColor="success"
          loading={loading}
          compact
        />
      </div>

      {/* Filter Bar */}
      <FilterBar
        filters={statusFilterOptions}
        activeFilter={filterStatus}
        onFilterChange={(v) => setFilterStatus(v)}
        searchPlaceholder={t("بحث بالعنوان...", "Search by title...")}
        searchValue={search}
        onSearchChange={setSearch}
        actions={
          <div className="flex items-center gap-2">
            <SelectField
              aria-label={t("الأولوية", "Priority")}
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="h-9 px-3 rounded-md border border-input bg-background text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">{t("كل الأولويات", "All Priorities")}</option>
              {Object.entries(priorityLabels).map(([k, v]) => (
                <option key={k} value={k}>{v[lang]}</option>
              ))}
            </SelectField>
            <SelectField
              aria-label={t("التصنيف", "Category")}
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="h-9 px-3 rounded-md border border-input bg-background text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">{t("كل التصنيفات", "All Categories")}</option>
              {Object.entries(categoryLabels).map(([k, v]) => (
                <option key={k} value={k}>{v[lang]}</option>
              ))}
            </SelectField>
          </div>
        }
      />

      {/* Table */}
      <DataTable
        columns={columns}
        data={visibleRequests}
        loading={loading}
        locale={lang === "ar" ? "ar" : "en"}
        pagination
        pageSize={10}
        getRowId={(r) => r.id}
        rowClassName={(r) => {
          // v4.11: full-row tint instead of a start-edge stripe; pill carries status.
          const tone = toneForTicket(r);
          if (tone === "red") return "bg-destructive/5";
          if (tone === "amber") return "bg-warning/5";
          return undefined;
        }}
        mobileCard={(r) => {
          const statusLabel = statusLabels[r.status] ?? { ar: r.status, en: r.status };
          const priorityLabel = priorityLabels[r.priority] ?? { ar: r.priority, en: r.priority };
          return (
            <DataCard
              key={r.id}
              icon={iconForTicket(r)}
              iconTone={toneForTicket(r)}
              title={r.title}
              subtitle={[
                r.unit?.number,
                formatShortDate(r.scheduledDate ?? r.dueDate),
                priorityLabel[lang],
              ]}
              trailing={
                <StatusBadge
                  entityType="maintenance"
                  status={r.status}
                  label={statusLabel[lang]}
                  className="text-[10px]"
                />
              }
              href={`/dashboard/maintenance/${r.id}`}
            />
          );
        }}
        emptyTitle={
          filterStatus || search || filterPriority || filterCategory
            ? (t("لا توجد نتائج مطابقة", "No matching requests"))
            : (t("لا توجد طلبات صيانة بعد", "No maintenance requests yet"))
        }
        emptyDescription={
          filterStatus || search || filterPriority || filterCategory
            ? (t("جرّب تعديل الفلاتر أو البحث بكلمات أخرى.", "Try adjusting the filters or search terms."))
            : (t("أنشئ طلبات صيانة وتابع حالتها حتى الإغلاق.", "Log maintenance requests and track them through to resolution."))
        }
      />

      {/* Create/Edit Modal */}
      <ResponsiveDialog
        open={showModal}
        onOpenChange={setShowModal}
        title={
          editingId
            ? (t("تعديل طلب الصيانة", "Edit Request"))
            : (t("طلب صيانة جديد", "New Request"))
        }
        contentClassName="sm:max-w-[640px]"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" size="sm" onClick={() => setShowModal(false)} disabled={saving} style={{ display: "inline-flex" }}>
              {t("إلغاء", "Cancel")}
            </Button>
            <Button
              type="submit"
              form="maintenance-request-form"
              size="sm"
              disabled={saving}
              className="gap-2"
              style={{ display: "inline-flex" }}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? (t("تحديث", "Update")) : (t("إنشاء", "Create"))}
            </Button>
          </div>
        }
      >
        <form
          id="maintenance-request-form"
          onSubmit={onSubmit}
          className="space-y-4 py-4"
        >
          <p className="text-xs text-muted-foreground">
            {t("الحقول المطلوبة معلّمة بـ *", "Required fields marked with *")}
          </p>

          {saveError && (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {saveError}
            </p>
          )}

          <Controller
            name="title"
            control={control}
            render={({ field, fieldState }) => (
              <Field
                label={t("العنوان", "Title")}
                required
                error={fieldState.error?.message}
              >
                {(f) => (
                  <Input
                    {...f}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder={
                      t("مثال: تسريب ماء في الحمام", "e.g. Water leak in bathroom")
                    }
                  />
                )}
              </Field>
            )}
          />

          <Controller
            name="description"
            control={control}
            render={({ field, fieldState }) => (
              <Field
                label={t("الوصف", "Description")}
                required
                error={fieldState.error?.message}
              >
                {(f) => (
                  <textarea
                    {...f}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    className={`${inputClass} h-20 py-2 aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/30`}
                  />
                )}
              </Field>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <Controller
              name="category"
              control={control}
              render={({ field, fieldState }) => (
                <SelectField
                  label={t("التصنيف", "Category")}
                  requiredMark
                  error={fieldState.error?.message}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                >
                  {Object.entries(categoryLabels).map(([k, v]) => (
                    <option key={k} value={k}>{v[lang]}</option>
                  ))}
                </SelectField>
              )}
            />
            <Controller
              name="priority"
              control={control}
              render={({ field, fieldState }) => (
                <SelectField
                  label={t("الأولوية", "Priority")}
                  requiredMark
                  error={fieldState.error?.message}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                >
                  {Object.entries(priorityLabels).map(([k, v]) => (
                    <option key={k} value={k}>{v[lang]}</option>
                  ))}
                </SelectField>
              )}
            />
          </div>

          {!editingId && (
            <Controller
              name="unitId"
              control={control}
              render={({ field, fieldState }) => {
                // Lock the unit when this ticket was launched from a specific unit
                // (?unitId=…) and the form is still pinned to it — prevents filing
                // against the wrong unit.
                const unitLocked =
                  !!presetUnitId && field.value === presetUnitId;
                return (
                  <SelectField
                    label={t("الوحدة", "Unit")}
                    requiredMark
                    error={fieldState.error?.message}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    disabled={unitLocked}
                    hint={
                      unitLocked
                        ? t("محددة من الوحدة المختارة", "Set from the selected unit")
                        : undefined
                    }
                  >
                    <option value="">{t("اختر الوحدة", "Select Unit")}</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.number}
                      </option>
                    ))}
                  </SelectField>
                );
              }}
            />
          )}

          <Controller
            name="assignedToId"
            control={control}
            render={({ field }) => (
              <SelectField
                label={t("تعيين إلى", "Assign To")}
                value={field.value ?? ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
              >
                <option value="">{t("— بدون تعيين —", "— Unassigned —")}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </SelectField>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <Controller
              name="scheduledDate"
              control={control}
              render={({ field, fieldState }) => (
                <Field
                  label={t("تاريخ مجدول", "Scheduled Date")}
                  error={fieldState.error?.message}
                >
                  {(f) => (
                    <HijriDatePicker
                      id={f.id}
                      locale={lang === "ar" ? "ar" : "en"}
                      value={field.value ? new Date(field.value) : null}
                      onChange={(d) =>
                        field.onChange(d ? d.toISOString().slice(0, 10) : "")
                      }
                    />
                  )}
                </Field>
              )}
            />
            <Controller
              name="estimatedCost"
              control={control}
              render={({ field, fieldState }) => (
                <Field
                  label={t("التكلفة التقديرية", "Est. Cost")}
                  error={fieldState.error?.message}
                >
                  {(f) => (
                    <Input
                      {...f}
                      type="number"
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      placeholder="0.00"
                    />
                  )}
                </Field>
              )}
            />
          </div>

          <Controller
            name="notes"
            control={control}
            render={({ field }) => (
              <Field label={t("ملاحظات", "Notes")}>
                {(f) => (
                  <textarea
                    {...f}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    className={`${inputClass} h-16 py-2`}
                  />
                )}
              </Field>
            )}
          />
        </form>
      </ResponsiveDialog>
    </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={t("هل أنت متأكد من حذف طلب الصيانة هذا؟", "Are you sure you want to delete this request?")}
        confirmLabel={t("حذف", "Delete")}
        cancelLabel={t("إلغاء", "Cancel")}
        onConfirm={executeDelete}
        variant="destructive"
      />
    </>
  );
}

// `useSearchParams` (read inside MaintenancePageInner) requires a Suspense
// boundary in Next.js App Router — wrap the page so static rendering can bail out.
export default function MaintenancePage() {
  return (
    <React.Suspense fallback={null}>
      <MaintenancePageInner />
    </React.Suspense>
  );
}
