"use client";

import { useLanguage } from "../../../../components/LanguageProvider";
import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  CircleUser,
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
} from "lucide-react";
import {
  Button,
  IconButton,
  Badge,
  type BadgeProps,
  SARAmount,
  AppBar,
  QuickActionRail,
  type QuickAction,
  ActivityTimeline,
  type ActivityTimelineEvent,
  BottomSheet,
  EmptyState,
  DirectionalIcon,
  LifecycleRail,
  NextActionPanel,
  ProcessBlockerBanner,
  RelatedContextPanel,
  SelectField,
} from "@repo/ui";
import {
  getMaintenanceRequest,
  updateMaintenanceRequest,
  getAssignableUsers,
} from "../../../actions/maintenance";
import { getJourneySummary } from "../../../actions/journey";
import type { JourneySummary } from "@repo/types";
import { formatDualDate } from "../../../../lib/hijri";
import {
  MAINTENANCE_CATEGORY_LABEL as categoryLabels,
  MAINTENANCE_STATUS_LABEL as statusLabels,
  MAINTENANCE_PRIORITY_LABEL as priorityLabels,
} from "../../../../lib/domain-labels";
import type {
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceStatus,
  UserRole,
} from "@repo/db";

// ─── Serialized view-model types ──────────────────────────────────────────────
// `getMaintenanceRequest` runs its result through `serialize()` (Decimal → string,
// Date → string), so these mirror the runtime JSON shape rather than the raw
// Prisma types — same VM pattern used by maintenance/tickets/page.tsx. `unit`
// carries the optional `building` accessor the detail view already reads.
type MaintenanceUnitVM = {
  id: string;
  number: string;
  buildingName: string | null;
  building?: { name: string | null } | null;
};
type MaintenanceUserVM = {
  id: string;
  name: string | null;
  email?: string | null;
  role?: UserRole;
};
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
  completedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
  estimatedCost: string | null;
  actualCost: string | null;
  laborHours: number | string | null;
  notes: string | null;
  isPreventive: boolean;
  preventivePlan: { title: string } | null;
};


const VALID_TRANSITIONS: Record<string, string[]> = {
  OPEN: ["ASSIGNED", "IN_PROGRESS", "CLOSED"],
  ASSIGNED: ["IN_PROGRESS", "ON_HOLD", "OPEN"],
  IN_PROGRESS: ["ON_HOLD", "RESOLVED"],
  ON_HOLD: ["IN_PROGRESS", "CLOSED"],
  RESOLVED: ["CLOSED", "IN_PROGRESS"],
  CLOSED: ["OPEN"],
};

// Assignable-user rows come straight from the action (not serialized), so the
// precise Prisma select shape applies.
type AssignableUser = Awaited<ReturnType<typeof getAssignableUsers>>[number];

export default function MaintenanceDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { t, lang } = useLanguage();
  const [request, setRequest] = React.useState<MaintenanceRequestVM | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [transitioningTo, setTransitioningTo] = React.useState<string | null>(null);
  const [users, setUsers] = React.useState<AssignableUser[]>([]);

  // Inline edit states
  const [editingCost, setEditingCost] = React.useState(false);
  const [actualCost, setActualCost] = React.useState("");
  const [laborHours, setLaborHours] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [showAssign, setShowAssign] = React.useState(false);
  const [costErrors, setCostErrors] = React.useState<Record<string, string>>({});
  const [mobileStatusSheet, setMobileStatusSheet] = React.useState(false);
  const [mobileAssignSheet, setMobileAssignSheet] = React.useState(false);
  const [journey, setJourney] = React.useState<JourneySummary | null>(null);
  const [relatedOpen, setRelatedOpen] = React.useState(false);

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch only when the route param id changes; load is recreated each render and including it would refetch on every render
  }, [id]);

  async function load() {
    setLoading(true);
    try {
      const [data, usersData, journeyData] = await Promise.all([
        getMaintenanceRequest(id as string),
        getAssignableUsers(),
        getJourneySummary("maintenance", id as string).catch(() => null),
      ]);
      setRequest(data);
      setUsers(usersData);
      setJourney(journeyData);
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
      errors.actualCost = t("التكلفة يجب أن تكون رقمًا صحيحًا", "Cost must be a valid positive number");
    }
    if (laborHours && (isNaN(parseFloat(laborHours)) || parseFloat(laborHours) < 0)) {
      errors.laborHours = t("ساعات العمل يجب أن تكون رقمًا صحيحًا", "Hours must be a valid positive number");
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
    return <div className="text-center py-20 text-muted-foreground">{t("لم يتم العثور على الطلب", "Request not found")}</div>;
  }

  const status = statusLabels[request.status] ?? { ar: request.status, en: request.status, variant: "draft" };
  const priority = priorityLabels[request.priority] ?? { ar: request.priority, en: request.priority, color: "text-muted-foreground" };
  const cat = categoryLabels[request.category] ?? { ar: request.category, en: request.category };
  const validTransitions = VALID_TRANSITIONS[request.status] ?? [];
  const isOverdue = request.dueDate && new Date(request.dueDate) < new Date() && !["RESOLVED", "CLOSED"].includes(request.status);
  const inputClass = "w-full h-9 px-3 bg-card border border-border rounded-md text-sm outline-none focus:border-secondary transition-all";

  // ─── Mobile timeline events ────────────────────────────────────────────────
  const timelineEvents: ActivityTimelineEvent[] = [];
  const fmtDT = (d: string | Date | null | undefined) =>
    d ? new Date(d).toLocaleString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-US") : "";
  if (request.createdAt) {
    timelineEvents.push({
      key: "created",
      icon: ClipboardList,
      tone: "info",
      label: t("تم إنشاء الطلب", "Ticket created"),
      at: fmtDT(request.createdAt),
      detail: request.title,
    });
  }
  if (request.assignedTo) {
    timelineEvents.push({
      key: "assigned",
      icon: UserPlus,
      tone: "primary",
      label: t("تم التعيين", "Assigned"),
      at: fmtDT(request.updatedAt ?? request.createdAt),
      detail: request.assignedTo.name,
    });
  }
  if (request.scheduledDate) {
    timelineEvents.push({
      key: "scheduled",
      icon: CalendarClock,
      tone: "info",
      label: t("مجدول", "Scheduled"),
      at: fmtDT(request.scheduledDate),
    });
  }
  if (request.status === "IN_PROGRESS") {
    timelineEvents.push({
      key: "in-progress",
      icon: PlayCircle,
      tone: "warning",
      label: t("قيد التنفيذ", "In progress"),
      at: fmtDT(request.updatedAt ?? request.createdAt),
    });
  }
  if (request.status === "ON_HOLD") {
    timelineEvents.push({
      key: "on-hold",
      icon: PauseCircle,
      tone: "warning",
      label: t("معلّق", "On hold"),
      at: fmtDT(request.updatedAt ?? request.createdAt),
    });
  }
  if (request.completedAt) {
    timelineEvents.push({
      key: "completed",
      icon: CheckCircle2,
      tone: "success",
      label: t("تم الإنجاز", "Completed"),
      at: fmtDT(request.completedAt),
    });
  }
  if (request.status === "CLOSED") {
    timelineEvents.push({
      key: "closed",
      icon: CheckCircle2,
      tone: "default",
      label: t("مغلق", "Closed"),
      at: fmtDT(request.updatedAt ?? request.completedAt ?? request.createdAt),
    });
  }

  const assigneeEmail = request.assignedTo?.email;

  const quickActions: QuickAction[] = [
    {
      key: "status",
      label: t("الحالة", "Status"),
      icon: RefreshCw,
      tone: "primary" as const,
      onClick: () => setMobileStatusSheet(true),
    },
    {
      key: "assign",
      label: t("تعيين", "Assign"),
      icon: UserPlus,
      tone: "info" as const,
      onClick: () => setMobileAssignSheet(true),
    },
  ];
  if (assigneeEmail) {
    quickActions.push({
      key: "email",
      label: t("بريد", "Email"),
      icon: Mail,
      tone: "default" as const,
      href: `mailto:${assigneeEmail}`,
    });
  }

  const journeySection = journey && (
    <div className="bg-card rounded-md shadow-card border border-border p-5 space-y-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {t("مسار طلب الصيانة", "Maintenance request journey")}
      </p>

      {journey.blockers.length > 0 && (
        <ProcessBlockerBanner blockers={journey.blockers} lang={lang} />
      )}

      <LifecycleRail
        stages={journey.stages}
        lang={lang}
        ariaLabel={
          t("مراحل دورة حياة طلب الصيانة", "Maintenance request lifecycle stages")
        }
      />

      {journey.nextActions.length > 0 && (
        <NextActionPanel actions={journey.nextActions} lang={lang} />
      )}

      {journey.related.length > 0 && (
        <>
          <Button
            variant="outline"
            size="sm"
            style={{ display: "inline-flex" }}
            className="gap-2 text-xs"
            onClick={() => setRelatedOpen(true)}
          >
            {t(`السجلات المرتبطة (${journey.related.length})`, `Related records (${journey.related.length})`)}
          </Button>
          <RelatedContextPanel
            open={relatedOpen}
            onOpenChange={setRelatedOpen}
            records={journey.related}
            lang={lang}
            title={{
              ar: "السجلات المرتبطة بالصيانة",
              en: "Maintenance related records",
            }}
          />
        </>
      )}
    </div>
  );

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
              {t("طلب صيانة", "Ticket")}
            </span>
          </div>
        }
        lang={lang}
        centered
        onBack={() => router.push("/dashboard/maintenance/tickets")}
        trailing={
          <IconButton
            icon={Pencil}
            aria-label={t("تعديل", "Edit")}
            onClick={() => setEditingCost(true)}
            variant="ghost"
            className="h-10 w-10 rounded-full"
          />
        }
      />

      <div className="flex-1 px-4 pb-28 pt-3 space-y-5">
        {/* Title + tags */}
        <div className="space-y-2">
          <h1 className="text-lg font-semibold text-foreground leading-tight">
            {request.title}
          </h1>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={status.variant as BadgeProps["variant"]} className="text-[10px]">
              {status[lang]}
            </Badge>
            <span className={`text-[11px] font-semibold ${priority.color}`}>
              {priority[lang]}
            </span>
            {request.isPreventive && (
              <Badge variant="available" className="text-[10px]">
                {t("وقائي", "Preventive")}
              </Badge>
            )}
            {isOverdue && (
              <Badge variant="overdue" className="text-[10px] gap-1">
                <AlertTriangle className="h-2.5 w-2.5" />
                {t("متأخر", "Overdue")}
              </Badge>
            )}
          </div>
        </div>

        {/* Maintenance Journey — mobile */}
        {journeySection}

        {/* Timeline — top section */}
        <section className="space-y-2">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {t("سجل الحالة", "Status timeline")}
          </h2>
          <div className="rounded-xl border border-border bg-card p-4">
            <ActivityTimeline
              events={timelineEvents}
              emptyState={
                t("لا يوجد نشاط بعد.", "No activity yet.")
              }
            />
          </div>
        </section>

        {/* Details card */}
        <section className="space-y-2">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {t("التفاصيل", "Details")}
          </h2>
          <div className="bg-card rounded-xl border border-border p-4 space-y-3">
            <MobileRow
              label={t("التصنيف", "Category")}
              value={cat[lang]}
            />
            <MobileRow
              label={t("الأولوية", "Priority")}
              value={
                <span className={priority.color}>{priority[lang]}</span>
              }
            />
            <MobileRow
              label={t("الوحدة", "Unit")}
              value={
                request.unit
                  ? `${request.unit.number} — ${request.unit.building?.name ?? ""}`
                  : "—"
              }
            />
            <MobileRow
              label={t("المسؤول", "Assignee")}
              value={request.assignedTo?.name ?? "—"}
            />
            <MobileRow
              label={t("تاريخ الإنشاء", "Created")}
              value={
                <span className="tabular-nums">
                  {new Date(request.createdAt).toLocaleDateString(
                    lang === "ar" ? "ar-SA-u-nu-latn" : "en-US",
                  )}
                </span>
              }
            />
            {request.dueDate && (
              <MobileRow
                label={t("الاستحقاق", "Due")}
                value={
                  <span
                    className={`tabular-nums ${isOverdue ? "text-destructive font-bold" : ""}`}
                  >
                    {new Date(request.dueDate).toLocaleDateString(
                      lang === "ar" ? "ar-SA-u-nu-latn" : "en-US",
                    )}
                  </span>
                }
              />
            )}
            {request.description && (
              <div className="pt-3 border-t border-border">
                <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                  {t("الوصف", "Description")}
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
              {t("التكاليف", "Costs")}
            </h2>
            <div className="bg-card rounded-xl border border-border p-4 space-y-3">
              {request.estimatedCost && (
                <MobileRow
                  label={t("التكلفة التقديرية", "Estimated")}
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
                  label={t("التكلفة الفعلية", "Actual")}
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
                  label={t("ساعات العمل", "Labor hours")}
                  value={
                    <span className="tabular-nums">
                      {request.laborHours}{" "}
                      {t("ساعة", "hrs")}
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
              {t("ملاحظات", "Notes")}
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
        title={t("تحديث الحالة", "Update status")}
      >
        {validTransitions.length === 0 ? (
          <EmptyState
            compact
            icon={<CheckCircle2 className="h-10 w-10" />}
            title={
              t("لا توجد تحولات متاحة", "No transitions available")
            }
            description={
              t("لا يمكن تغيير حالة هذا الطلب من الوضع الحالي.", "This request's status cannot be changed from here.")
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
                <Button
                  key={nextStatus}
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={async () => {
                    await handleStatusChange(nextStatus);
                    setMobileStatusSheet(false);
                  }}
                  className="w-full justify-between rounded-xl px-4 py-3 h-auto min-h-11 text-start"
                  style={{ display: "inline-flex" }}
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
                    variant={nextLabel.variant as BadgeProps["variant"]}
                    className="text-[10px]"
                  >
                    {nextLabel[lang]}
                  </Badge>
                </Button>
              );
            })}
          </div>
        )}
      </BottomSheet>

      {/* Assign sheet */}
      <BottomSheet
        open={mobileAssignSheet}
        onOpenChange={setMobileAssignSheet}
        title={t("تعيين المسؤول", "Assign to")}
      >
        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={async () => {
              await handleAssign("");
              setMobileAssignSheet(false);
            }}
            className="w-full justify-start gap-3 rounded-xl px-4 py-3 h-auto min-h-11"
            style={{ display: "inline-flex" }}
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <X className="h-4 w-4" />
            </span>
            <span className="text-sm font-medium text-foreground">
              {t("— بدون تعيين —", "— Unassigned —")}
            </span>
          </Button>
          {users.map((u) => (
            <Button
              key={u.id}
              type="button"
              variant="outline"
              disabled={saving}
              onClick={async () => {
                await handleAssign(u.id);
                setMobileAssignSheet(false);
              }}
              className="w-full justify-start gap-3 rounded-xl px-4 py-3 h-auto min-h-11"
              style={{ display: "inline-flex" }}
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CircleUser className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1 text-start">
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
            </Button>
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
            <Badge variant={status.variant as BadgeProps["variant"]} className="text-xs">{status[lang]}</Badge>
            <span className={`text-xs font-bold ${priority.color}`}>{priority[lang]}</span>
            {request.isPreventive && (
              <Badge variant="available" className="text-[10px]">{t("وقائي", "Preventive")}</Badge>
            )}
            {isOverdue && (
              <Badge variant="overdue" className="text-[10px] gap-1">
                <AlertTriangle className="h-2.5 w-2.5" />
                {t("متأخر", "Overdue")}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {cat[lang]} • {request.unit?.number}
          </p>
        </div>
      </div>

      {/* Status Workflow Buttons */}
      {validTransitions.length > 0 && (() => {
        const statusButtonStyles: Record<string, string> = {
          ASSIGNED: "bg-info/10 text-info-strong border border-info/30 hover:bg-info/20",
          IN_PROGRESS: "bg-warning/10 text-warning-strong border border-warning/30 hover:bg-warning/20",
          ON_HOLD: "bg-warning/10 text-warning-strong border border-warning/30 hover:bg-warning/20",
          RESOLVED: "bg-secondary/10 text-secondary border border-secondary/30 hover:bg-secondary/20",
          CLOSED: "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20",
        };
        return (
          <div className="bg-card rounded-md shadow-card border border-border p-4 flex items-center gap-3 flex-wrap">
            <span className="text-xs text-muted-foreground font-bold">{t("تحويل الحالة:", "Transition status:")}</span>
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

      {/* ── Maintenance Journey ─────────────────────────────────── */}
      {journeySection}

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Details Card */}
        <div className="bg-card rounded-md shadow-card border border-border p-5 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {t("تفاصيل الطلب", "Request Details")}
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label={t("التصنيف", "Category")} value={cat[lang]} />
            <InfoRow label={t("الأولوية", "Priority")} value={<span className={priority.color}>{priority[lang]}</span>} />
            <InfoRow label={t("الوحدة", "Unit")} value={`${request.unit?.number} — ${request.unit?.building?.name}`} />
            <InfoRow label={t("المبنى", "Building")} value={request.unit?.building?.name} />
            <InfoRow label={t("تاريخ الإنشاء", "Created")} value={formatDualDate(request.createdAt, lang)} />
            <InfoRow
              label={t("تاريخ الاستحقاق", "Due Date")}
              value={
                request.dueDate ? (
                  <span className={isOverdue ? "text-destructive font-bold" : ""}>
                    {formatDualDate(request.dueDate, lang)}
                  </span>
                ) : "—"
              }
            />
            {request.scheduledDate && (
              <InfoRow label={t("تاريخ مجدول", "Scheduled")} value={formatDualDate(request.scheduledDate, lang)} />
            )}
            {request.completedAt && (
              <InfoRow label={t("تاريخ الإنجاز", "Completed")} value={formatDualDate(request.completedAt, lang)} />
            )}
          </div>
          {request.description && (
            <div className="pt-3 border-t border-border">
              <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">{t("الوصف", "Description")}</p>
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
                {t("المُعيَّن", "Assigned To")}
              </h4>
              <Button variant="ghost" size="sm" onClick={() => setShowAssign(!showAssign)} style={{ display: "inline-flex" }} aria-label={t("تعديل", "Edit")}>
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
              <p className="text-sm text-muted-foreground">{t("لم يتم التعيين بعد", "Not assigned")}</p>
            )}
            {showAssign && (
              <div className="pt-3 border-t border-border space-y-2">
                <SelectField
                  aria-label={t("المُعيَّن", "Assigned To")}
                  onChange={(e) => handleAssign(e.target.value)}
                  className={inputClass}
                  defaultValue=""
                >
                  <option value="">{t("— بدون تعيين —", "— Unassigned —")}</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </SelectField>
              </div>
            )}
          </div>

          {/* Cost Section */}
          <div className="bg-card rounded-md shadow-card border border-border p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <CircleDollarSign className="h-3.5 w-3.5" />
                {t("التكاليف", "Costs")}
              </h4>
              <Button variant="ghost" size="sm" onClick={() => setEditingCost(!editingCost)} style={{ display: "inline-flex" }} aria-label={t("تعديل", "Edit")}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InfoRow
                label={t("التكلفة التقديرية", "Estimated")}
                value={
                  request.estimatedCost ? (
                    <SARAmount value={Number(request.estimatedCost)} size={12} />
                  ) : "—"
                }
              />
              <InfoRow
                label={t("التكلفة الفعلية", "Actual")}
                value={
                  request.actualCost ? (
                    <SARAmount value={Number(request.actualCost)} size={12} />
                  ) : "—"
                }
              />
              <InfoRow
                label={t("ساعات العمل", "Labor Hours")}
                value={request.laborHours ? `${request.laborHours} ${t("ساعة", "hrs")}` : "—"}
              />
            </div>
            {editingCost && (
              <div className="pt-3 border-t border-border space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground">{t("التكلفة الفعلية", "Actual Cost")}</label>
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
                    <label className="text-[10px] font-bold text-muted-foreground">{t("ساعات العمل", "Labor Hours")}</label>
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
                  <label className="text-[10px] font-bold text-muted-foreground">{t("ملاحظات", "Notes")}</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputClass} h-16 py-2`} />
                </div>
                <Button size="sm" onClick={handleSaveCost} disabled={saving} className="gap-2" style={{ display: "inline-flex" }}>
                  {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                  {t("حفظ", "Save")}
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
            {t("ملاحظات", "Notes")}
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
            <p className="text-[10px] text-muted-foreground">{t("هذا الطلب جزء من خطة صيانة وقائية", "This request is part of a preventive plan")}</p>
          </div>
        </div>
      )}
    </div>
    </div>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
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
