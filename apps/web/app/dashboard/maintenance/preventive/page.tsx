"use client";

import { useLanguage } from "../../../../components/LanguageProvider";
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Plus,
  CalendarCheck,
  Play,
  Pause,
  Pencil,
  Trash2,
  Zap,
  Search,
  AlertTriangle,
} from "lucide-react";
import {
  Button,
  Badge,
  SARAmount,
  ResponsiveDialog,
  AppBar,
  FAB,
  DataCard,
  MobileKPICard,
  EmptyState,
  Skeleton,
  Input,
  Switch,
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  DirectionalIcon,
  PageHeader,
} from "@repo/ui";
import { toast } from "sonner";
import {
  getPreventivePlans,
  createPreventivePlan,
  updatePreventivePlan,
  togglePreventivePlan,
  deletePreventivePlan,
  generateWorkOrdersFromPlans,
} from "../../../actions/preventive-maintenance";
import { getAssignableUsers, getUnitsForMaintenance } from "../../../actions/maintenance";

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

const priorityLabels: Record<string, { ar: string; en: string }> = {
  LOW: { ar: "منخفض", en: "Low" },
  MEDIUM: { ar: "متوسط", en: "Medium" },
  HIGH: { ar: "عالي", en: "High" },
  URGENT: { ar: "عاجل", en: "Urgent" },
};

const recurrenceLabels: Record<string, { ar: string; en: string }> = {
  DAILY: { ar: "يومي", en: "Daily" },
  WEEKLY: { ar: "أسبوعي", en: "Weekly" },
  BIWEEKLY: { ar: "كل أسبوعين", en: "Biweekly" },
  MONTHLY: { ar: "شهري", en: "Monthly" },
  QUARTERLY: { ar: "ربع سنوي", en: "Quarterly" },
  SEMI_ANNUAL: { ar: "نصف سنوي", en: "Semi-Annual" },
  ANNUAL: { ar: "سنوي", en: "Annual" },
};

export default function PreventiveMaintenancePage() {
  const router = useRouter();
  const { lang } = useLanguage();
  const [plans, setPlans] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);
  const [users, setUsers] = React.useState<any[]>([]);
  const [units, setUnits] = React.useState<any[]>([]);
  // Modal
  const [showModal, setShowModal] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  // Mobile search + delete confirm
  const [search, setSearch] = React.useState("");
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [runConfirmOpen, setRunConfirmOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    title: "",
    description: "",
    category: "GENERAL",
    priority: "MEDIUM",
    recurrenceType: "MONTHLY",
    recurrenceInterval: "1",
    startDate: "",
    endDate: "",
    unitId: "",
    assignToId: "",
    estimatedCost: "",
    estimatedHours: "",
  });

  React.useEffect(() => {
    load();
    loadRefs();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await getPreventivePlans();
      setPlans(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadRefs() {
    try {
      const [u, un] = await Promise.all([
        getAssignableUsers(),
        getUnitsForMaintenance(),
      ]);
      setUsers(u);
      setUnits(un);
    } catch (e) {
      console.error(e);
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm({
      title: "",
      description: "",
      category: "GENERAL",
      priority: "MEDIUM",
      recurrenceType: "MONTHLY",
      recurrenceInterval: "1",
      startDate: new Date().toISOString().slice(0, 10),
      endDate: "",
      unitId: "",
      assignToId: "",
      estimatedCost: "",
      estimatedHours: "",
    });
    setShowModal(true);
  }

  function openEdit(plan: any) {
    setEditingId(plan.id);
    setForm({
      title: plan.title,
      description: plan.description ?? "",
      category: plan.category ?? "GENERAL",
      priority: plan.priority ?? "MEDIUM",
      recurrenceType: plan.recurrenceType ?? "MONTHLY",
      recurrenceInterval: plan.recurrenceInterval?.toString() ?? "1",
      startDate: plan.startDate ? new Date(plan.startDate).toISOString().slice(0, 10) : "",
      endDate: plan.endDate ? new Date(plan.endDate).toISOString().slice(0, 10) : "",
      unitId: plan.unitId ?? "",
      assignToId: plan.assignToId ?? "",
      estimatedCost: plan.estimatedCost?.toString() ?? "",
      estimatedHours: plan.estimatedHours?.toString() ?? "",
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.title || !form.startDate) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description || undefined,
        category: form.category,
        priority: form.priority,
        recurrenceType: form.recurrenceType,
        recurrenceInterval: parseInt(form.recurrenceInterval) || 1,
        startDate: form.startDate,
        endDate: form.endDate || undefined,
        unitId: form.unitId || undefined,
        assignToId: form.assignToId || undefined,
        estimatedCost: form.estimatedCost ? parseFloat(form.estimatedCost) : undefined,
        estimatedHours: form.estimatedHours ? parseFloat(form.estimatedHours) : undefined,
      };

      if (editingId) {
        await updatePreventivePlan(editingId, payload);
      } else {
        await createPreventivePlan(payload as any);
      }
      setShowModal(false);
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(planId: string) {
    try {
      await togglePreventivePlan(planId);
      await load();
    } catch (e) {
      console.error(e);
    }
  }

  async function confirmDeletePlan() {
    if (!deleteTargetId) return;
    setDeleting(true);
    try {
      await deletePreventivePlan(deleteTargetId);
      await load();
      toast.success(lang === "ar" ? "تم حذف الخطة" : "Plan deleted");
      setDeleteTargetId(null);
    } catch (e) {
      toast.error(
        lang === "ar"
          ? "تعذّر حذف الخطة. يرجى المحاولة مجدداً."
          : "Could not delete plan. Please try again."
      );
    } finally {
      setDeleting(false);
    }
  }

  async function handleGenerate() {
    setRunConfirmOpen(false);
    setGenerating(true);
    try {
      const result = await generateWorkOrdersFromPlans();
      toast.success(
        lang === "ar"
          ? `تم إنشاء ${result.created} طلب صيانة من ${result.total} خطة مستحقة.`
          : `Created ${result.created} work orders from ${result.total} due plans.`
      );
      await load();
    } catch (e) {
      toast.error(
        lang === "ar"
          ? "تعذّر إنشاء طلبات الصيانة. يرجى المحاولة مجدداً."
          : "Could not generate work orders. Please try again."
      );
    } finally {
      setGenerating(false);
    }
  }

  const inputClass = "w-full h-10 px-3 bg-card border border-border rounded-md text-sm outline-none focus:border-secondary transition-all";

  // ─── Mobile filters / KPIs ─────────────────────────────────────────────
  const filteredPlans = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return plans;
    return plans.filter((p: any) =>
      (p.title ?? "").toLowerCase().includes(q) ||
      (p.description ?? "").toLowerCase().includes(q)
    );
  }, [plans, search]);

  const mobileKpis = React.useMemo(() => {
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    return {
      active: plans.filter((p: any) => p.isActive).length,
      dueWeek: plans.filter(
        (p: any) =>
          p.isActive && p.nextRunDate && new Date(p.nextRunDate).getTime() - now <= oneWeek
      ).length,
      total: plans.length,
      disabled: plans.filter((p: any) => !p.isActive).length,
    };
  }, [plans]);

  return (
    <>
    {/* ─── Mobile (< md) ─────────────────────────────────────────────── */}
    <div
      className="md:hidden -m-4 sm:-m-6 min-h-dvh flex flex-col bg-background"
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <AppBar
        title={lang === "ar" ? "الخطط الوقائية" : "Preventive plans"}
        lang={lang}
        onBack={() => router.push("/dashboard/maintenance/tickets")}
        trailing={
          <button
            type="button"
            onClick={() => setRunConfirmOpen(true)}
            disabled={generating}
            aria-label={lang === "ar" ? "تشغيل الآن" : "Run now"}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-foreground hover:bg-muted/60 active:bg-muted transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]"
          >
            {generating ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : (
              <Zap className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
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
            placeholder={lang === "ar" ? "بحث باسم الخطة..." : "Search by plan name..."}
            className="h-10 ps-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 pt-3">
        <MobileKPICard
          label={lang === "ar" ? "الخطط النشطة" : "Active plans"}
          value={mobileKpis.active}
          tone="green"
          icon={Play}
        />
        <MobileKPICard
          label={lang === "ar" ? "المستحقة هذا الأسبوع" : "Due this week"}
          value={mobileKpis.dueWeek}
          tone="amber"
          icon={CalendarCheck}
        />
        <MobileKPICard
          label={lang === "ar" ? "الإجمالي" : "Total"}
          value={mobileKpis.total}
          tone="primary"
          icon={Zap}
        />
        <MobileKPICard
          label={lang === "ar" ? "متوقفة" : "Disabled"}
          value={mobileKpis.disabled}
          tone="default"
          icon={Pause}
        />
      </div>

      <div className="flex-1 px-4 pb-24 pt-3">
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-3">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="mt-2 h-3 w-1/2" />
                <Skeleton className="mt-3 h-3 w-1/3" />
              </div>
            ))}
          </div>
        ) : filteredPlans.length === 0 ? (
          <EmptyState
            icon={<CalendarCheck className="h-12 w-12" />}
            title={lang === "ar" ? "لا توجد خطط وقائية" : "No preventive plans"}
            description={
              search
                ? lang === "ar"
                  ? "جرّب تعديل البحث."
                  : "Try adjusting your search."
                : lang === "ar"
                  ? "أضف أول خطة صيانة وقائية."
                  : "Add your first preventive plan."
            }
          />
        ) : (
          <div className="space-y-1">
            {filteredPlans.map((plan: any) => {
              const rec = recurrenceLabels[plan.recurrenceType] ?? {
                ar: plan.recurrenceType,
                en: plan.recurrenceType,
              };
              const cat = categoryLabels[plan.category] ?? {
                ar: plan.category,
                en: plan.category,
              };
              const nextDateLabel = plan.nextRunDate
                ? new Date(plan.nextRunDate).toLocaleDateString(
                    lang === "ar" ? "ar-SA" : "en-US"
                  )
                : "—";
              const isDue =
                plan.nextRunDate &&
                new Date(plan.nextRunDate) <= new Date();

              return (
                <DataCard
                  key={plan.id}
                  icon={CalendarCheck}
                  iconTone={plan.isActive ? "purple" : "default"}
                  onClick={() => openEdit(plan)}
                  title={
                    <span className={plan.isActive ? "" : "opacity-60"}>
                      {plan.title}
                    </span>
                  }
                  subtitle={[
                    cat[lang],
                    `${plan.recurrenceInterval > 1 ? `${lang === "ar" ? "كل" : "Every"} ${plan.recurrenceInterval} ` : ""}${rec[lang]}`,
                    <span
                      key="next"
                      className={
                        isDue && plan.isActive
                          ? "text-destructive font-medium"
                          : undefined
                      }
                    >
                      {lang === "ar" ? "التالي: " : "Next: "}
                      <span className="tabular-nums">{nextDateLabel}</span>
                    </span>,
                  ]}
                  trailing={
                    <div
                      className="flex items-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Switch
                        checked={plan.isActive}
                        onCheckedChange={() => handleToggle(plan.id)}
                        aria-label={
                          lang === "ar"
                            ? "تفعيل أو إيقاف الخطة"
                            : "Toggle plan active"
                        }
                      />
                    </div>
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      <FAB
        icon={Plus}
        label={lang === "ar" ? "خطة جديدة" : "New plan"}
        onClick={openCreate}
      />
    </div>

    {/* ─── Desktop (≥ md) ─ unchanged ───────────────────────────────── */}
    <div className="hidden md:block">
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard/maintenance/tickets")}
          aria-label={lang === "ar" ? "رجوع" : "Back"}
          className="shrink-0"
        >
          <DirectionalIcon icon={ArrowLeft} className="h-[18px] w-[18px]" />
        </Button>
        <PageHeader
          className="flex-1"
          title={lang === "ar" ? "خطط الصيانة الوقائية" : "Preventive Maintenance Plans"}
          description={lang === "ar" ? "جدولة الصيانة الدورية للمباني والوحدات" : "Schedule recurring maintenance for buildings and units"}
          actions={
            <>
              <Button variant="secondary" size="sm" className="gap-2" onClick={() => setRunConfirmOpen(true)} disabled={generating}>
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-4 w-4" />}
                {lang === "ar" ? "تشغيل الآن" : "Run Now"}
              </Button>
              <Button size="sm" className="gap-2" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                {lang === "ar" ? "خطة جديدة" : "New Plan"}
              </Button>
            </>
          }
        />
      </div>

      {/* Plans Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : plans.length === 0 ? (
        <EmptyState
          icon={<CalendarCheck className="h-12 w-12" aria-hidden="true" />}
          title={lang === "ar" ? "لا توجد خطط وقائية بعد" : "No preventive plans yet"}
          description={
            lang === "ar"
              ? "جدولة الصيانة الدورية تمنع الأعطال وتطيل عمر الأصول."
              : "Scheduled upkeep prevents breakdowns and extends asset life."
          }
          action={
            <Button
              onClick={openCreate}
              style={{ display: "inline-flex" }}
              className="gap-2"
            >
              <Plus className="h-[18px] w-[18px]" />
              {lang === "ar" ? "إنشاء خطة" : "Create plan"}
            </Button>
          }
          helpHref="/dashboard/help#preventive-maintenance"
          helpLabel={lang === "ar" ? "تعرّف على الصيانة الوقائية" : "Learn about preventive maintenance"}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan: any) => {
            const cat = categoryLabels[plan.category] ?? { ar: plan.category, en: plan.category };
            const rec = recurrenceLabels[plan.recurrenceType] ?? { ar: plan.recurrenceType, en: plan.recurrenceType };
            const pri = priorityLabels[plan.priority] ?? { ar: plan.priority, en: plan.priority };
            const isDue = plan.nextRunDate && new Date(plan.nextRunDate) <= new Date();

            return (
              <div
                key={plan.id}
                className={`bg-card rounded-md shadow-card border p-5 transition-all ${
                  plan.isActive ? "border-border hover:shadow-lg" : "border-border/50 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-primary">{plan.title}</h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{plan.description || "—"}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleToggle(plan.id)}>
                      {plan.isActive ? <Pause className="h-3.5 w-3.5 text-warning" /> : <Play className="h-3.5 w-3.5 text-secondary" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(plan)} aria-label={lang === "ar" ? "تعديل" : "Edit"}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteTargetId(plan.id)} aria-label={lang === "ar" ? "حذف" : "Delete"}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <Badge variant="draft" className="text-[9px]">{cat[lang]}</Badge>
                  <Badge variant={plan.isActive ? "available" : "maintenance"} className="text-[9px]">
                    {plan.isActive ? (lang === "ar" ? "نشط" : "Active") : (lang === "ar" ? "متوقف" : "Paused")}
                  </Badge>
                  {isDue && plan.isActive && (
                    <Badge variant="overdue" className="text-[9px]">{lang === "ar" ? "مستحق" : "Due"}</Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">{lang === "ar" ? "التكرار" : "Frequency"}</span>
                    <p className="font-medium text-primary">
                      {plan.recurrenceInterval > 1 ? `${lang === "ar" ? "كل" : "Every"} ${plan.recurrenceInterval} ` : ""}
                      {rec[lang]}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">{lang === "ar" ? "الأولوية" : "Priority"}</span>
                    <p className="font-medium text-primary">{pri[lang]}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">{lang === "ar" ? "التشغيل التالي" : "Next Run"}</span>
                    <p className={`font-medium ${isDue && plan.isActive ? "text-destructive" : "text-primary"}`}>
                      {plan.nextRunDate ? new Date(plan.nextRunDate).toLocaleDateString("en-SA") : "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">{lang === "ar" ? "أوامر عمل" : "Work Orders"}</span>
                    <p className="font-medium text-primary">{plan._count?.workOrders ?? 0}</p>
                  </div>
                  {plan.estimatedCost != null && (
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">{lang === "ar" ? "التكلفة" : "Est. Cost"}</span>
                      <p className="font-medium text-primary"><SARAmount value={plan.estimatedCost} size={10} /></p>
                    </div>
                  )}
                </div>

                {(plan.unit || plan.building) && (
                  <div className="mt-3 pt-3 border-t border-border text-[10px] text-muted-foreground">
                    {plan.unit && <span>{plan.unit.number} — {plan.unit.building?.name}</span>}
                    {plan.building && !plan.unit && <span>{plan.building.name}</span>}
                    {plan.assignTo && <span className="me-2">• {plan.assignTo.name}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal — using shared ResponsiveDialog */}
      <ResponsiveDialog
        open={showModal}
        onOpenChange={setShowModal}
        title={
          editingId
            ? (lang === "ar" ? "تعديل خطة وقائية" : "Edit Plan")
            : (lang === "ar" ? "خطة وقائية جديدة" : "New Preventive Plan")
        }
        contentClassName="sm:max-w-[640px]"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" size="sm" onClick={() => setShowModal(false)} disabled={saving}>
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button type="submit" form="preventive-plan-form" size="sm" disabled={saving || !form.title || !form.startDate} loading={saving}>
              {editingId ? (lang === "ar" ? "تحديث" : "Update") : (lang === "ar" ? "إنشاء" : "Create")}
            </Button>
          </div>
        }
      >
        <form
          id="preventive-plan-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="space-y-4 py-4"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">{lang === "ar" ? "العنوان *" : "Title *"}</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} placeholder={lang === "ar" ? "مثال: فحص التكييف الشهري" : "e.g. Monthly HVAC Inspection"} />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">{lang === "ar" ? "الوصف" : "Description"}</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${inputClass} h-16 py-2`} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">{lang === "ar" ? "التصنيف" : "Category"}</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputClass}>
                {Object.entries(categoryLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v[lang]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">{lang === "ar" ? "الأولوية" : "Priority"}</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className={inputClass}>
                {Object.entries(priorityLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v[lang]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">{lang === "ar" ? "التكرار" : "Recurrence"}</label>
              <select value={form.recurrenceType} onChange={(e) => setForm({ ...form, recurrenceType: e.target.value })} className={inputClass}>
                {Object.entries(recurrenceLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v[lang]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">{lang === "ar" ? "فترة التكرار" : "Interval"}</label>
              <input type="number" min="1" value={form.recurrenceInterval} onChange={(e) => setForm({ ...form, recurrenceInterval: e.target.value })} className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">{lang === "ar" ? "تاريخ البدء *" : "Start Date *"}</label>
              <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">{lang === "ar" ? "تاريخ الانتهاء" : "End Date"}</label>
              <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={inputClass} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">{lang === "ar" ? "الوحدة" : "Unit"}</label>
            <select value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })} className={inputClass}>
              <option value="">{lang === "ar" ? "— الكل —" : "— All —"}</option>
              {units.map((u: any) => (
                <option key={u.id} value={u.id}>{u.number}{u.buildingName ? ` — ${u.buildingName}` : ""}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">{lang === "ar" ? "تعيين إلى" : "Default Assignee"}</label>
            <select value={form.assignToId} onChange={(e) => setForm({ ...form, assignToId: e.target.value })} className={inputClass}>
              <option value="">{lang === "ar" ? "— بدون —" : "— None —"}</option>
              {users.map((u: any) => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">{lang === "ar" ? "التكلفة التقديرية" : "Est. Cost"}</label>
              <input type="number" value={form.estimatedCost} onChange={(e) => setForm({ ...form, estimatedCost: e.target.value })} className={inputClass} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">{lang === "ar" ? "الساعات التقديرية" : "Est. Hours"}</label>
              <input type="number" value={form.estimatedHours} onChange={(e) => setForm({ ...form, estimatedHours: e.target.value })} className={inputClass} placeholder="0" />
            </div>
          </div>
        </form>
      </ResponsiveDialog>
    </div>
    </div>

    {/* Delete plan confirm — shared by mobile + desktop */}
    <AlertDialog
      open={Boolean(deleteTargetId)}
      onOpenChange={(open) => {
        if (!open && !deleting) setDeleteTargetId(null);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {lang === "ar" ? "تأكيد حذف الخطة" : "Delete this plan?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {lang === "ar"
              ? "سيتم حذف هذه الخطة الوقائية نهائياً. لا يمكن التراجع عن هذا الإجراء."
              : "This preventive plan will be permanently deleted. This action cannot be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>
            {lang === "ar" ? "إلغاء" : "Cancel"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              confirmDeletePlan();
            }}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : lang === "ar" ? "حذف" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Run-now confirm — shared by mobile + desktop */}
    <AlertDialog
      open={runConfirmOpen}
      onOpenChange={(open) => {
        if (!generating) setRunConfirmOpen(open);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {lang === "ar"
              ? "توليد طلبات الصيانة الآن؟"
              : "Generate work orders now?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {lang === "ar"
              ? "سيتم إنشاء طلبات صيانة لجميع الخطط المستحقة."
              : "Maintenance requests will be created for every plan that is currently due."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={generating}>
            {lang === "ar" ? "إلغاء" : "Cancel"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleGenerate();
            }}
            disabled={generating}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : lang === "ar" ? "تشغيل" : "Run now"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
