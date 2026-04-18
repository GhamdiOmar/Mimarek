"use client";

import { useLanguage } from "../../../../components/LanguageProvider";
import * as React from "react";
import { useRouter } from "next/navigation";
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
  Globe,
  Filter,
} from "lucide-react";
import { exportToExcel } from "../../../../lib/export";
import {
  Button,
  ResponsiveDialog,
  Card,
  KPICard,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  PageIntro,
  FilterBar,
  StatusBadge,
  AppBar,
  MobileTabs,
  DataCard,
  BottomSheet,
  FAB,
  EmptyState,
} from "@repo/ui";
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

const categoryLabels: Record<string, { ar: string; en: string }> = {
  HVAC: { ar: "تكييف", en: "HVAC" },
  PLUMBING: { ar: "سباكة", en: "Plumbing" },
  ELECTRICAL: { ar: "كهرباء", en: "Electrical" },
  STRUCTURAL: { ar: "إنشائي", en: "Structural" },
  FIRE_SAFETY: { ar: "سلامة حريق", en: "Fire Safety" },
  ELEVATOR: { ar: "مصاعد", en: "Elevator" },
  CLEANING: { ar: "نظافة", en: "Cleaning" },
  LANDSCAPING: { ar: "تنسيق حدائق", en: "Landscaping" },
  PEST_CONTROL: { ar: "مكافحة آفات", en: "Pest Control" },
  GENERAL: { ar: "عام", en: "General" },
};

const statusLabels: Record<string, { ar: string; en: string }> = {
  OPEN: { ar: "بانتظار المراجعة", en: "Waiting Review" },
  ASSIGNED: { ar: "معيّن", en: "Assigned" },
  IN_PROGRESS: { ar: "قيد التنفيذ", en: "In Progress" },
  ON_HOLD: { ar: "معلّق", en: "On Hold" },
  RESOLVED: { ar: "تم الحل", en: "Resolved" },
  CLOSED: { ar: "مغلق", en: "Closed" },
};

const priorityLabels: Record<string, { ar: string; en: string; color: string }> = {
  LOW: { ar: "منخفض", en: "Low", color: "text-muted-foreground" },
  MEDIUM: { ar: "متوسط", en: "Medium", color: "text-primary" },
  HIGH: { ar: "عالي", en: "High", color: "text-warning" },
  URGENT: { ar: "عاجل", en: "Urgent", color: "text-destructive" },
};

export default function MaintenancePage() {
  const router = useRouter();
  const { lang } = useLanguage();
  const [requests, setRequests] = React.useState<any[]>([]);
  const [stats, setStats] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [users, setUsers] = React.useState<any[]>([]);
  const [units, setUnits] = React.useState<any[]>([]);

  // Filters
  const [search, setSearch] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState("");
  const [filterPriority, setFilterPriority] = React.useState("");
  const [filterCategory, setFilterCategory] = React.useState("");

  // Mobile filter sheet
  const [showFilters, setShowFilters] = React.useState(false);

  // Modal
  const [showModal, setShowModal] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [formErrors, setFormErrors] = React.useState<Record<string, string>>({});
  const [form, setForm] = React.useState({
    title: "",
    description: "",
    category: "GENERAL",
    priority: "MEDIUM",
    unitId: "",
    assignedToId: "",
    scheduledDate: "",
    estimatedCost: "",
    notes: "",
  });

  React.useEffect(() => {
    load();
    loadRefs();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const filters: any = {};
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
  }, [search, filterStatus, filterPriority, filterCategory]);

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function openCreate() {
    setEditingId(null);
    setFormErrors({});
    setForm({
      title: "",
      description: "",
      category: "GENERAL",
      priority: "MEDIUM",
      unitId: units[0]?.id ?? "",
      assignedToId: "",
      scheduledDate: "",
      estimatedCost: "",
      notes: "",
    });
    setShowModal(true);
  }

  function openEdit(req: any) {
    setEditingId(req.id);
    setFormErrors({});
    setForm({
      title: req.title,
      description: req.description ?? "",
      category: req.category ?? "GENERAL",
      priority: req.priority ?? "MEDIUM",
      unitId: req.unitId ?? "",
      assignedToId: req.assignedToId ?? "",
      scheduledDate: req.scheduledDate ? new Date(req.scheduledDate).toISOString().slice(0, 10) ?? "" : "",
      estimatedCost: req.estimatedCost?.toString() ?? "",
      notes: req.notes ?? "",
    });
    setShowModal(true);
  }

  async function handleSave() {
    const errors: Record<string, string> = {};
    if (!form.title.trim()) {
      errors.title = lang === "ar" ? "العنوان مطلوب" : "Title is required";
    }
    if (!form.description.trim()) {
      errors.description = lang === "ar" ? "الوصف مطلوب" : "Description is required";
    }
    if (!form.category) {
      errors.category = lang === "ar" ? "التصنيف مطلوب" : "Category is required";
    }
    if (!form.priority) {
      errors.priority = lang === "ar" ? "الأولوية مطلوبة" : "Priority is required";
    }
    if (!editingId && !form.unitId) {
      errors.unitId = lang === "ar" ? "الوحدة مطلوبة" : "Unit is required";
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    setSaving(true);
    try {
      if (editingId) {
        await updateMaintenanceRequest(editingId, {
          title: form.title,
          description: form.description || undefined,
          category: form.category,
          priority: form.priority,
          assignedToId: form.assignedToId || null,
          scheduledDate: form.scheduledDate || null,
          estimatedCost: form.estimatedCost ? parseFloat(form.estimatedCost) : null,
          notes: form.notes || null,
        });
      } else {
        await createMaintenanceRequest({
          title: form.title,
          description: form.description || undefined,
          category: form.category,
          priority: form.priority,
          unitId: form.unitId,
          assignedToId: form.assignedToId || undefined,
          scheduledDate: form.scheduledDate || undefined,
          estimatedCost: form.estimatedCost ? parseFloat(form.estimatedCost) : undefined,
          notes: form.notes || undefined,
        });
      }
      setShowModal(false);
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const msg = lang === "ar"
      ? "هل أنت متأكد من حذف طلب الصيانة هذا؟"
      : "Are you sure you want to delete this request?";
    if (!confirm(msg)) return;
    try {
      await deleteMaintenanceRequest(id);
      await load();
    } catch (e) {
      console.error(e);
    }
  }

  function handleExport() {
    exportToExcel({
      data: requests,
      filename: lang === "ar" ? "طلبات_الصيانة" : "maintenance_requests",
      title: lang === "ar" ? "تقرير طلبات الصيانة" : "Maintenance Requests Report",
      lang,
      columns: [
        {
          header: lang === "ar" ? "رقم الطلب" : "Request #",
          key: "requestNumber",
          width: 18,
        },
        {
          header: lang === "ar" ? "العنوان" : "Title",
          key: "title",
          width: 30,
        },
        {
          header: lang === "ar" ? "التصنيف" : "Category",
          key: "category",
          width: 18,
          render: (val: string) => categoryLabels[val]?.[lang] ?? val,
        },
        {
          header: lang === "ar" ? "الأولوية" : "Priority",
          key: "priority",
          width: 15,
          render: (val: string) => priorityLabels[val]?.[lang] ?? val,
        },
        {
          header: lang === "ar" ? "الحالة" : "Status",
          key: "status",
          width: 18,
          render: (val: string) => statusLabels[val]?.[lang] ?? val,
        },
        {
          header: lang === "ar" ? "المُعيَّن إليه" : "Assigned To",
          key: "assignedTo",
          width: 22,
          render: (val: any) => val?.name ?? (lang === "ar" ? "غير معيّن" : "Unassigned"),
        },
        {
          header: lang === "ar" ? "تاريخ الإنشاء" : "Created Date",
          key: "createdAt",
          width: 18,
          render: (val: string) => val ? new Date(val).toLocaleDateString("en-SA") : "—",
        },
      ],
    });
  }

  // Build status filter tabs for FilterBar
  const statusFilterOptions = [
    { label: lang === "ar" ? "الكل" : "All", value: "" },
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
    { key: "", label: lang === "ar" ? "الكل" : "All" },
    { key: "OPEN", label: statusLabels.OPEN![lang] },
    { key: "IN_PROGRESS", label: statusLabels.IN_PROGRESS![lang] },
    { key: "OVERDUE", label: lang === "ar" ? "متأخرة" : "Overdue" },
    { key: "RESOLVED", label: statusLabels.RESOLVED![lang] },
  ];

  function isTicketOverdue(t: any): boolean {
    return Boolean(
      t.dueDate &&
        new Date(t.dueDate) < new Date() &&
        !["RESOLVED", "CLOSED"].includes(t.status),
    );
  }

  function toneForTicket(t: any): "red" | "amber" | "green" | "blue" | "default" {
    if (isTicketOverdue(t)) return "red";
    if (["RESOLVED", "CLOSED"].includes(t.status)) return "green";
    if (t.priority === "URGENT") return "red";
    if (t.priority === "HIGH") return "amber";
    if (["ASSIGNED", "IN_PROGRESS"].includes(t.status)) return "blue";
    if (t.status === "OPEN") return "amber";
    return "default";
  }

  function iconForTicket(t: any) {
    if (isTicketOverdue(t)) return AlertTriangle;
    if (["RESOLVED", "CLOSED"].includes(t.status)) return CheckCircle2;
    if (["ASSIGNED", "IN_PROGRESS"].includes(t.status)) return Clock;
    return Wrench;
  }

  // Apply mobile tab filter client-side on top of server-filtered list
  const visibleRequests = React.useMemo(() => {
    if (!filterStatus) return requests;
    if (filterStatus === "OVERDUE") return requests.filter(isTicketOverdue);
    return requests.filter((r: any) => r.status === filterStatus);
  }, [requests, filterStatus]);

  function formatShortDate(d: string | Date | null | undefined): string {
    if (!d) return lang === "ar" ? "بدون موعد" : "No date";
    return new Date(d).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-SA", {
      month: "short",
      day: "numeric",
    });
  }

  return (
    <>
    <div className="md:hidden -m-4 sm:-m-6 min-h-dvh flex flex-col bg-background">
      <AppBar
        title={lang === "ar" ? "الصيانة" : "Maintenance"}
        lang={lang}
        trailing={
          <button
            type="button"
            onClick={() => setShowFilters(true)}
            aria-label={lang === "ar" ? "تصفية" : "Filter"}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-foreground hover:bg-muted/60 active:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]"
          >
            <Filter className="h-5 w-5" aria-hidden="true" />
          </button>
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
          ariaLabel={lang === "ar" ? "تصفية الحالة" : "Status filter"}
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
              title={lang === "ar" ? "لا توجد نتائج مطابقة" : "No matching requests"}
              description={
                lang === "ar"
                  ? "جرّب تعديل الفلاتر أو البحث بكلمات أخرى."
                  : "Try adjusting the filters or search terms."
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
                  {lang === "ar" ? "مسح الفلاتر" : "Clear filters"}
                </Button>
              }
            />
          ) : (
            <EmptyState
              variant="first-time"
              icon={<Wrench className="h-12 w-12" />}
              title={lang === "ar" ? "لا توجد طلبات صيانة بعد" : "No maintenance requests yet"}
              description={
                lang === "ar"
                  ? "أنشئ طلبات صيانة وتابع حالتها حتى الإغلاق."
                  : "Log maintenance requests and track them through to resolution."
              }
              action={
                <Button size="sm" onClick={openCreate} style={{ display: "inline-flex" }}>
                  <Plus className="h-4 w-4 me-1.5" />
                  {lang === "ar" ? "طلب جديد" : "New request"}
                </Button>
              }
              helpHref="/dashboard/help#maintenance"
              helpLabel={lang === "ar" ? "تعرّف على الصيانة" : "Learn about maintenance"}
            />
          )
        ) : (
          <div>
            {visibleRequests.map((t: any) => {
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
        label={lang === "ar" ? "طلب جديد" : "New ticket"}
        onClick={openCreate}
      />

      <BottomSheet
        open={showFilters}
        onOpenChange={setShowFilters}
        title={lang === "ar" ? "تصفية الطلبات" : "Filter requests"}
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
              {lang === "ar" ? "مسح الكل" : "Clear all"}
            </Button>
            <Button
              size="sm"
              style={{ display: "inline-flex" }}
              onClick={() => setShowFilters(false)}
            >
              {lang === "ar" ? "تطبيق" : "Apply"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              {lang === "ar" ? "بحث" : "Search"}
            </label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={inputClass}
              placeholder={
                lang === "ar" ? "بحث بالعنوان..." : "Search by title..."
              }
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              {lang === "ar" ? "الوحدة" : "Unit"}
            </label>
            <select
              value={/* no unit filter in server action yet, use category proxy */ ""}
              onChange={() => {
                /* Unit filter is not wired to server action; kept for future */
              }}
              className={inputClass}
              disabled
            >
              <option value="">
                {lang === "ar" ? "كل الوحدات" : "All units"}
              </option>
              {units.map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.number} — {u.building?.name ?? ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              {lang === "ar" ? "الأولوية" : "Priority"}
            </label>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className={inputClass}
            >
              <option value="">
                {lang === "ar" ? "كل الأولويات" : "All priorities"}
              </option>
              {Object.entries(priorityLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v[lang]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              {lang === "ar" ? "المُعيَّن إليه" : "Assignee"}
            </label>
            <select
              value=""
              onChange={() => {
                /* Assignee filter is not wired to server action; kept for future */
              }}
              className={inputClass}
              disabled
            >
              <option value="">
                {lang === "ar" ? "الجميع" : "Everyone"}
              </option>
              {users.map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              {lang === "ar" ? "التصنيف" : "Category"}
            </label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className={inputClass}
            >
              <option value="">
                {lang === "ar" ? "كل التصنيفات" : "All categories"}
              </option>
              {Object.entries(categoryLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v[lang]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </BottomSheet>
    </div>

    <div className="hidden md:block space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <PageIntro
        title={lang === "ar" ? "الصيانة" : "Maintenance"}
        description={
          lang === "ar"
            ? "تتبع طلبات الصيانة وإدارة الأولويات وقياس مستوى الخدمة"
            : "Track maintenance requests, manage priorities, and measure SLA performance"
        }
        actions={
          <>
            <Button size="sm" className="gap-2" onClick={openCreate} style={{ display: "inline-flex" }}>
              <Plus className="h-4 w-4" />
              {lang === "ar" ? "طلب جديد" : "New Request"}
            </Button>
            <Button variant="outline" size="sm" style={{ display: "inline-flex" }} onClick={handleExport}>
              <Download className="h-4 w-4" />
              {lang === "ar" ? "تصدير" : "Export"}
            </Button>
            <Link href="/dashboard/gis/assets">
              <Button variant="outline" size="sm" style={{ display: "inline-flex" }}>
                <Globe className="w-4 h-4 me-1.5" />
                {lang === "ar" ? "خريطة الأصول" : "Asset Map"}
              </Button>
            </Link>
            <Link href="/dashboard/maintenance/preventive">
              <Button variant="outline" size="sm" className="gap-2" style={{ display: "inline-flex" }}>
                <CalendarCheck className="h-4 w-4" />
                {lang === "ar" ? "الصيانة الوقائية" : "Preventive Plans"}
              </Button>
            </Link>
          </>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard
          label={lang === "ar" ? "مفتوحة" : "Open"}
          value={stats?.open ?? "\u2014"}
          subtitle={lang === "ar" ? "طلبات بانتظار التعيين" : "Awaiting assignment"}
          icon={<AlertTriangle className="h-5 w-5" />}
          accentColor="warning"
          loading={loading}
          compact
        />
        <KPICard
          label={lang === "ar" ? "معيّنة" : "Assigned"}
          value={stats?.assigned ?? "\u2014"}
          subtitle={lang === "ar" ? "تم تعيين فني" : "Technician assigned"}
          icon={<UserCircle className="h-5 w-5" />}
          accentColor="info"
          loading={loading}
          compact
        />
        <KPICard
          label={lang === "ar" ? "قيد التنفيذ" : "In Progress"}
          value={stats?.inProgress ?? "\u2014"}
          subtitle={lang === "ar" ? "جارٍ العمل عليها" : "Work underway"}
          icon={<Clock className="h-5 w-5" />}
          accentColor="primary"
          loading={loading}
          compact
        />
        <KPICard
          label={lang === "ar" ? "متأخرة" : "Overdue"}
          value={stats?.overdue ?? "\u2014"}
          subtitle={lang === "ar" ? "تجاوزت الموعد المحدد" : "Past due date"}
          icon={<AlertTriangle className="h-5 w-5" />}
          accentColor="destructive"
          loading={loading}
          compact
        />
        <KPICard
          label={lang === "ar" ? "مكتملة هذا الشهر" : "Completed (Month)"}
          value={stats?.completedThisMonth ?? "\u2014"}
          subtitle={lang === "ar" ? "تم الحل هذا الشهر" : "Resolved this month"}
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
        searchPlaceholder={lang === "ar" ? "بحث بالعنوان..." : "Search by title..."}
        searchValue={search}
        onSearchChange={setSearch}
        actions={
          <div className="flex items-center gap-2">
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="h-9 px-3 rounded-md border border-input bg-background text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">{lang === "ar" ? "كل الأولويات" : "All Priorities"}</option>
              {Object.entries(priorityLabels).map(([k, v]) => (
                <option key={k} value={k}>{v[lang]}</option>
              ))}
            </select>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="h-9 px-3 rounded-md border border-input bg-background text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">{lang === "ar" ? "كل التصنيفات" : "All Categories"}</option>
              {Object.entries(categoryLabels).map(([k, v]) => (
                <option key={k} value={k}>{v[lang]}</option>
              ))}
            </select>
          </div>
        }
      />

      {/* Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : requests.length === 0 ? (
          filterStatus || search || filterPriority || filterCategory ? (
            <EmptyState
              variant="filtered"
              icon={<Search className="h-12 w-12" />}
              title={lang === "ar" ? "لا توجد نتائج مطابقة" : "No matching requests"}
              description={
                lang === "ar"
                  ? "جرّب تعديل الفلاتر أو البحث بكلمات أخرى."
                  : "Try adjusting the filters or search terms."
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
                  {lang === "ar" ? "مسح الفلاتر" : "Clear filters"}
                </Button>
              }
            />
          ) : (
            <EmptyState
              variant="first-time"
              icon={<Wrench className="h-12 w-12" />}
              title={lang === "ar" ? "لا توجد طلبات صيانة بعد" : "No maintenance requests yet"}
              description={
                lang === "ar"
                  ? "أنشئ طلبات صيانة وتابع حالتها حتى الإغلاق."
                  : "Log maintenance requests and track them through to resolution."
              }
              action={
                <Button size="sm" onClick={openCreate} style={{ display: "inline-flex" }}>
                  <Plus className="h-4 w-4 me-1.5" />
                  {lang === "ar" ? "طلب جديد" : "New request"}
                </Button>
              }
              helpHref="/dashboard/help#maintenance"
              helpLabel={lang === "ar" ? "تعرّف على الصيانة" : "Learn about maintenance"}
            />
          )
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{lang === "ar" ? "العنوان" : "Title"}</TableHead>
                <TableHead>{lang === "ar" ? "الوحدة" : "Unit"}</TableHead>
                <TableHead>{lang === "ar" ? "التصنيف" : "Category"}</TableHead>
                <TableHead>{lang === "ar" ? "الأولوية" : "Priority"}</TableHead>
                <TableHead>{lang === "ar" ? "الحالة" : "Status"}</TableHead>
                <TableHead>{lang === "ar" ? "المُعيَّن" : "Assigned"}</TableHead>
                <TableHead>{lang === "ar" ? "الاستحقاق" : "Due"}</TableHead>
                <TableHead>{lang === "ar" ? "الإجراءات" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r: any) => {
                const priority = priorityLabels[r.priority] ?? { ar: r.priority, en: r.priority, color: "text-muted-foreground" };
                const cat = categoryLabels[r.category] ?? { ar: r.category, en: r.category };
                const statusLabel = statusLabels[r.status] ?? { ar: r.status, en: r.status };
                const isOverdue = r.dueDate && new Date(r.dueDate) < new Date() && !["RESOLVED", "CLOSED"].includes(r.status);

                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link
                        href={`/dashboard/maintenance/${r.id}`}
                        className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
                      >
                        {r.title}
                        {r.isPreventive && (
                          <span className="text-[9px] text-success me-1">[{lang === "ar" ? "وقائي" : "Preventive"}]</span>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-foreground">
                      {r.unit?.number ?? "\u2014"} \u2014 {r.unit?.building?.name ?? ""}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{cat[lang]}</TableCell>
                    <TableCell>
                      <span className={`text-xs font-semibold ${priority.color}`}>{priority[lang]}</span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        entityType="maintenance"
                        status={r.status}
                        label={statusLabel[lang]}
                        className="text-[10px]"
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.assignedTo?.name ?? "\u2014"}</TableCell>
                    <TableCell>
                      {r.dueDate ? (
                        <span className={`text-xs ${isOverdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                          {new Date(r.dueDate).toLocaleDateString("en-SA")}
                          {isOverdue && <AlertTriangle className="inline h-3 w-3 me-1" />}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{"\u2014"}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Link href={`/dashboard/maintenance/${r.id}`}>
                          <Button variant="ghost" size="sm" style={{ display: "inline-flex" }} aria-label={lang === "ar" ? "عرض" : "View"}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(r)} style={{ display: "inline-flex" }} aria-label={lang === "ar" ? "تعديل" : "Edit"}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive/80"
                          onClick={() => handleDelete(r.id)}
                          style={{ display: "inline-flex" }}
                          aria-label={lang === "ar" ? "حذف" : "Delete"}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Create/Edit Modal */}
      <ResponsiveDialog
        open={showModal}
        onOpenChange={setShowModal}
        title={
          editingId
            ? (lang === "ar" ? "تعديل طلب الصيانة" : "Edit Request")
            : (lang === "ar" ? "طلب صيانة جديد" : "New Request")
        }
        contentClassName="sm:max-w-[640px]"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" size="sm" onClick={() => setShowModal(false)} disabled={saving} style={{ display: "inline-flex" }}>
              {lang === "ar" ? "إلغاء" : "Cancel"}
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
              {editingId ? (lang === "ar" ? "تحديث" : "Update") : (lang === "ar" ? "إنشاء" : "Create")}
            </Button>
          </div>
        }
      >
        <form
          id="maintenance-request-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="space-y-4 py-4"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              {lang === "ar" ? "العنوان *" : "Title *"}
            </label>
            <input
              value={form.title}
              onChange={(e) => updateField("title", e.target.value)}
              className={`${inputClass} ${formErrors.title ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
              placeholder={lang === "ar" ? "مثال: تسريب ماء في الحمام" : "e.g. Water leak in bathroom"}
            />
            {formErrors.title && <p className="text-xs text-destructive">{formErrors.title}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              {lang === "ar" ? "الوصف *" : "Description *"}
            </label>
            <textarea
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              className={`${inputClass} h-20 py-2 ${formErrors.description ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
            />
            {formErrors.description && <p className="text-xs text-destructive">{formErrors.description}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                {lang === "ar" ? "التصنيف *" : "Category *"}
              </label>
              <select
                value={form.category}
                onChange={(e) => updateField("category", e.target.value)}
                className={`${inputClass} ${formErrors.category ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
              >
                {Object.entries(categoryLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v[lang]}</option>
                ))}
              </select>
              {formErrors.category && <p className="text-xs text-destructive">{formErrors.category}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                {lang === "ar" ? "الأولوية *" : "Priority *"}
              </label>
              <select
                value={form.priority}
                onChange={(e) => updateField("priority", e.target.value)}
                className={`${inputClass} ${formErrors.priority ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
              >
                {Object.entries(priorityLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v[lang]}</option>
                ))}
              </select>
              {formErrors.priority && <p className="text-xs text-destructive">{formErrors.priority}</p>}
            </div>
          </div>

          {!editingId && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                {lang === "ar" ? "الوحدة *" : "Unit *"}
              </label>
              <select
                value={form.unitId}
                onChange={(e) => updateField("unitId", e.target.value)}
                className={`${inputClass} ${formErrors.unitId ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
              >
                <option value="">{lang === "ar" ? "اختر الوحدة" : "Select Unit"}</option>
                {units.map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {u.number} — {u.building?.name} ({u.building?.project?.name})
                  </option>
                ))}
              </select>
              {formErrors.unitId && <p className="text-xs text-destructive">{formErrors.unitId}</p>}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              {lang === "ar" ? "تعيين إلى" : "Assign To"}
            </label>
            <select
              value={form.assignedToId}
              onChange={(e) => updateField("assignedToId", e.target.value)}
              className={inputClass}
            >
              <option value="">{lang === "ar" ? "— بدون تعيين —" : "— Unassigned —"}</option>
              {users.map((u: any) => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                {lang === "ar" ? "تاريخ مجدول" : "Scheduled Date"}
              </label>
              <input
                type="date"
                value={form.scheduledDate}
                onChange={(e) => updateField("scheduledDate", e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                {lang === "ar" ? "التكلفة التقديرية" : "Est. Cost"}
              </label>
              <input
                type="number"
                value={form.estimatedCost}
                onChange={(e) => updateField("estimatedCost", e.target.value)}
                className={inputClass}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              {lang === "ar" ? "ملاحظات" : "Notes"}
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              className={`${inputClass} h-16 py-2`}
            />
          </div>
        </form>
      </ResponsiveDialog>
    </div>
    </>
  );
}
