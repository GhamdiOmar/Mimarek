"use client";

import * as React from "react";
import { CalendarClock, Plus, X } from "lucide-react";
import {
  Button,
  IconButton,
  AppBar,
  DataCard,
  DataTable,
  EmptyState,
  FAB,
  Skeleton,
  Badge,
  Input,
  SelectField,
  SARAmountInput,
  ResponsiveDialog,
  ConfirmDialog,
  type ColumnDef,
} from "@repo/ui";
import { PageHeader } from "@repo/ui/components/PageHeader";
import { useLanguage } from "../../../../components/LanguageProvider";
import { useSession } from "../../../../components/SimpleSessionProvider";
import { isSystemRole } from "../../../../lib/permissions";
import { sanitizeError } from "../../../../lib/error-sanitizer";
import {
  adminListScheduledChanges,
  adminSchedulePlanChange,
  adminCancelScheduledChange,
} from "../../../actions/scheduled-plan-changes";
import { adminGetAllPlans } from "../../../actions/billing";

type PlanOpt = { id: string; slug: string; nameEn: string; nameAr: string };
type PlanRef = { id: string; slug: string; nameEn: string; nameAr: string };
type ChangeRow = {
  id: string;
  sourcePlan: PlanRef;
  targetPlan: PlanRef | null;
  changeType: string;
  newPriceMonthly: number | string | null;
  newPriceAnnual: number | string | null;
  effectiveAt: string;
  announceAt: string | null;
  grandfatherUntil: string | null;
  status: string;
  appliedAt: string | null;
  affectedCount: number | null;
  previewCount: number | null;
  reason: string | null;
};

const STATUS: Record<string, { variant: "info" | "default" | "warning" | "success" | "error"; ar: string; en: string }> = {
  SCHEDULED: { variant: "info", ar: "مجدول", en: "Scheduled" },
  ANNOUNCED: { variant: "default", ar: "مُعلن", en: "Announced" },
  APPLYING: { variant: "warning", ar: "قيد التطبيق", en: "Applying" },
  APPLIED: { variant: "success", ar: "مُطبَّق", en: "Applied" },
  CANCELED: { variant: "error", ar: "ملغى", en: "Canceled" },
};

const T = {
  ar: {
    title: "التغييرات المجدولة", subtitle: "غيّر أسعار أو خطط مجموعة من الاشتراكات بموعد تنفيذ مستقبلي.",
    unauthorized: "غير مصرح", unauthorizedDesc: "هذه الصفحة متاحة لموظفي المنصة فقط.",
    empty: "لا توجد تغييرات مجدولة", emptyDesc: "أنشئ أول تغيير سعر أو ترحيل خطة بموعد تنفيذ.",
    create: "جدولة تغيير", schedule: "جدولة", cancel: "إلغاء", close: "إغلاق", keep: "تراجع",
    cohort: "الخطة المصدر", type: "نوع التغيير", priceOnly: "تغيير سعر", migration: "ترحيل خطة",
    target: "الخطة الهدف", monthly: "السعر الشهري", annual: "السعر السنوي",
    effective: "تاريخ التنفيذ", announce: "تاريخ الإعلان (اختياري)", grandfather: "التجميد حتى (اختياري)",
    reason: "السبب (اختياري)", change: "التغيير", effectiveCol: "التنفيذ", status: "الحالة",
    affected: "المتأثرون", actions: "إجراءات", saved: "تم الحفظ بنجاح",
    confirmTitle: "إلغاء التغيير المجدول", confirmDesc: "لن يتم تطبيق هذا التغيير. لا يمكن التراجع.",
    confirmCta: "إلغاء التغيير", toMigrate: "ترحيل إلى", reprice: "إعادة تسعير",
  },
  en: {
    title: "Scheduled changes", subtitle: "Re-price or migrate a cohort of subscriptions at a future cutoff.",
    unauthorized: "Unauthorized", unauthorizedDesc: "This page is available to platform staff only.",
    empty: "No scheduled changes", emptyDesc: "Schedule the first price change or plan migration with a cutoff.",
    create: "Schedule a change", schedule: "Schedule", cancel: "Cancel", close: "Close", keep: "Keep it",
    cohort: "Source plan", type: "Change type", priceOnly: "Price change", migration: "Plan migration",
    target: "Target plan", monthly: "Monthly price", annual: "Annual price",
    effective: "Effective date", announce: "Announce date (optional)", grandfather: "Grandfather until (optional)",
    reason: "Reason (optional)", change: "Change", effectiveCol: "Effective", status: "Status",
    affected: "Affected", actions: "Actions", saved: "Saved successfully",
    confirmTitle: "Cancel scheduled change", confirmDesc: "This change will not be applied. This can't be undone.",
    confirmCta: "Cancel change", toMigrate: "Migrate to", reprice: "Re-price",
  },
};

type FormState = {
  sourcePlanId: string;
  changeType: "PRICE_ONLY" | "PLAN_MIGRATION";
  targetPlanId: string;
  newPriceMonthly: number | null;
  newPriceAnnual: number | null;
  effectiveAt: string;
  announceAt: string;
  grandfatherUntil: string;
  reason: string;
};

const emptyForm = (firstPlanId: string): FormState => ({
  sourcePlanId: firstPlanId,
  changeType: "PRICE_ONLY",
  targetPlanId: "",
  // null (not 0): an untouched price field means "don't change that cycle" — so
  // a monthly-only edit never zeroes the annual-cycle cohort, and vice-versa.
  newPriceMonthly: null,
  newPriceAnnual: null,
  effectiveAt: "",
  announceAt: "",
  grandfatherUntil: "",
  reason: "",
});

export default function AdminScheduledChangesPage() {
  const { lang } = useLanguage();
  const t = T[lang];
  const { data: session } = useSession();
  const authorized = isSystemRole(session?.user?.role ?? "");

  const [rows, setRows] = React.useState<ChangeRow[]>([]);
  const [plans, setPlans] = React.useState<PlanOpt[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(emptyForm(""));
  const [busy, setBusy] = React.useState(false);
  const [banner, setBanner] = React.useState<{ ok: boolean; msg: string } | null>(null);
  const [confirmCancel, setConfirmCancel] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    if (!authorized) { setLoading(false); return; }
    let alive = true;
    (async () => {
      try {
        const [c, p] = await Promise.all([adminListScheduledChanges(), adminGetAllPlans()]);
        if (!alive) return;
        setRows(c as ChangeRow[]);
        setPlans(p as PlanOpt[]);
      } catch (err) {
        if (alive) setBanner({ ok: false, msg: sanitizeError(err, lang) });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, tick]);

  function openCreate() {
    setForm(emptyForm(plans[0]?.id ?? ""));
    setBanner(null);
    setDialogOpen(true);
  }

  async function submit() {
    setBusy(true);
    setBanner(null);
    try {
      await adminSchedulePlanChange({
        sourcePlanId: form.sourcePlanId,
        changeType: form.changeType,
        targetPlanId: form.changeType === "PLAN_MIGRATION" ? form.targetPlanId : null,
        newPriceMonthly: form.changeType === "PRICE_ONLY" ? form.newPriceMonthly ?? null : null,
        newPriceAnnual: form.changeType === "PRICE_ONLY" ? form.newPriceAnnual ?? null : null,
        effectiveAt: form.effectiveAt,
        announceAt: form.announceAt || null,
        grandfatherUntil: form.grandfatherUntil || null,
        reason: form.reason,
      });
      setDialogOpen(false);
      setTick((x) => x + 1);
    } catch (err) {
      setBanner({ ok: false, msg: sanitizeError(err, lang) });
    } finally {
      setBusy(false);
    }
  }

  async function cancelChange(id: string) {
    setBanner(null);
    try {
      await adminCancelScheduledChange(id);
      setTick((x) => x + 1);
    } catch (err) {
      setBanner({ ok: false, msg: sanitizeError(err, lang) });
    }
  }

  const planName = (p: PlanRef | null) => (p ? (lang === "ar" ? p.nameAr : p.nameEn) : "—");
  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";
  const changeLabel = (r: ChangeRow) =>
    r.changeType === "PLAN_MIGRATION" ? `${t.toMigrate} ${planName(r.targetPlan)}` : t.reprice;
  const pending = (r: ChangeRow) => r.status === "SCHEDULED" || r.status === "ANNOUNCED";

  const columns: ColumnDef<ChangeRow>[] = [
    {
      accessorKey: "sourcePlan",
      header: t.cohort,
      cell: ({ row }) => <span className="font-medium text-foreground">{planName(row.original.sourcePlan)}</span>,
    },
    { id: "change", header: t.change, enableSorting: false, cell: ({ row }) => <span className="text-sm">{changeLabel(row.original)}</span> },
    { id: "effective", header: t.effectiveCol, enableSorting: false, cell: ({ row }) => <span className="text-sm tabular-nums" dir="ltr">{fmtDate(row.original.effectiveAt)}</span> },
    {
      id: "status",
      header: t.status,
      enableSorting: false,
      cell: ({ row }) => {
        const s = STATUS[row.original.status];
        return <Badge variant={s?.variant ?? "default"} size="sm">{s ? s[lang] : row.original.status}</Badge>;
      },
    },
    {
      id: "affected",
      header: t.affected,
      enableSorting: false,
      cell: ({ row }) => (
        <span className="tabular-nums" dir="ltr">{row.original.affectedCount ?? row.original.previewCount ?? "—"}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) =>
        pending(row.original) ? (
          <div className="flex items-center justify-end gap-1">
            <IconButton icon={X} aria-label={t.cancel} variant="ghost" className="text-destructive" onClick={() => setConfirmCancel(row.original.id)} />
          </div>
        ) : null,
    },
  ];

  if (!authorized) {
    return (
      <div className="py-16">
        <EmptyState icon={<CalendarClock className="h-12 w-12" />} title={t.unauthorized} description={t.unauthorizedDesc} />
      </div>
    );
  }

  return (
    <>
      {/* Mobile */}
      <div className="md:hidden -m-4 sm:-m-6 min-h-dvh flex flex-col bg-background" dir={lang === "ar" ? "rtl" : "ltr"}>
        <AppBar title={t.title} lang={lang} />
        <div className="flex-1 space-y-3 px-4 pt-4 pb-24">
          {loading ? (
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)
          ) : rows.length === 0 ? (
            <EmptyState icon={<CalendarClock className="h-12 w-12" />} title={t.empty} description={t.emptyDesc}
              action={<Button onClick={openCreate}>{t.create}</Button>} />
          ) : (
            rows.map((r, i) => (
              <DataCard
                key={r.id}
                icon={CalendarClock}
                iconTone="primary"
                title={planName(r.sourcePlan)}
                subtitle={
                  <span className="inline-flex items-center gap-2">
                    <span className="text-xs">{changeLabel(r)}</span>
                    <Badge variant={STATUS[r.status]?.variant ?? "default"} size="sm">{STATUS[r.status]?.[lang] ?? r.status}</Badge>
                  </span>
                }
                trailing={<span className="text-xs tabular-nums" dir="ltr">{fmtDate(r.effectiveAt)}</span>}
                divider={i !== rows.length - 1}
              />
            ))
          )}
        </div>
        <FAB icon={Plus} label={t.create} onClick={openCreate} />
      </div>

      {/* Desktop */}
      <div className="hidden md:block">
        <PageHeader title={t.title} description={t.subtitle} actions={<Button onClick={openCreate}><Plus className="h-4 w-4" />{t.create}</Button>} />
        {banner && (
          <div role="status" className={`mb-4 rounded-lg border px-3 py-2 text-sm ${banner.ok ? "border-success/30 bg-success/10 text-success-strong" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
            {banner.msg}
          </div>
        )}
        {loading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full rounded-md" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={<CalendarClock className="h-12 w-12" />} title={t.empty} description={t.emptyDesc}
            action={<Button onClick={openCreate}>{t.create}</Button>} />
        ) : (
          <DataTable columns={columns} data={rows} />
        )}
      </div>

      <ResponsiveDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={t.create}
        description={t.subtitle}
        contentClassName="sm:max-w-[600px]"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>{t.close}</Button>
            <Button variant="primary" loading={busy} disabled={busy || !form.sourcePlanId || !form.effectiveAt || (form.changeType === "PLAN_MIGRATION" && !form.targetPlanId)} onClick={submit}>
              {t.schedule}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {banner && !banner.ok && (
            <div role="status" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{banner.msg}</div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">{t.cohort}</span>
              <SelectField value={form.sourcePlanId} onChange={(e) => setForm({ ...form, sourcePlanId: e.target.value })} aria-label={t.cohort}>
                {plans.map((p) => <option key={p.id} value={p.id}>{lang === "ar" ? p.nameAr : p.nameEn}</option>)}
              </SelectField>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">{t.type}</span>
              <SelectField value={form.changeType} onChange={(e) => setForm({ ...form, changeType: e.target.value as FormState["changeType"] })} aria-label={t.type}>
                <option value="PRICE_ONLY">{t.priceOnly}</option>
                <option value="PLAN_MIGRATION">{t.migration}</option>
              </SelectField>
            </label>

            {form.changeType === "PLAN_MIGRATION" ? (
              <label className="col-span-2 block text-sm">
                <span className="mb-1 block font-medium text-foreground">{t.target}</span>
                <SelectField value={form.targetPlanId} onChange={(e) => setForm({ ...form, targetPlanId: e.target.value })} aria-label={t.target}>
                  <option value="">—</option>
                  {plans.filter((p) => p.id !== form.sourcePlanId).map((p) => <option key={p.id} value={p.id}>{lang === "ar" ? p.nameAr : p.nameEn}</option>)}
                </SelectField>
              </label>
            ) : (
              <>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-foreground">{t.monthly}</span>
                  <SARAmountInput value={form.newPriceMonthly} onChange={(v) => setForm({ ...form, newPriceMonthly: v })} locale={lang} aria-label={t.monthly} />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-foreground">{t.annual}</span>
                  <SARAmountInput value={form.newPriceAnnual} onChange={(v) => setForm({ ...form, newPriceAnnual: v })} locale={lang} aria-label={t.annual} />
                </label>
              </>
            )}

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">{t.effective}</span>
              <Input type="date" value={form.effectiveAt} onChange={(e) => setForm({ ...form, effectiveAt: e.target.value })} dir="ltr" aria-label={t.effective} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">{t.announce}</span>
              <Input type="date" value={form.announceAt} onChange={(e) => setForm({ ...form, announceAt: e.target.value })} dir="ltr" aria-label={t.announce} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">{t.grandfather}</span>
              <Input type="date" value={form.grandfatherUntil} onChange={(e) => setForm({ ...form, grandfatherUntil: e.target.value })} dir="ltr" aria-label={t.grandfather} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">{t.reason}</span>
              <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} aria-label={t.reason} />
            </label>
          </div>
        </div>
      </ResponsiveDialog>

      <ConfirmDialog
        open={confirmCancel !== null}
        onOpenChange={(o) => !o && setConfirmCancel(null)}
        title={t.confirmTitle}
        description={t.confirmDesc}
        confirmLabel={t.confirmCta}
        cancelLabel={t.keep}
        variant="destructive"
        onConfirm={() => {
          const id = confirmCancel;
          setConfirmCancel(null);
          if (id) cancelChange(id);
        }}
      />
    </>
  );
}
