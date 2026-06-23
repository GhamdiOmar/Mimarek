"use client";

import * as React from "react";
import {
  ArrowLeft,
  FileText,
  ReceiptText,
  RotateCcw,
  RefreshCw,
  ShieldCheck,
  Radio,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Input,
  EmptyState,
  DataTable,
  ResponsiveDialog,
  DirectionalIcon,
  type ColumnDef,
} from "@repo/ui";
import { PageHeader } from "@repo/ui/components/PageHeader";
import { useLanguage } from "../../../../components/LanguageProvider";
import {
  ZATCA_EGS_STATUS_LABEL,
  ZATCA_EGS_STATUS_VARIANT,
  ZATCA_CLEARANCE_OUTCOME_LABEL,
  ZATCA_CLEARANCE_OUTCOME_VARIANT,
} from "../../../../lib/domain-labels";
import type { getPlatformEgsSummary } from "../../../actions/zatca/onboarding";
import {
  onboardPlatformEgs,
  resetPlatformEgs,
} from "../../../actions/zatca/onboarding";
import { runReportingSweep, type getReportingHealth } from "../../../actions/zatca/reporting-sweep";
import { PLATFORM_SELLER } from "../../../../lib/zatca-platform-config";

// ─── Prop types (derived from the server action's serialized return) ──────────
type Summary = Awaited<ReturnType<typeof getPlatformEgsSummary>>;
type Egs = Summary["egs"];
type ClearanceLog = Summary["logs"][number];
type ReportingHealth = Awaited<ReturnType<typeof getReportingHealth>>;

type ZatcaAdminViewProps = {
  egs: Egs;
  logs: ClearanceLog[];
  reportingHealth: ReportingHealth;
};

function formatDate(value: string | Date | null | undefined, lang: "ar" | "en"): string {
  if (!value) return "—";
  const date = new Date(value);
  return date.toLocaleDateString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: string | Date | null | undefined, lang: "ar" | "en"): string {
  if (!value) return "—";
  const date = new Date(value);
  return date.toLocaleString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ZatcaAdminView({ egs, logs, reportingHealth }: ZatcaAdminViewProps) {
  const { t, lang } = useLanguage();
  const [isPending, startTransition] = React.useTransition();
  const [isSweeping, startSweep] = React.useTransition();

  const isActive = egs != null && egs.status === "ACTIVE";

  const onRunSweep = React.useCallback(() => {
    startSweep(async () => {
      try {
        const r = await runReportingSweep();
        toast.success(
          t(
            `اكتمل الرفع: ${r.reported + r.cleared} مُرسل، ${r.stillPending} قيد الانتظار.`,
            `Sweep done: ${r.reported + r.cleared} submitted, ${r.stillPending} still pending.`,
          ),
        );
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : t("تعذّر تشغيل الرفع.", "Could not run the sweep."),
        );
      }
    });
  }, [t]);

  // ── Onboard form state — VAT + OTP only; the company identity is fixed (PLATFORM_SELLER).
  const [vatNumber, setVatNumber] = React.useState("");
  const [otp, setOtp] = React.useState("123456");
  const [formError, setFormError] = React.useState<string | null>(null);

  const [resetOpen, setResetOpen] = React.useState(false);

  const vatValid = /^\d{15}$/.test(vatNumber);

  const onOnboardSubmit = React.useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setFormError(null);

      if (!/^\d{15}$/.test(vatNumber)) {
        setFormError(t("رقم ضريبة القيمة المضافة يجب أن يتكوّن من 15 رقمًا.", "The VAT number must be exactly 15 digits."));
        return;
      }

      startTransition(async () => {
        try {
          await onboardPlatformEgs({ vatNumber: vatNumber.trim(), otp: otp.trim() || undefined });
          toast.success(t("تم الربط بنجاح.", "Connected to ZATCA successfully."));
        } catch (err) {
          const message =
            err instanceof Error
              ? err.message
              : t("تعذّر الربط. حاول مرة أخرى.", "Connection failed. Please try again.");
          setFormError(message);
          toast.error(message);
        }
      });
    },
    [vatNumber, otp, t],
  );

  const onReset = React.useCallback(() => {
    startTransition(async () => {
      try {
        await resetPlatformEgs();
        setResetOpen(false);
        toast.success(t("تم إعادة ضبط جهاز إصدار الفواتير.", "EGS has been reset."));
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : t("تعذّرت إعادة الضبط. حاول مرة أخرى.", "Reset failed. Please try again.");
        toast.error(message);
      }
    });
  }, [t]);

  // ── Clearance-log table columns ───────────────────────────────────────
  const columns = React.useMemo<ColumnDef<ClearanceLog>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: t("التاريخ", "Date"),
        enableSorting: true,
        enableHiding: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">
            {formatDateTime(row.original.createdAt, lang)}
          </span>
        ),
      },
      {
        accessorKey: "outcome",
        header: t("النتيجة", "Outcome"),
        enableSorting: true,
        cell: ({ row }) => {
          const label = ZATCA_CLEARANCE_OUTCOME_LABEL[row.original.outcome];
          const variant = ZATCA_CLEARANCE_OUTCOME_VARIANT[row.original.outcome] ?? "default";
          return (
            <Badge variant={variant} size="sm">
              {label ? t(label.ar, label.en) : row.original.outcome}
            </Badge>
          );
        },
      },
      {
        accessorKey: "icv",
        header: t("العدّاد", "ICV"),
        enableSorting: true,
        meta: { numeric: true },
        cell: ({ row }) => (
          <span dir="ltr" className="font-mono text-xs tabular-nums text-foreground">
            {row.original.icv ?? "—"}
          </span>
        ),
      },
      {
        id: "zatcaCodes",
        header: t("رموز زاتكا", "ZATCA codes"),
        enableSorting: false,
        cell: ({ row }) => {
          const codes = row.original.zatcaCodes ?? [];
          return (
            <span dir="ltr" className="font-mono text-xs text-muted-foreground">
              {codes.length > 0 ? codes.join(", ") : "—"}
            </span>
          );
        },
      },
      {
        accessorKey: "message",
        header: t("الرسالة", "Message"),
        enableSorting: false,
        cell: ({ row }) => (
          <span
            className="block max-w-[280px] truncate text-xs text-muted-foreground"
            title={row.original.message ?? undefined}
          >
            {row.original.message ?? "—"}
          </span>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` is derived from `lang`, which is already a dep.
    [lang],
  );

  return (
    <div
      className="space-y-8 animate-in fade-in duration-500"
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      {/* Back link */}
      <Link
        href="/dashboard/admin"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
      >
        <DirectionalIcon icon={ArrowLeft} className="h-4 w-4" />
        {t("إدارة المنصة", "Platform Administration")}
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <ReceiptText className="h-7 w-7" />
        </div>
        <PageHeader
          className="flex-1"
          title={t("الربط بنظام فاتورة الضريبي", "ZATCA Integration")}
          description={t(
            "اربط جهاز إصدار فواتير المنصة لاعتماد فواتير الاشتراكات لحظيًا مع هيئة الزكاة والضريبة والجمارك.",
            "Connect the platform billing EGS to clear subscription invoices with ZATCA in real time.",
          )}
        />
      </div>

      {/* ─── EGS status / onboarding ─────────────────────────────────────── */}
      {isActive && egs ? (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="h-4 w-4 text-success" aria-hidden="true" />
                {t("جهاز إصدار الفواتير", "Electronic Generation Solution")}
              </CardTitle>
              {(() => {
                const label = ZATCA_EGS_STATUS_LABEL[egs.status];
                const variant = ZATCA_EGS_STATUS_VARIANT[egs.status] ?? "default";
                return (
                  <Badge variant={variant} size="sm">
                    {label ? t(label.ar, label.en) : egs.status}
                  </Badge>
                );
              })()}
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">
                  {t("رقم ضريبة القيمة المضافة", "VAT number")}
                </dt>
                <dd dir="ltr" className="mt-0.5 font-mono text-sm tabular-nums text-foreground">
                  {egs.vatNumber}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  {t("الرقم التسلسلي", "Serial number")}
                </dt>
                <dd dir="ltr" className="mt-0.5 break-all font-mono text-xs text-foreground">
                  {egs.egsSerialNumber}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  {t("البيئة", "Environment")}
                </dt>
                <dd className="mt-0.5 text-sm text-foreground">{egs.environment}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  {t("آخر عدّاد فاتورة", "Last ICV")}
                </dt>
                <dd dir="ltr" className="mt-0.5 font-mono text-sm tabular-nums text-foreground">
                  {egs.lastIcv ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  {t("تاريخ التهيئة", "Onboarded")}
                </dt>
                <dd className="mt-0.5 text-sm text-foreground">
                  {formatDate(egs.onboardedAt, lang)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  {t("الاسم النظامي", "Legal name")}
                </dt>
                <dd className="mt-0.5 text-sm text-foreground">
                  {lang === "ar"
                    ? egs.legalNameAr || egs.legalNameEn
                    : egs.legalNameEn || egs.legalNameAr}
                </dd>
              </div>
            </dl>

            <div className="mt-6 flex justify-end border-t border-border pt-4">
              <Button
                variant="destructive"
                onClick={() => setResetOpen(true)}
                disabled={isPending}
                style={{ display: "inline-flex" }}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                {t("إعادة الضبط", "Reset EGS")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              {t("تهيئة جهاز إصدار الفواتير", "Onboard the billing EGS")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {egs == null ? (
              <div className="mb-6">
                <EmptyState
                  icon={<FileText className="h-12 w-12" aria-hidden="true" />}
                  title={t("لم تتم التهيئة بعد", "Not onboarded yet")}
                  description={t(
                    "هيّئ جهاز إصدار فواتير المنصة مرة واحدة لبدء اعتماد فواتير الاشتراكات مع هيئة الزكاة والضريبة والجمارك.",
                    "Onboard the platform EGS once to start clearing subscription invoices with ZATCA.",
                  )}
                />
              </div>
            ) : (
              <p className="mb-6 rounded-md border border-warning bg-warning/10 px-3 py-2 text-xs text-warning-strong">
                {t(
                  `الحالة الحالية: ${ZATCA_EGS_STATUS_LABEL[egs.status]?.ar ?? egs.status}. أعد التهيئة لتفعيل الجهاز.`,
                  `Current status: ${ZATCA_EGS_STATUS_LABEL[egs.status]?.en ?? egs.status}. Re-onboard to activate the EGS.`,
                )}
              </p>
            )}

            <form onSubmit={onOnboardSubmit} className="space-y-5">
              {/* Seller identity is FIXED (Mimarek PropTech Co.) — shown read-only, never re-asked. */}
              <div className="rounded-md border border-border bg-muted/40 p-4">
                <p className="mb-3 text-xs font-semibold text-foreground">
                  {t("بيانات البائع (المنصة)", "Seller (platform) identity")}
                </p>
                <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-xs sm:grid-cols-2">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">{t("الاسم النظامي", "Legal name")}</dt>
                    <dd className="text-foreground">
                      {lang === "ar" ? PLATFORM_SELLER.legalNameAr : PLATFORM_SELLER.legalNameEn}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">{t("السجل التجاري", "CR")}</dt>
                    <dd dir="ltr" className="font-mono tabular-nums text-foreground">{PLATFORM_SELLER.crNumber}</dd>
                  </div>
                  <div className="flex justify-between gap-2 sm:col-span-2">
                    <dt className="shrink-0 text-muted-foreground">{t("العنوان الوطني", "National address")}</dt>
                    {/* Romanized Latin address — keep LTR so the building number doesn't bidi-scramble in RTL (§6.15.2). */}
                    <dd dir="ltr" className="text-end text-foreground">
                      {`${PLATFORM_SELLER.nationalAddress.buildingNumber} ${PLATFORM_SELLER.nationalAddress.streetName}, ${PLATFORM_SELLER.nationalAddress.district}, ${PLATFORM_SELLER.nationalAddress.city} ${PLATFORM_SELLER.nationalAddress.postalCode}`}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  {t(
                    "بيانات الشركة ثابتة — أدخل رقم ضريبة القيمة المضافة فقط لإتمام الربط.",
                    "Company details are fixed — enter only the VAT number to connect.",
                  )}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* VAT — the only required input */}
                <div className="space-y-1.5">
                  <label htmlFor="zatca-vat" className="block text-xs font-semibold text-foreground">
                    {t("رقم ضريبة القيمة المضافة *", "VAT number *")}
                  </label>
                  <Input
                    id="zatca-vat"
                    dir="ltr"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={15}
                    value={vatNumber}
                    onChange={(e) => setVatNumber(e.target.value.replace(/\D/g, "").slice(0, 15))}
                    aria-invalid={vatNumber.length > 0 && !vatValid}
                    className="font-mono tabular-nums"
                    placeholder="300000000000003"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {t("15 رقمًا — يبدأ وينتهي بـ 3.", "15 digits — starts and ends with 3.")}
                  </p>
                </div>

                {/* OTP — default 123456 (sandbox does not validate it) */}
                <div className="space-y-1.5">
                  <label htmlFor="zatca-otp" className="block text-xs font-semibold text-foreground">
                    {t("رمز التحقق (اختياري)", "OTP (optional)")}
                  </label>
                  <Input
                    id="zatca-otp"
                    dir="ltr"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="font-mono tabular-nums"
                    placeholder="123456"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {t("البيئة التجريبية لا تتحقق من الرمز.", "Sandbox does not validate the OTP.")}
                  </p>
                </div>
              </div>

              {formError && (
                <p className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {formError}
                </p>
              )}

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={isPending || !vatValid}
                  style={{ display: "inline-flex" }}
                  className="gap-2"
                >
                  {isPending ? t("جارٍ الربط…", "Connecting…") : t("الربط بزاتكا", "Connect to ZATCA")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ─── Clearance log ───────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {t("سجل الاعتماد", "Clearance log")}
        </h2>
        <Card className="overflow-hidden">
          {logs.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<ReceiptText className="h-12 w-12" aria-hidden="true" />}
                title={t("لا توجد محاولات اعتماد بعد", "No clearance attempts yet")}
                description={t(
                  "ستظهر هنا كل محاولة اعتماد لفاتورة اشتراك بمجرد إرسالها إلى هيئة الزكاة والضريبة والجمارك.",
                  "Every subscription-invoice clearance attempt appears here once sent to ZATCA.",
                )}
              />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={logs}
              locale={lang === "ar" ? "ar" : "en"}
              pagination
              pageSize={10}
              getRowId={(r) => r.id}
              emptyTitle={t("لا توجد محاولات اعتماد بعد", "No clearance attempts yet")}
              emptyDescription={t(
                "ستظهر هنا كل محاولة اعتماد لفاتورة اشتراك.",
                "Every subscription-invoice clearance attempt appears here.",
              )}
            />
          )}
        </Card>
      </section>

      {/* ─── B2C reporting recovery (Track C) ────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {t("رفع فواتير الأفراد (B2C)", "B2C reporting")}
        </h2>
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Radio className="h-4 w-4 text-primary" aria-hidden="true" />
                {t("حالة الرفع عبر المنصة", "Reporting health (platform-wide)")}
              </CardTitle>
              <Button
                onClick={onRunSweep}
                disabled={isSweeping}
                style={{ display: "inline-flex" }}
                className="gap-2"
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 ${isSweeping ? "animate-spin" : ""}`} aria-hidden="true" />
                {isSweeping ? t("جارٍ الرفع…", "Running…") : t("تشغيل الرفع الآن", "Run sweep now")}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {reportingHealth.stuckOver12h > 0 && (
              <div className="mb-4 flex items-start gap-2 rounded-md border border-warning bg-warning/10 px-3 py-2 text-xs text-warning-strong">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span dir={lang === "ar" ? "rtl" : "ltr"}>
                  {t(
                    `${reportingHealth.stuckOver12h} مستند بقي قيد المعالجة أكثر من 12 ساعة — شغّل الرفع أو راجع سجل الاعتماد.`,
                    `${reportingHealth.stuckOver12h} document(s) pending for over 12 hours — run the sweep or review the clearance log.`,
                  )}
                </span>
              </div>
            )}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
              {(
                [
                  ["cleared", t("معتمدة", "Cleared")],
                  ["reported", t("مُبلّغ عنها", "Reported")],
                  ["pending", t("قيد المعالجة", "Pending")],
                  ["rejected", t("مرفوضة", "Rejected")],
                  ["held", t("بانتظار البيانات", "Held")],
                  ["stuckOver12h", t("عالقة +12س", "Stuck >12h")],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd
                    dir="ltr"
                    className={`mt-0.5 text-2xl font-bold tabular-nums ${
                      key === "rejected" && reportingHealth[key] > 0
                        ? "text-destructive"
                        : key === "stuckOver12h" && reportingHealth[key] > 0
                          ? "text-warning-strong"
                          : "text-foreground"
                    }`}
                  >
                    {reportingHealth[key]}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-[11px] text-muted-foreground">
              {t(
                "المسار (أ) يعتمد فواتير الاشتراكات لحظيًا. مستندات الأفراد (B2C) تُرفع عند الإصدار، وهذا الرفع يعيد إرسال أي مستند تعذّر إرساله.",
                "Track A clears subscription invoices in real time. B2C documents are reported at issuance; this sweep re-submits any that failed to send.",
              )}
            </p>
          </CardContent>
        </Card>
      </section>

      {/* ─── Reset confirmation dialog ───────────────────────────────────── */}
      <ResponsiveDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title={t("إعادة ضبط جهاز إصدار الفواتير", "Reset the EGS")}
        description={t(
          "سيتم إبطال الشهادة الحالية ومسح بيانات الاعتماد. يلزم تهيئة جديدة لإصدار شهادة وزوج مفاتيح جديدين.",
          "This revokes the current certificate and wipes its credentials. A fresh onboarding is required to issue a new certificate and keypair.",
        )}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setResetOpen(false)}
              disabled={isPending}
              style={{ display: "inline-flex" }}
            >
              {t("إلغاء", "Cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={onReset}
              disabled={isPending}
              style={{ display: "inline-flex" }}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              {isPending ? t("جارٍ إعادة الضبط…", "Resetting…") : t("إعادة الضبط", "Reset EGS")}
            </Button>
          </div>
        }
      >
        <p className="py-2 text-sm text-muted-foreground">
          {t(
            "هذا الإجراء لا يمكن التراجع عنه.",
            "This action cannot be undone.",
          )}
        </p>
      </ResponsiveDialog>
    </div>
  );
}
