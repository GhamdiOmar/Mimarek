"use client";

import { useLanguage } from "../../../../components/LanguageProvider";
import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Pencil,
  CircleUser,
  Building2,
  Calendar,
  CircleDollarSign,
  X,
  Mail,
  RefreshCw,
  UserPlus,
  CalendarClock,
  PlayCircle,
  PauseCircle,
  ClipboardList,
  FileText,
} from "lucide-react";
import {
  Button,
  Badge,
  SARAmount,
  AppBar,
  QuickActionRail,
  ActivityTimeline,
  BottomSheet,
  EmptyState,
  Skeleton,
  DirectionalIcon,
} from "@repo/ui";
import {
  getMaintenanceRequest,
  updateMaintenanceRequest,
  getAssignableUsers,
} from "../../../actions/maintenance";
import { formatDualDate } from "../../../../lib/hijri";

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

const statusLabels: Record<string, { ar: string; en: string; variant: string }> = {
  OPEN: { ar: "بانتظار المراجعة", en: "Waiting Review", variant: "draft" },
  ASSIGNED: { ar: "معيّن", en: "Assigned", variant: "reserved" },
  IN_PROGRESS: { ar: "قيد التنفيذ", en: "In Progress", variant: "reserved" },
  ON_HOLD: { ar: "معلّق", en: "On Hold", variant: "maintenance" },
  RESOLVED: { ar: "تم الحل", en: "Resolved", variant: "available" },
  CLOSED: { ar: "مغلق", en: "Closed", variant: "sold" },
};

const priorityLabels: Record<string, { ar: string; en: string; color: string }> = {
  LOW: { ar: "منخفض", en: "Low", color: "text-muted-foreground" },
  MEDIUM: { ar: "متوسط", en: "Medium", color: "text-primary" },
  HIGH: { ar: "عالي", en: "High", color: "text-warning" },
  URGENT: { ar: "عاجل", en: "Urgent", color: "text-destructive" },
};

const VALID_TRANSITIONS: Record<string, string[]> = {
  OPEN: ["ASSIGNED", "IN_PROGRESS", "CLOSED"],
  ASSIGNED: ["IN_PROGRESS", "ON_HOLD", "OPEN"],
  IN_PROGRESS: ["ON_HOLD", "RESOLVED"],
  ON_HOLD: ["IN_PROGRESS", "CLOSED"],
  RESOLVED: ["CLOSED", "IN_PROGRESS"],
  CLOSED: ["OPEN"],
};

export default function MaintenanceDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { lang } = useLanguage();
  const [request, setRequest] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [transitioningTo, setTransitioningTo] = React.useState<string | null>(null);
  const [users, setUsers] = React.useState<any[]>([]);

  // Inline edit states
  const [editingCost, setEditingCost] = React.useState(false);
  const [actualCost, setActualCost] = React.useState("");
  const [laborHours, setLaborHours] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [showAssign, setShowAssign] = React.useState(false);
  const [costErrors, setCostErrors] = React.useState<Record<string, string>>({});
  const [mobileStatusSheet, setMobileStatusSheet] = React.useState(false);
  const [mobileAssignSheet, setMobileAssignSheet] = React.useState(false);

  React.useEffect(() => {
    load();
  }, [id]);

  async function load() {
    setLoading(true);
    try {
      const [data, usersData] = await Promise.all([
        getMaintenanceRequest(id as string),
        getAssignableUsers(),
      ]);
      setRequest(data);
      setUsers(usersData);
      setActualCost(data.actualCost?.toString() ?? "");
      setLaborHours(data.laborHours?.toString() ?? "");
      setNotes(data.notes ?? "");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    setSaving(true);
    setTransitioningTo(newStatus);
    try {
      await updateMaintenanceRequest(id as string, { status: newStatus });
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
      setTransitioningTo(null);
    }
  }

  async function handleAssign(userId: string) {
    setSaving(true);
    try {
      await updateMaintenanceRequest(id as string, { assignedToId: userId || null });
      setShowAssign(false);
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveCost() {
    const errors: Record<string, string> = {};
    if (actualCost && (isNaN(parseFloat(actualCost)) || parseFloat(actualCost) < 0)) {
      errors.actualCost = lang === "ar" ? "التكلفة يجب أن تكون رقمًا صحيحًا" : "Cost must be a valid positive number";
    }
    if (laborHours && (isNaN(parseFloat(laborHours)) || parseFloat(laborHours) < 0)) {
      errors.laborHours = lang === "ar" ? "ساعات العمل يجب أن تكون رقمًا صحيحًا" : "Hours must be a valid positive number";
    }
    if (Object.keys(errors).length > 0) {
      setCostErrors(errors);
      return;
    }
    setCostErrors({});
    setSaving(true);
    try {
      await updateMaintenanceRequest(id as string, {
        actualCost: actualCost ? parseFloat(actualCost) : null,
        laborHours: laborHours ? parseFloat(laborHours) : null,
        notes: notes || null,
      });
      setEditingCost(false);
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!request) {
    return <div className="text-center py-20 text-muted-foreground">{lang === "ar" ? "لم يتم العثور على الطلب" : "Request not found"}</div>;
  }

  const status = statusLabels[request.status] ?? { ar: request.status, en: request.status, variant: "draft" };
  const priority = priorityLabels[request.priority] ?? { ar: request.priority, en: request.priority, color: "text-muted-foreground" };
  const cat = categoryLabels[request.category] ?? { ar: request.category, en: request.category };
  const validTransitions = VALID_TRANSITIONS[request.status] ?? [];
  const isOverdue = request.dueDate && new Date(request.dueDate) < new Date() && !["RESOLVED", "CLOSED"].includes(request.status);
  const inputClass = "w-full h-9 px-3 bg-card border border-border rounded-md text-sm outline-none focus:border-secondary transition-all";

  // ─── Mobile timeline events ────────────────────────────────────────────────
  type TLTone =
    | "default"
    | "primary"
    | "success"
    | "info"
    | "warning"
    | "destructive";
  const timelineEvents: Array<{
    key: string;
    label: React.ReactNode;
    at: React.ReactNode;
    detail?: React.ReactNode;
    icon?: any;
    tone?: TLTone;
  }> = [];
  const fmtDT = (d: any) =>
    d ? new Date(d).toLocaleString(lang === "ar" ? "ar-SA" : "en-US") : "";
  if (request.createdAt) {
    timelineEvents.push({
      key: "created",
      icon: ClipboardList,
      tone: "info",
      label: lang === "ar" ? "تم إنشاء الطلب" : "Ticket created",
      at: fmtDT(request.createdAt),
      detail: request.title,
    });
  }
  if (request.assignedTo) {
    timelineEvents.push({
      key: "assigned",
      icon: UserPlus,
      tone: "primary",
      label: lang === "ar" ? "تم التعيين" : "Assigned",
      at: fmtDT(request.updatedAt ?? request.createdAt),
      detail: request.assignedTo.name,
    });
  }
  if (request.scheduledDate) {
    timelineEvents.push({
      key: "scheduled",
      icon: CalendarClock,
      tone: "info",
      label: lang === "ar" ? "مجدول" : "Scheduled",
      at: fmtDT(request.scheduledDate),
    });
  }
  if (request.status === "IN_PROGRESS") {
    timelineEvents.push({
      key: "in-progress",
      icon: PlayCircle,
      tone: "warning",
      label: lang === "ar" ? "قيد التنفيذ" : "In progress",
      at: fmtDT(request.updatedAt ?? request.createdAt),
    });
  }
  if (request.status === "ON_HOLD") {
    timelineEvents.push({
      key: "on-hold",
      icon: PauseCircle,
      tone: "warning",
      label: lang === "ar" ? "معلّق" : "On hold",
      at: fmtDT(request.updatedAt ?? request.createdAt),
    });
  }
  if (request.completedAt) {
    timelineEvents.push({
      key: "completed",
      icon: CheckCircle2,
      tone: "success",
      label: lang === "ar" ? "تم الإنجاز" : "Completed",
      at: fmtDT(request.completedAt),
    });
  }
  if (request.status === "CLOSED") {
    timelineEvents.push({
      key: "closed",
      icon: CheckCircle2,
      tone: "default",
      label: lang === "ar" ? "مغلق" : "Closed",
      at: fmtDT(request.updatedAt ?? request.completedAt ?? request.createdAt),
    });
  }

  const assigneeEmail = request.assignedTo?.email;

  const quickActions: any[] = [
    {
      key: "status",
      label: lang === "ar" ? "الحالة" : "Status",
      icon: RefreshCw,
      tone: "primary" as const,
      onClick: () => setMobileStatusSheet(true),
    },
    {
      key: "assign",
      label: lang === "ar" ? "تعيين" : "Assign",
      icon: UserPlus,
      tone: "info" as const,
      onClick: () => setMobileAssignSheet(true),
    },
  ];
  if (assigneeEmail) {
    quickActions.push({
      key: "email",
      label: lang === "ar" ? "بريد" : "Email",
      icon: Mail,
      tone: "default" as const,
      href: `mailto:${assigneeEmail}`,
    });
  }

  return (
    <>
    {/* ─── Mobile (< md) ─────────────────────────────────────────────── */}
    <div
      className="md:hidden -m-4 sm:-m-6 min-h-dvh flex flex-col bg-background"
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <AppBar
        title={
          <div className="flex flex-col items-center">
            <span className="truncate text-sm font-semibold text-foreground font-mono">
              {`#${String(request.id).slice(-6).toUpperCase()}`}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {lang === "ar" ? "طلب صيانة" : "Ticket"}
            </span>
          </div>
        }
        lang={lang}
        centered
        onBack={() => router.push("/dashboard/maintenance/tickets")}
        trailing={
          <button
            type="button"
            onClick={() => setEditingCost(true)}
            aria-label={lang === "ar" ? "تعديل" : "Edit"}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-foreground hover:bg-muted/60 active:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]"
          >
            <Pencil className="h-5 w-5" aria-hidden="true" />
          </button>
        }
      />

      <div className="flex-1 px-4 pb-28 pt-3 space-y-5">
        {/* Title + tags */}
        <div className="space-y-2">
          <h1 className="text-lg font-semibold text-foreground leading-tight">
            {request.title}
          </h1>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={status.variant as any} className="text-[10px]">
              {status[lang]}
            </Badge>
            <span className={`text-[11px] font-semibold ${priority.color}`}>
              {priority[lang]}
            </span>
            {request.isPreventive && (
              <Badge variant="available" className="text-[10px]">
                {lang === "ar" ? "وقائي" : "Preventive"}
              </Badge>
            )}
            {isOverdue && (
              <Badge variant="overdue" className="text-[10px] gap-1">
                <AlertTriangle className="h-2.5 w-2.5" />
                {lang === "ar" ? "متأخر" : "Overdue"}
              </Badge>
            )}
          </div>
        </div>

        {/* Timeline — top section */}
        <section className="space-y-2">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {lang === "ar" ? "سجل الحالة" : "Status timeline"}
          </h2>
          <div className="rounded-xl border border-border bg-card p-4">
            <ActivityTimeline
              events={timelineEvents}
              emptyState={
                lang === "ar" ? "لا يوجد نشاط بعد." : "No activity yet."
              }
            />
          </div>
        </section>

        {/* Details card */}
        <section className="space-y-2">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {lang === "ar" ? "التفاصيل" : "Details"}
          </h2>
          <div className="bg-card rounded-xl border border-border p-4 space-y-3">
            <MobileRow
              label={lang === "ar" ? "التصنيف" : "Category"}
              value={cat[lang]}
            />
            <MobileRow
              label={lang === "ar" ? "الأولوية" : "Priority"}
              value={
                <span className={priority.color}>{priority[lang]}</span>
              }
            />
            <MobileRow
              label={lang === "ar" ? "الوحدة" : "Unit"}
              value={
                request.unit
                  ? `${request.unit.number} — ${request.unit.building?.name ?? ""}`
                  : "—"
              }
            />
            <MobileRow
              label={lang === "ar" ? "المسؤول" : "Assignee"}
              value={request.assignedTo?.name ?? "—"}
            />
            <MobileRow
              label={lang === "ar" ? "تاريخ الإنشاء" : "Created"}
              value={
                <span className="tabular-nums">
                  {new Date(request.createdAt).toLocaleDateString(
                    lang === "ar" ? "ar-SA" : "en-US",
                  )}
                </span>
              }
            />
            {request.dueDate && (
              <MobileRow
                label={lang === "ar" ? "الاستحقاق" : "Due"}
                value={
                  <span
                    className={`tabular-nums ${isOverdue ? "text-destructive font-bold" : ""}`}
                  >
                    {new Date(request.dueDate).toLocaleDateString(
                      lang === "ar" ? "ar-SA" : "en-US",
                    )}
                  </span>
                }
              />
            )}
            {request.description && (
              <div className="pt-3 border-t border-border">
                <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                  {lang === "ar" ? "الوصف" : "Description"}
                </p>
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {request.description}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Costs */}
        {(request.estimatedCost || request.actualCost || request.laborHours) && (
          <section className="space-y-2">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {lang === "ar" ? "التكاليف" : "Costs"}
            </h2>
            <div className="bg-card rounded-xl border border-border p-4 space-y-3">
              {request.estimatedCost && (
                <MobileRow
                  label={lang === "ar" ? "التكلفة التقديرية" : "Estimated"}
                  value={
                    <SARAmount
                      value={Number(request.estimatedCost)}
                      size={12}
                    />
                  }
                />
              )}
              {request.actualCost && (
                <MobileRow
                  label={lang === "ar" ? "التكلفة الفعلية" : "Actual"}
                  value={
                    <SARAmount
                      value={Number(request.actualCost)}
                      size={12}
                    />
                  }
                />
              )}
              {request.laborHours && (
                <MobileRow
                  label={lang === "ar" ? "ساعات العمل" : "Labor hours"}
                  value={
                    <span className="tabular-nums">
                      {request.laborHours}{" "}
                      {lang === "ar" ? "ساعة" : "hrs"}
                    </span>
                  }
                />
              )}
            </div>
          </section>
        )}

        {/* Notes */}
        {request.notes && (
          <section className="space-y-2">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {lang === "ar" ? "ملاحظات" : "Notes"}
            </h2>
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {request.notes}
              </p>
            </div>
          </section>
        )}
      </div>

      {/* Sticky QuickActionRail — bottom */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-md px-4 pt-3 pb-safe-bottom md:hidden">
        <QuickActionRail actions={quickActions} />
      </div>

      {/* Update Status sheet */}
      <BottomSheet
        open={mobileStatusSheet}
        onOpenChange={setMobileStatusSheet}
        title={lang === "ar" ? "تحديث الحالة" : "Update status"}
      >
        {validTransitions.length === 0 ? (
          <EmptyState
            compact
            icon={<CheckCircle2 className="h-10 w-10" />}
            title={
              lang === "ar"
                ? "لا توجد تحولات متاحة"
                : "No transitions available"
            }
          />
        ) : (
          <div className="space-y-2">
            {validTransitions.map((nextStatus: string) => {
              const nextLabel = statusLabels[nextStatus] ?? {
                ar: nextStatus,
                en: nextStatus,
                variant: "draft",
              };
              return (
                <button
                  key={nextStatus}
                  type="button"
                  disabled={saving}
                  onClick={async () => {
                    await handleStatusChange(nextStatus);
                    setMobileStatusSheet(false);
                  }}
                  className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-start transition-colors hover:border-foreground/20 active:scale-[0.99] disabled:opacity-60"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    {transitioningTo === nextStatus ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    {nextLabel[lang]}
                  </span>
                  <Badge
                    variant={nextLabel.variant as any}
                    className="text-[10px]"
                  >
                    {nextLabel[lang]}
                  </Badge>
                </button>
              );
            })}
          </div>
        )}
      </BottomSheet>

      {/* Assign sheet */}
      <BottomSheet
        open={mobileAssignSheet}
        onOpenChange={setMobileAssignSheet}
        title={lang === "ar" ? "تعيين المسؤول" : "Assign to"}
      >
        <div className="space-y-2">
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              await handleAssign("");
              setMobileAssignSheet(false);
            }}
            className="flex w-full items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-start disabled:opacity-60"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <X className="h-4 w-4" />
            </span>
            <span className="text-sm font-medium text-foreground">
              {lang === "ar" ? "— بدون تعيين —" : "— Unassigned —"}
            </span>
          </button>
          {users.map((u: any) => (
            <button
              key={u.id}
              type="button"
              disabled={saving}
              onClick={async () => {
                await handleAssign(u.id);
                setMobileAssignSheet(false);
              }}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-start disabled:opacity-60"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CircleUser className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {u.name}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {u.role}
                </span>
              </span>
              {request.assignedToId === u.id && (
                <CheckCircle2 className="h-4 w-4 text-primary" />
              )}
            </button>
          ))}
        </div>
      </BottomSheet>
    </div>

    {/* ─── Desktop (≥ md) ─ unchanged ───────────────────────────────── */}
    <div className="hidden md:block">
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/maintenance/tickets")} style={{ display: "inline-flex" }}>
          <DirectionalIcon icon={ArrowLeft} className="h-[18px] w-[18px]" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-primary">{request.title}</h1>
            <Badge variant={status.variant as any} className="text-xs">{status[lang]}</Badge>
            <span className={`text-xs font-bold ${priority.color}`}>{priority[lang]}</span>
            {request.isPreventive && (
              <Badge variant="available" className="text-[10px]">{lang === "ar" ? "وقائي" : "Preventive"}</Badge>
            )}
            {isOverdue && (
              <Badge variant="overdue" className="text-[10px] gap-1">
                <AlertTriangle className="h-2.5 w-2.5" />
                {lang === "ar" ? "متأخر" : "Overdue"}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {cat[lang]} • {request.unit?.number} — {request.unit?.building?.name}
            {request.unit?.building?.project?.name && ` (${request.unit.building.project.name})`}
          </p>
        </div>
      </div>

      {/* Status Workflow Buttons */}
      {validTransitions.length > 0 && (() => {
        const statusButtonStyles: Record<string, string> = {
          ASSIGNED: "bg-info/10 text-info border border-info/30 hover:bg-info/20",
          IN_PROGRESS: "bg-warning/10 text-warning border border-warning/30 hover:bg-warning/20",
          ON_HOLD: "bg-warning/10 text-warning border border-warning/30 hover:bg-warning/20",
          RESOLVED: "bg-secondary/10 text-secondary border border-secondary/30 hover:bg-secondary/20",
          CLOSED: "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20",
        };
        return (
          <div className="bg-card rounded-md shadow-card border border-border p-4 flex items-center gap-3 flex-wrap">
            <span className="text-xs text-muted-foreground font-bold">{lang === "ar" ? "تحويل الحالة:" : "Transition status:"}</span>
            {validTransitions.map((nextStatus: string) => {
              const nextLabel = statusLabels[nextStatus] ?? { ar: nextStatus, en: nextStatus };
              return (
                <Button
                  key={nextStatus}
                  size="sm"
                  variant="secondary"
                  className={`gap-2 ${statusButtonStyles[nextStatus] ?? ""}`}
                  onClick={() => handleStatusChange(nextStatus)}
                  disabled={saving}
                  style={{ display: "inline-flex" }}
                  title={nextLabel[lang === "ar" ? "en" : "ar"]}
                >
                  {transitioningTo === nextStatus ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  {nextLabel[lang]}
                </Button>
              );
            })}
          </div>
        );
      })()}

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Details Card */}
        <div className="bg-card rounded-md shadow-card border border-border p-5 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {lang === "ar" ? "تفاصيل الطلب" : "Request Details"}
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label={lang === "ar" ? "التصنيف" : "Category"} value={cat[lang]} />
            <InfoRow label={lang === "ar" ? "الأولوية" : "Priority"} value={<span className={priority.color}>{priority[lang]}</span>} />
            <InfoRow label={lang === "ar" ? "الوحدة" : "Unit"} value={`${request.unit?.number} — ${request.unit?.building?.name}`} />
            <InfoRow label={lang === "ar" ? "المبنى" : "Building"} value={request.unit?.building?.name} />
            <InfoRow label={lang === "ar" ? "تاريخ الإنشاء" : "Created"} value={formatDualDate(request.createdAt, lang)} />
            <InfoRow
              label={lang === "ar" ? "تاريخ الاستحقاق" : "Due Date"}
              value={
                request.dueDate ? (
                  <span className={isOverdue ? "text-destructive font-bold" : ""}>
                    {formatDualDate(request.dueDate, lang)}
                  </span>
                ) : "—"
              }
            />
            {request.scheduledDate && (
              <InfoRow label={lang === "ar" ? "تاريخ مجدول" : "Scheduled"} value={formatDualDate(request.scheduledDate, lang)} />
            )}
            {request.completedAt && (
              <InfoRow label={lang === "ar" ? "تاريخ الإنجاز" : "Completed"} value={formatDualDate(request.completedAt, lang)} />
            )}
          </div>
          {request.description && (
            <div className="pt-3 border-t border-border">
              <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">{lang === "ar" ? "الوصف" : "Description"}</p>
              <p className="text-sm text-primary">{request.description}</p>
            </div>
          )}
        </div>

        {/* Assignment & Cost Card */}
        <div className="space-y-6">
          {/* Assigned To */}
          <div className="bg-card rounded-md shadow-card border border-border p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <CircleUser className="h-3.5 w-3.5" />
                {lang === "ar" ? "المُعيَّن" : "Assigned To"}
              </h4>
              <Button variant="ghost" size="sm" onClick={() => setShowAssign(!showAssign)} style={{ display: "inline-flex" }} aria-label={lang === "ar" ? "تعديل" : "Edit"}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
            {request.assignedTo ? (
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <CircleUser className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-primary">{request.assignedTo.name}</p>
                  <p className="text-[10px] text-muted-foreground">{request.assignedTo.email}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{lang === "ar" ? "لم يتم التعيين بعد" : "Not assigned"}</p>
            )}
            {showAssign && (
              <div className="pt-3 border-t border-border space-y-2">
                <select
                  onChange={(e) => handleAssign(e.target.value)}
                  className={inputClass}
                  defaultValue=""
                >
                  <option value="">{lang === "ar" ? "— بدون تعيين —" : "— Unassigned —"}</option>
                  {users.map((u: any) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Cost Section */}
          <div className="bg-card rounded-md shadow-card border border-border p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <CircleDollarSign className="h-3.5 w-3.5" />
                {lang === "ar" ? "التكاليف" : "Costs"}
              </h4>
              <Button variant="ghost" size="sm" onClick={() => setEditingCost(!editingCost)} style={{ display: "inline-flex" }} aria-label={lang === "ar" ? "تعديل" : "Edit"}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InfoRow
                label={lang === "ar" ? "التكلفة التقديرية" : "Estimated"}
                value={
                  request.estimatedCost ? (
                    <SARAmount value={Number(request.estimatedCost)} size={12} />
                  ) : "—"
                }
              />
              <InfoRow
                label={lang === "ar" ? "التكلفة الفعلية" : "Actual"}
                value={
                  request.actualCost ? (
                    <SARAmount value={Number(request.actualCost)} size={12} />
                  ) : "—"
                }
              />
              <InfoRow
                label={lang === "ar" ? "ساعات العمل" : "Labor Hours"}
                value={request.laborHours ? `${request.laborHours} ${lang === "ar" ? "ساعة" : "hrs"}` : "—"}
              />
            </div>
            {editingCost && (
              <div className="pt-3 border-t border-border space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground">{lang === "ar" ? "التكلفة الفعلية" : "Actual Cost"}</label>
                    <input
                      type="number"
                      value={actualCost}
                      onChange={(e) => { setActualCost(e.target.value); setCostErrors((prev) => { const n = { ...prev }; delete n.actualCost; return n; }); }}
                      className={`${inputClass} ${costErrors.actualCost ? "border-destructive" : ""}`}
                      placeholder="0.00"
                    />
                    {costErrors.actualCost && <p className="text-xs text-destructive">{costErrors.actualCost}</p>}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground">{lang === "ar" ? "ساعات العمل" : "Labor Hours"}</label>
                    <input
                      type="number"
                      value={laborHours}
                      onChange={(e) => { setLaborHours(e.target.value); setCostErrors((prev) => { const n = { ...prev }; delete n.laborHours; return n; }); }}
                      className={`${inputClass} ${costErrors.laborHours ? "border-destructive" : ""}`}
                      placeholder="0"
                    />
                    {costErrors.laborHours && <p className="text-xs text-destructive">{costErrors.laborHours}</p>}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground">{lang === "ar" ? "ملاحظات" : "Notes"}</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputClass} h-16 py-2`} />
                </div>
                <Button size="sm" onClick={handleSaveCost} disabled={saving} className="gap-2" style={{ display: "inline-flex" }}>
                  {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                  {lang === "ar" ? "حفظ" : "Save"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Notes */}
      {request.notes && !editingCost && (
        <div className="bg-card rounded-md shadow-card border border-border p-5">
          <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
            {lang === "ar" ? "ملاحظات" : "Notes"}
          </h4>
          <p className="text-sm text-primary whitespace-pre-wrap">{request.notes}</p>
        </div>
      )}

      {/* Preventive Plan Link */}
      {request.preventivePlan && (
        <div className="bg-secondary/5 border border-secondary/20 rounded-md p-4 flex items-center gap-3">
          <Calendar className="h-5 w-5 text-secondary" />
          <div className="flex-1">
            <p className="text-sm font-bold text-primary">{request.preventivePlan.title}</p>
            <p className="text-[10px] text-muted-foreground">{lang === "ar" ? "هذا الطلب جزء من خطة صيانة وقائية" : "This request is part of a preventive plan"}</p>
          </div>
        </div>
      )}
    </div>
    </div>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase font-bold">{label}</p>
      <p className="text-sm text-primary font-medium mt-0.5">{value || "—"}</p>
    </div>
  );
}

function MobileRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground text-end">
        {value ?? "—"}
      </span>
    </div>
  );
}
