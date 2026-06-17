"use client";

import { useLanguage } from "../../../../components/LanguageProvider";
import { useSession } from "../../../../components/SimpleSessionProvider";
import { isSystemRole } from "../../../../lib/permissions";
import * as React from "react";
import {
  Trash2,
  ArrowLeft,
  ArrowRight,
  X,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Database,
  Clock,
  Settings,
  Play,
  ShieldCheck,
  Bell,
  Webhook,
  ScrollText,
  Info,
} from "lucide-react";
import {
  Button,
  IconButton,
  AppBar,
  EmptyState,
  Skeleton,
  Badge,
  Switch,
  DataTable,
  ConfirmDialog,
  Field,
  Input,
  type ColumnDef,
} from "@repo/ui";
import { PageHeader } from "@repo/ui/components/PageHeader";
import Link from "next/link";
import {
  getRetentionOverview,
  runDataRetention,
  saveRetentionConfig,
} from "../../../actions/data-retention";
import type {
  RetentionOverview,
  RetentionTable,
  RetentionTableStat,
  ExecuteRetentionResult,
} from "./types";

// ─── Constants ─────────────────────────────────────────────────────────────────

const PDPL_FLOOR = 730; // audit & consent floor (days)

const TABLE_ICON: Record<RetentionTable, React.ElementType> = {
  AuditLog: ScrollText,
  ConsentLog: ShieldCheck,
  Notification: Bell,
  WebhookEvent: Webhook,
};

// ─── Translations ────────────────────────────────────────────────────────────

const t = {
  ar: {
    back: "إدارة المنصة",
    title: "الاحتفاظ بالبيانات والإتلاف",
    subtitle: "إتلاف بيانات السجلات الزمنية وفق سياسة PDPL/NDMO — يدوياً أو بجدولة يومية",
    unauthorizedTitle: "غير مصرح",
    unauthorizedDesc: "هذه الصفحة متاحة لفريق المنصة فقط.",
    mobileTitle: "الاحتفاظ بالبيانات",
    // Table names
    AuditLog: "سجل التدقيق",
    ConsentLog: "سجل الموافقة",
    Notification: "الإشعارات",
    WebhookEvent: "أحداث Webhook",
    // Columns
    category: "الفئة",
    rowCount: "عدد السجلات",
    oldest: "أقدم سجل",
    window: "نافذة الاحتفاظ",
    eligible: "مؤهل للإتلاف",
    days: "يوم",
    disabled: "معطّل",
    none: "لا يوجد",
    // KPI
    totalRows: "إجمالي السجلات",
    oldestRecord: "أقدم سجل",
    pendingDestruction: "بانتظار الإتلاف",
    schedulerLabel: "المجدول اليومي",
    schedulerOn: "مفعّل",
    schedulerOff: "معطّل",
    // Actions
    configure: "الإعدادات",
    runNow: "تشغيل الآن",
    lastRun: "آخر تشغيل",
    never: "لم يُشغّل بعد",
    // Config modal
    configTitle: "إعدادات الاحتفاظ بالبيانات",
    configHelp: "حدّد نافذة الاحتفاظ لكل فئة بالأيام. القيمة 0 تعطّل إتلاف تلك الفئة.",
    pdplNote: "سجل التدقيق وسجل الموافقة لا يقلّان عن 730 يوماً (PDPL/NDMO).",
    runHour: "ساعة التشغيل اليومي (0–23)",
    enableScheduler: "تفعيل المجدول اليومي",
    save: "حفظ الإعدادات",
    saving: "جاري الحفظ...",
    cancel: "إلغاء",
    pdplError: "يجب أن تكون 730 يوماً على الأقل",
    // Run / preview
    previewTitle: "معاينة الإتلاف",
    previewHelp: "هذه السجلات مؤهلة للإتلاف وفق النوافذ الحالية:",
    nothingEligible: "لا توجد سجلات مؤهلة للإتلاف حالياً.",
    destroyN: (n: number) => `إتلاف ${n} سجل`,
    confirmTitle: "تأكيد الإتلاف النهائي",
    confirmDesc: (n: number) =>
      `سيتم حذف ${n} سجل نهائياً ولا يمكن التراجع. هل أنت متأكد؟`,
    confirmBtn: "إتلاف نهائي",
    close: "إغلاق",
    // Toasts
    saveSuccess: "تم حفظ الإعدادات",
    saveError: "فشل حفظ الإعدادات",
    previewError: "فشل تشغيل المعاينة",
    destroyed: (n: number) => `تم إتلاف ${n} سجل`,
    destroyError: "فشل الإتلاف",
    lockedInfo: "هناك عملية إتلاف قيد التشغيل بالفعل — تم تخطّي هذه المحاولة.",
  },
  en: {
    back: "Platform Administration",
    title: "Data Retention & Destruction",
    subtitle:
      "PDPL/NDMO time-series destruction — run manually or on a daily schedule",
    unauthorizedTitle: "Unauthorized",
    unauthorizedDesc: "This page is available to platform staff only.",
    mobileTitle: "Data Retention",
    // Table names
    AuditLog: "Audit Log",
    ConsentLog: "Consent Log",
    Notification: "Notifications",
    WebhookEvent: "Webhook Events",
    // Columns
    category: "Category",
    rowCount: "Rows",
    oldest: "Oldest record",
    window: "Retention window",
    eligible: "Eligible to destroy",
    days: "days",
    disabled: "Disabled",
    none: "None",
    // KPI
    totalRows: "Total rows",
    oldestRecord: "Oldest record",
    pendingDestruction: "Pending destruction",
    schedulerLabel: "Daily scheduler",
    schedulerOn: "Enabled",
    schedulerOff: "Disabled",
    // Actions
    configure: "Configure",
    runNow: "Run now",
    lastRun: "Last run",
    never: "Never run",
    // Config modal
    configTitle: "Retention Settings",
    configHelp:
      "Set the retention window per category in days. A value of 0 disables destruction for that category.",
    pdplNote: "Audit Log and Consent Log may not go below 730 days (PDPL/NDMO).",
    runHour: "Daily run hour (0–23)",
    enableScheduler: "Enable daily scheduler",
    save: "Save settings",
    saving: "Saving...",
    cancel: "Cancel",
    pdplError: "Must be at least 730 days",
    // Run / preview
    previewTitle: "Destruction preview",
    previewHelp: "These records are eligible for destruction under the current windows:",
    nothingEligible: "No records are currently eligible for destruction.",
    destroyN: (n: number) => `Destroy ${n} records`,
    confirmTitle: "Confirm permanent destruction",
    confirmDesc: (n: number) =>
      `${n} records will be permanently deleted. This cannot be undone. Are you sure?`,
    confirmBtn: "Destroy permanently",
    close: "Close",
    // Toasts
    saveSuccess: "Settings saved",
    saveError: "Failed to save settings",
    previewError: "Failed to run preview",
    destroyed: (n: number) => `Destroyed ${n} records`,
    destroyError: "Destruction failed",
    lockedInfo: "A destruction sweep is already running — this attempt was skipped.",
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function ageLabel(iso: string | null, lang: "ar" | "en", noneLabel: string): string {
  if (!iso) return noneLabel;
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86400000);
  if (days < 1) return lang === "ar" ? "اليوم" : "Today";
  if (days < 30) return lang === "ar" ? `${days} يوم` : `${days}d`;
  if (days < 365) {
    const months = Math.floor(days / 30);
    return lang === "ar" ? `${months} شهر` : `${months}mo`;
  }
  const years = (days / 365).toFixed(1);
  return lang === "ar" ? `${years} سنة` : `${years}y`;
}

function numFmt(n: number, lang: "ar" | "en"): string {
  return n.toLocaleString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-US");
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DataRetentionPage() {
  const { lang } = useLanguage();
  const { data: session } = useSession();
  const userRole = session?.user?.role ?? "";
  const authorized = isSystemRole(userRole);
  const labels = t[lang];

  const [overview, setOverview] = React.useState<RetentionOverview | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Toast
  const [toast, setToast] = React.useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const showToast = React.useCallback(
    (message: string, type: "success" | "error" | "info") => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 4000);
    },
    [],
  );

  // Config modal
  const [showConfig, setShowConfig] = React.useState(false);
  const [cfgAudit, setCfgAudit] = React.useState("730");
  const [cfgConsent, setCfgConsent] = React.useState("730");
  const [cfgNotif, setCfgNotif] = React.useState("180");
  const [cfgWebhook, setCfgWebhook] = React.useState("90");
  const [cfgScheduler, setCfgScheduler] = React.useState(false);
  const [cfgRunHour, setCfgRunHour] = React.useState("3");
  const [cfgErrors, setCfgErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  // Run / preview
  const [previewing, setPreviewing] = React.useState(false);
  const [preview, setPreview] = React.useState<ExecuteRetentionResult | null>(null);
  const [destroying, setDestroying] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const fetchData = React.useCallback(async () => {
    try {
      const data = await getRetentionOverview();
      setOverview(data);
    } catch (err) {
      console.error("Failed to load retention overview:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await getRetentionOverview();
        if (active) setOverview(data);
      } catch (err) {
        if (active) console.error("Failed to load retention overview:", err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // ── Config modal ───────────────────────────────────────────────────────────

  const openConfig = () => {
    if (!overview) return;
    const c = overview.config;
    setCfgAudit(String(c.retentionAuditLogDays));
    setCfgConsent(String(c.retentionConsentLogDays));
    setCfgNotif(String(c.retentionNotificationDays));
    setCfgWebhook(String(c.retentionWebhookEventDays));
    setCfgScheduler(c.retentionSchedulerEnabled);
    setCfgRunHour(String(c.retentionRunHour));
    setCfgErrors({});
    setShowConfig(true);
  };

  const validateConfig = (): boolean => {
    const errors: Record<string, string> = {};
    if ((parseInt(cfgAudit, 10) || 0) < PDPL_FLOOR) errors.audit = labels.pdplError;
    if ((parseInt(cfgConsent, 10) || 0) < PDPL_FLOOR) errors.consent = labels.pdplError;
    setCfgErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveConfig = async () => {
    if (!validateConfig()) return;
    setSaving(true);
    try {
      await saveRetentionConfig({
        retentionAuditLogDays: parseInt(cfgAudit, 10) || PDPL_FLOOR,
        retentionConsentLogDays: parseInt(cfgConsent, 10) || PDPL_FLOOR,
        retentionNotificationDays: parseInt(cfgNotif, 10) || 0,
        retentionWebhookEventDays: parseInt(cfgWebhook, 10) || 0,
        retentionSchedulerEnabled: cfgScheduler,
        retentionRunHour: parseInt(cfgRunHour, 10) || 0,
      });
      showToast(labels.saveSuccess, "success");
      setShowConfig(false);
      setPreview(null);
      await fetchData();
    } catch {
      showToast(labels.saveError, "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Run preview (dry-run) ──────────────────────────────────────────────────

  const handlePreview = async () => {
    setPreviewing(true);
    setPreview(null);
    try {
      const result = await runDataRetention(true);
      if (result.status === "SKIPPED_LOCKED") {
        showToast(labels.lockedInfo, "info");
      } else {
        setPreview(result);
      }
    } catch {
      showToast(labels.previewError, "error");
    } finally {
      setPreviewing(false);
    }
  };

  const previewTotal =
    preview && preview.status === "SUCCESS"
      ? Object.values(preview.perTable).reduce((s, r) => s + r.eligible, 0)
      : 0;

  const handleDestroy = async () => {
    setDestroying(true);
    try {
      const result = await runDataRetention(false);
      if (result.status === "SKIPPED_LOCKED") {
        showToast(labels.lockedInfo, "info");
      } else {
        showToast(labels.destroyed(result.totalDeleted), "success");
        setPreview(null);
        await fetchData();
      }
    } catch {
      showToast(labels.destroyError, "error");
    } finally {
      setDestroying(false);
    }
  };

  // ── Derived KPI values ─────────────────────────────────────────────────────

  const totalRows = overview
    ? overview.tables.reduce((s, t2) => s + t2.rowCount, 0)
    : 0;
  const totalEligible = overview
    ? overview.tables.reduce((s, t2) => s + t2.eligibleNow, 0)
    : 0;
  const oldestIso = overview
    ? overview.tables
        .map((t2) => t2.oldestCreatedAt)
        .filter((x): x is string => !!x)
        .sort()[0] ?? null
    : null;

  // ── Columns ────────────────────────────────────────────────────────────────

  const columns: ColumnDef<RetentionTableStat>[] = React.useMemo(
    () => [
      {
        accessorKey: "table",
        header: labels.category,
        enableSorting: true,
        cell: ({ row }) => {
          const Icon = TABLE_ICON[row.original.table];
          return (
            <div className="flex items-center gap-2">
              <span className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Icon className="h-4 w-4" />
              </span>
              <span className="font-medium text-foreground">
                {labels[row.original.table]}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "rowCount",
        header: labels.rowCount,
        enableSorting: true,
        meta: { numeric: true },
        cell: ({ row }) => (
          <span className="tabular-nums text-foreground">
            {numFmt(row.original.rowCount, lang)}
          </span>
        ),
      },
      {
        accessorKey: "oldestCreatedAt",
        header: labels.oldest,
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {ageLabel(row.original.oldestCreatedAt, lang, labels.none)}
          </span>
        ),
      },
      {
        accessorKey: "windowDays",
        header: labels.window,
        enableSorting: true,
        meta: { numeric: true },
        cell: ({ row }) =>
          row.original.windowDays === 0 ? (
            <Badge variant="default" size="sm">
              {labels.disabled}
            </Badge>
          ) : (
            <span className="tabular-nums text-muted-foreground">
              {numFmt(row.original.windowDays, lang)} {labels.days}
            </span>
          ),
      },
      {
        accessorKey: "eligibleNow",
        header: labels.eligible,
        enableSorting: true,
        meta: { numeric: true },
        cell: ({ row }) => {
          const n = row.original.eligibleNow;
          return (
            <span
              className={`tabular-nums font-semibold ${
                n > 0 ? "text-warning-strong" : "text-muted-foreground"
              }`}
            >
              {numFmt(n, lang)}
            </span>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang, labels],
  );

  // ── KPI tile ───────────────────────────────────────────────────────────────

  const KpiTile = ({
    icon: Icon,
    label,
    value,
    sub,
    warn,
  }: {
    icon: React.ElementType;
    label: string;
    value: string;
    sub?: string;
    warn?: boolean;
  }) => (
    <div
      className={`rounded-md border bg-card p-4 ${
        warn ? "border-warning-strong/40" : "border-border"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 ${
            warn ? "bg-warning-strong/10 text-warning-strong" : "bg-primary/10 text-primary"
          }`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p
        className={`text-2xl font-bold tabular-nums ${
          warn ? "text-warning-strong" : "text-foreground"
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );

  // ── Shared bits ────────────────────────────────────────────────────────────

  const BackArrow = lang === "ar" ? ArrowRight : ArrowLeft;

  const lastRunLabel = overview?.lastRun
    ? new Date(overview.lastRun.startedAt).toLocaleString(
        lang === "ar" ? "ar-SA-u-nu-latn" : "en-US",
        { dateStyle: "medium", timeStyle: "short" },
      )
    : labels.never;

  // Preview panel — shared desktop/mobile
  const previewPanel =
    preview && preview.status === "SUCCESS" ? (
      <div className="rounded-md border border-border bg-muted/30 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-info-strong" />
          <h3 className="text-sm font-semibold text-foreground">
            {labels.previewTitle}
          </h3>
        </div>
        {previewTotal === 0 ? (
          <p className="text-sm text-muted-foreground">{labels.nothingEligible}</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">{labels.previewHelp}</p>
            <ul className="space-y-1.5">
              {(Object.keys(preview.perTable) as RetentionTable[])
                .filter((tk) => preview.perTable[tk].eligible > 0)
                .map((tk) => (
                  <li
                    key={tk}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-foreground">{labels[tk]}</span>
                    <span className="tabular-nums font-semibold text-warning-strong">
                      {numFmt(preview.perTable[tk].eligible, lang)}
                    </span>
                  </li>
                ))}
            </ul>
            <Button
              variant="destructive"
              onClick={() => setConfirmOpen(true)}
              disabled={destroying}
              style={{ display: "inline-flex" }}
            >
              {destroying ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent me-2" />
                  {labels.saving}
                </>
              ) : (
                <>
                  <Trash2 className="h-[18px] w-[18px] me-2" />
                  {labels.destroyN(previewTotal)}
                </>
              )}
            </Button>
          </>
        )}
      </div>
    ) : null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ─── Mobile (< md) ─────────────────────────────────────────────── */}
      <div
        className="md:hidden -m-4 sm:-m-6 min-h-dvh flex flex-col bg-background"
        dir={lang === "ar" ? "rtl" : "ltr"}
      >
        <AppBar title={labels.mobileTitle} lang={lang} />

        {!authorized ? (
          <div className="flex-1 px-4 pt-10">
            <EmptyState
              icon={<ShieldAlert className="h-10 w-10" aria-hidden="true" />}
              title={labels.unauthorizedTitle}
              description={labels.unauthorizedDesc}
            />
          </div>
        ) : (
          <div className="flex-1 px-4 pb-24 pt-3 space-y-4">
            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <KpiTile
                    icon={Database}
                    label={labels.totalRows}
                    value={numFmt(totalRows, lang)}
                  />
                  <KpiTile
                    icon={Trash2}
                    label={labels.pendingDestruction}
                    value={numFmt(totalEligible, lang)}
                    warn={totalEligible > 0}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={openConfig}
                    style={{ display: "inline-flex" }}
                  >
                    <Settings className="h-4 w-4 me-1.5" />
                    {labels.configure}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handlePreview}
                    disabled={previewing}
                    style={{ display: "inline-flex" }}
                  >
                    <Play className="h-4 w-4 me-1.5" />
                    {labels.runNow}
                  </Button>
                </div>

                {previewPanel}

                <DataTable
                  columns={columns}
                  data={overview?.tables ?? []}
                  locale={lang === "ar" ? "ar" : "en"}
                  getRowId={(r) => r.table}
                />

                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {labels.lastRun}: {lastRunLabel}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* ─── Desktop (≥ md) ─────────────────────────────────────────────── */}
      <div className="hidden md:block">
        {loading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : !authorized ? (
          <div className="pt-10">
            <EmptyState
              icon={<ShieldAlert className="h-10 w-10" aria-hidden="true" />}
              title={labels.unauthorizedTitle}
              description={labels.unauthorizedDesc}
            />
          </div>
        ) : (
          <div
            className="space-y-6 animate-in fade-in duration-500"
            dir={lang === "ar" ? "rtl" : "ltr"}
          >
            {/* Toast */}
            {toast && (
              <div
                className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-5 py-3 rounded-lg shadow-lg text-sm font-medium transition-all duration-300 ${
                  toast.type === "success"
                    ? "bg-success text-white"
                    : toast.type === "info"
                      ? "bg-info-strong text-white"
                      : "bg-destructive text-white"
                }`}
              >
                {toast.type === "success" ? (
                  <CheckCircle2 className="h-[18px] w-[18px]" />
                ) : toast.type === "info" ? (
                  <Info className="h-[18px] w-[18px]" />
                ) : (
                  <AlertCircle className="h-[18px] w-[18px]" />
                )}
                {toast.message}
                <IconButton
                  icon={X}
                  onClick={() => setToast(null)}
                  aria-label={labels.close}
                  variant="ghost"
                  size="icon"
                  className="ms-2 h-5 w-5 min-h-0 hover:opacity-70"
                />
              </div>
            )}

            {/* Back link */}
            <div className="flex items-center justify-between">
              <Link
                href="/dashboard/admin"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <BackArrow className="h-4 w-4" />
                {labels.back}
              </Link>
            </div>

            {/* Header */}
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Trash2 className="h-7 w-7" />
              </div>
              <PageHeader
                className="flex-1"
                title={labels.title}
                description={labels.subtitle}
                actions={
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={openConfig}>
                      <Settings className="h-[18px] w-[18px] me-2" />
                      {labels.configure}
                    </Button>
                    <Button onClick={handlePreview} disabled={previewing}>
                      {previewing ? (
                        <>
                          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent me-2" />
                          {labels.runNow}
                        </>
                      ) : (
                        <>
                          <Play className="h-[18px] w-[18px] me-2" />
                          {labels.runNow}
                        </>
                      )}
                    </Button>
                  </div>
                }
              />
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <KpiTile
                icon={Database}
                label={labels.totalRows}
                value={numFmt(totalRows, lang)}
              />
              <KpiTile
                icon={Clock}
                label={labels.oldestRecord}
                value={ageLabel(oldestIso, lang, labels.none)}
              />
              <KpiTile
                icon={Trash2}
                label={labels.pendingDestruction}
                value={numFmt(totalEligible, lang)}
                warn={totalEligible > 0}
              />
              <KpiTile
                icon={Clock}
                label={labels.schedulerLabel}
                value={
                  overview?.config.retentionSchedulerEnabled
                    ? labels.schedulerOn
                    : labels.schedulerOff
                }
                sub={`${labels.lastRun}: ${lastRunLabel}`}
              />
            </div>

            {/* Preview panel */}
            {previewPanel}

            {/* Per-table grid */}
            <DataTable
              columns={columns}
              data={overview?.tables ?? []}
              locale={lang === "ar" ? "ar" : "en"}
              getRowId={(r) => r.table}
            />
          </div>
        )}
      </div>

      {/* ── Config Modal ─────────────────────────────────────────────────── */}
      {showConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowConfig(false)}
          />
          <div
            className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-card rounded-xl border border-border shadow-xl mx-4"
            dir={lang === "ar" ? "rtl" : "ltr"}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card rounded-t-xl z-10">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                  <Settings className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-bold text-foreground">
                  {labels.configTitle}
                </h2>
              </div>
              <IconButton
                icon={X}
                onClick={() => setShowConfig(false)}
                aria-label={labels.close}
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground"
              />
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              <p className="text-sm text-muted-foreground">{labels.configHelp}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Audit */}
                <Field
                  label={`${labels.AuditLog} (${labels.days})`}
                  error={cfgErrors.audit}
                >
                  {(field) => (
                    <Input
                      {...field}
                      type="number"
                      value={cfgAudit}
                      onChange={(e) => setCfgAudit(e.target.value)}
                      min={PDPL_FLOOR}
                      step={1}
                    />
                  )}
                </Field>
                {/* Consent */}
                <Field
                  label={`${labels.ConsentLog} (${labels.days})`}
                  error={cfgErrors.consent}
                >
                  {(field) => (
                    <Input
                      {...field}
                      type="number"
                      value={cfgConsent}
                      onChange={(e) => setCfgConsent(e.target.value)}
                      min={PDPL_FLOOR}
                      step={1}
                    />
                  )}
                </Field>
                {/* Notification */}
                <Field label={`${labels.Notification} (${labels.days})`}>
                  {(field) => (
                    <Input
                      {...field}
                      type="number"
                      value={cfgNotif}
                      onChange={(e) => setCfgNotif(e.target.value)}
                      min={0}
                      step={1}
                    />
                  )}
                </Field>
                {/* Webhook */}
                <Field label={`${labels.WebhookEvent} (${labels.days})`}>
                  {(field) => (
                    <Input
                      {...field}
                      type="number"
                      value={cfgWebhook}
                      onChange={(e) => setCfgWebhook(e.target.value)}
                      min={0}
                      step={1}
                    />
                  )}
                </Field>
              </div>

              <p className="text-xs text-warning-strong flex items-start gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                {labels.pdplNote}
              </p>

              {/* Scheduler */}
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">
                    {labels.enableScheduler}
                  </span>
                </div>
                <Switch
                  checked={cfgScheduler}
                  onCheckedChange={setCfgScheduler}
                  aria-label={labels.enableScheduler}
                />
              </div>

              {/* Run hour */}
              <Field label={labels.runHour}>
                {(field) => (
                  <Input
                    {...field}
                    type="number"
                    value={cfgRunHour}
                    onChange={(e) => setCfgRunHour(e.target.value)}
                    min={0}
                    max={23}
                    step={1}
                  />
                )}
              </Field>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/30 rounded-b-xl">
              <Button variant="secondary" onClick={() => setShowConfig(false)}>
                {labels.cancel}
              </Button>
              <Button onClick={handleSaveConfig} disabled={saving}>
                {saving ? (
                  <>
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent me-2" />
                    {labels.saving}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-[18px] w-[18px] me-2" />
                    {labels.save}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Destroy confirm ──────────────────────────────────────────────── */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={labels.confirmTitle}
        description={labels.confirmDesc(previewTotal)}
        confirmLabel={labels.confirmBtn}
        cancelLabel={labels.cancel}
        onConfirm={handleDestroy}
        variant="destructive"
      />
    </>
  );
}
