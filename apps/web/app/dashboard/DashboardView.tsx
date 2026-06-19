"use client";

import * as React from "react";
import {
  Building2,
  TrendingUp,
  FileText,
  Wrench,
  AlertTriangle,
  Handshake,
  CreditCard,
  Calendar,
  User,
  CheckCircle,
  Clock,
  Circle,
} from "lucide-react";
import {
  KPICard,
  SARAmount,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  AppBar,
  MobileKPICard,
  DataCard,
  DateRangePicker,
  LastUpdatedAgo,
  EmptyState,
  RoleTaskQueue,
  Badge,
} from "@repo/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "../../components/LanguageProvider";
import { useDateRangeQuery } from "../../lib/use-date-range-query";
import { useMounted } from "../../lib/use-mounted";
import type { RoleTaskQueueResult } from "../actions/role-task-queue";

// ─── Types ────────────────────────────────────────────────────────────────────

type V3Stats = {
  totalProperties: number;
  activeDeals: number;
  signedContracts: number;
  pendingPayments: number;
  openMaintenance: number;
  monthlyRevenue: number;
};

type Deal = {
  id: string;
  status: string;
  customer: { id: string; name: string };
  unit: { id: string; number: string };
  createdAt: string;
};

type Installment = {
  id: string;
  dueDate: string;
  amount: number;
  status: string;
  paymentPlan: {
    contract: {
      customer: { id: string; name: string };
      unit: { id: string; number: string };
    };
  };
};

type MaintenanceSummaryItem = { status: string; count: number };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusBadge(status: string, lang: "ar" | "en") {
  const map: Record<string, { label: { ar: string; en: string }; variant: "warning" | "info" | "success" | "error" | "default" }> = {
    PENDING:   { label: { ar: "معلق", en: "Pending" },     variant: "warning" },
    CONFIRMED: { label: { ar: "مؤكد", en: "Confirmed" },   variant: "info" },
    SIGNED:    { label: { ar: "موقع", en: "Signed" },      variant: "success" },
    CANCELLED: { label: { ar: "ملغى", en: "Cancelled" },   variant: "error" },
  };
  const entry = map[status] ?? { label: { ar: status, en: status }, variant: "default" as const };
  return <Badge variant={entry.variant} size="sm">{entry.label[lang]}</Badge>;
}

function maintenanceStatusIcon(status: string) {
  if (status === "RESOLVED" || status === "CLOSED" || status === "COMPLETED")
    return <CheckCircle className="h-4 w-4 text-success" />;
  if (status === "IN_PROGRESS" || status === "ASSIGNED")
    return <Clock className="h-4 w-4 text-info" />;
  return <Circle className="h-4 w-4 text-warning" />;
}

function maintenanceStatusLabel(status: string, lang: "ar" | "en"): string {
  const map: Record<string, { ar: string; en: string }> = {
    OPEN:        { ar: "بانتظار المراجعة", en: "Waiting Review" },
    ASSIGNED:    { ar: "مُعيّن",       en: "Assigned" },
    IN_PROGRESS: { ar: "قيد التنفيذ", en: "In Progress" },
    ON_HOLD:     { ar: "معلّق",        en: "On Hold" },
    RESOLVED:    { ar: "تم الحل",      en: "Resolved" },
    CLOSED:      { ar: "مغلق",         en: "Closed" },
    COMPLETED:   { ar: "مكتمل",        en: "Completed" },
    CANCELLED:   { ar: "ملغى",         en: "Cancelled" },
  };
  return map[status]?.[lang] ?? status;
}

function formatRelativeDate(dateStr: string, lang: "ar" | "en"): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return lang === "ar" ? "اليوم" : "Today";
  if (days === 1) return lang === "ar" ? "أمس" : "Yesterday";
  if (days < 30) return lang === "ar" ? `منذ ${days} يوم` : `${days} days ago`;
  const months = Math.floor(days / 30);
  return lang === "ar" ? `منذ ${months} شهر` : `${months}mo ago`;
}

function formatDueDate(dateStr: string, lang: "ar" | "en"): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardView({
  stats,
  deals,
  payments,
  maintenance,
  trends,
  taskQueue,
  userName,
  loadedAt,
}: {
  stats: V3Stats;
  deals: Deal[];
  payments: Installment[];
  maintenance: MaintenanceSummaryItem[];
  trends: {
    units: number[];
    pipeline: number[];
    collections: number[];
    tickets: number[];
  };
  taskQueue: RoleTaskQueueResult;
  userName: string;
  loadedAt: string;
}) {
  const { lang, t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { range, setRange } = useDateRangeQuery();
  const [isPending, startTransition] = React.useTransition();

  const lastLoaded = React.useMemo(() => new Date(loadedAt), [loadedAt]);

  // Date change → push URL → the Server Component re-renders with new data.
  const onRangeChange = React.useCallback(
    (next: { from: Date | undefined; to: Date | undefined }) => {
      startTransition(() => setRange(next));
    },
    [setRange],
  );

  // Manual refresh → re-run the server render (same URL/params), fresh data.
  const onRefresh = React.useCallback(() => {
    startTransition(() => router.refresh());
  }, [router]);

  // The range scopes only the period (flow) metric — Monthly Revenue. When a
  // custom range is active the KPI label reflects it (no silent half-filter);
  // all other tiles are current-state stock metrics.
  const hasCustomRange = searchParams.has("from") && searchParams.has("to");
  const periodLabel = React.useMemo(() => {
    if (!hasCustomRange || !range.from || !range.to) {
      return t("هذا الشهر", "this month");
    }
    const fmtDate = new Intl.DateTimeFormat(lang === "ar" ? "ar-SA-u-nu-latn" : "en-GB", {
      month: "short",
      day: "numeric",
    });
    return `${fmtDate.format(range.from)} – ${fmtDate.format(range.to)}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` is derived from `lang`, which is already a dep; listing `lang` covers every translation read here.
  }, [hasCustomRange, range.from, range.to, lang]);

  const formatNumber = (n: number) => n.toLocaleString("en-US");
  const firstName = (userName || t("مستخدم", "User")).split(" ")[0] ?? t("مستخدم", "User");

  // `new Date().getHours()` is computed at render, so the server's wall-clock
  // hour can land in a different greeting bucket than the client's → hydration
  // mismatch. Gate it behind `useMounted`: render a neutral, hour-independent
  // greeting on the server + first client render, then refine after mount.
  const mounted = useMounted();
  const hour = new Date().getHours();
  const greeting = !mounted
    ? t("أهلاً", "Welcome")
    : lang === "ar"
      ? hour < 12 ? "صباح الخير" : "مساء الخير"
      : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const todayLabel = new Date().toLocaleDateString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // ─── Mobile Priorities (derived from existing data) ──────────────────────
  const pendingDeals = deals.filter((d) => d.status === "PENDING").length;
  const openMaintenanceCount =
    maintenance.find((m) => m.status === "OPEN")?.count ?? 0;
  const inProgressMaintenanceCount =
    maintenance.find((m) => m.status === "IN_PROGRESS")?.count ?? 0;
  const upcomingPaymentsCount = payments.length;
  const nextPayment = payments[0];

  return (
    <div className={`transition-opacity ${isPending ? "opacity-60" : ""}`}>
      {/* ─── Mobile (< md) ───────────────────────────────────────── */}
      <div className="md:hidden -m-4 sm:-m-6 min-h-dvh flex flex-col bg-background">
        <AppBar
          title={t("الرئيسية", "Dashboard")}
          lang={lang}
        />

        <div className="flex-1 px-4 py-4 space-y-4">
          {/* Welcome hero */}
          <div className="rounded-2xl bg-card border border-border p-4">
            <h1 className="text-lg font-bold text-foreground tracking-tight">
              {greeting}، {firstName}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">{todayLabel}</p>
          </div>

          {/* KPIs — 2×2 with sparklines */}
          <div className="grid grid-cols-2 gap-3">
            <MobileKPICard
              label={t("إجمالي الوحدات", "Total Units")}
              value={formatNumber(stats.totalProperties)}
              icon={Building2}
              tone="primary"
              sparkline={trends.units.slice(-12)}
              href="/dashboard/units"
            />
            <MobileKPICard
              label={t("الحجوزات النشطة", "Active Reservations")}
              value={formatNumber(stats.activeDeals)}
              icon={Handshake}
              tone="blue"
              sparkline={trends.pipeline.slice(-12)}
              href="/dashboard/reservations"
            />
            <MobileKPICard
              label={t("العقود الموقعة", "Signed Contracts")}
              value={formatNumber(stats.signedContracts)}
              icon={FileText}
              tone="green"
              sparkline={trends.collections.slice(-12)}
              href="/dashboard/contracts"
            />
            <MobileKPICard
              label={t("المدفوعات المعلقة", "Pending Payments")}
              value={formatNumber(stats.pendingPayments)}
              icon={CreditCard}
              tone={stats.pendingPayments > 0 ? "amber" : "default"}
              sparkline={trends.tickets.slice(-12)}
              href="/dashboard/finance"
            />
          </div>

          {/* Today's Priorities */}
          <div className="rounded-2xl bg-card border border-border p-4">
            <h2 className="mb-2 text-sm font-semibold text-foreground">
              {t("أولويات اليوم", "Today's Priorities")}
            </h2>

            <div className="-mb-3">
              {pendingDeals > 0 && (
                <DataCard
                  icon={Handshake}
                  iconTone="blue"
                  title={t("حجوزات بانتظار التأكيد", "Reservations pending approval")}
                  subtitle={t(
                    `${formatNumber(pendingDeals)} حجز يحتاج مراجعة`,
                    `${formatNumber(pendingDeals)} reservations need review`,
                  )}
                  trailing={
                    <span className="font-semibold text-foreground">
                      {formatNumber(pendingDeals)}
                    </span>
                  }
                  href="/dashboard/reservations"
                />
              )}

              {upcomingPaymentsCount > 0 && (
                <DataCard
                  icon={Clock}
                  iconTone={
                    stats.pendingPayments > 0 ? "amber" : "default"
                  }
                  title={t("أقساط مستحقة قريباً", "Upcoming payments due")}
                  subtitle={
                    nextPayment
                      ? [
                          nextPayment.paymentPlan.contract.customer.name,
                          formatDueDate(nextPayment.dueDate, lang),
                        ]
                      : t(
                          `${formatNumber(upcomingPaymentsCount)} قسط قادم`,
                          `${formatNumber(upcomingPaymentsCount)} installments`,
                        )
                  }
                  trailing={
                    nextPayment ? (
                      <SARAmount
                        value={nextPayment.amount}
                        compact
                        size={13}
                      />
                    ) : null
                  }
                  href="/dashboard/finance"
                />
              )}

              {stats.pendingPayments > 0 && (
                <DataCard
                  icon={AlertTriangle}
                  iconTone="red"
                  title={t("مدفوعات متأخرة", "Overdue payments")}
                  subtitle={t(
                    `${formatNumber(stats.pendingPayments)} قسط متأخر غير مسدد`,
                    `${formatNumber(stats.pendingPayments)} overdue unpaid installments`,
                  )}
                  trailing={
                    <span className="font-semibold text-foreground">
                      {formatNumber(stats.pendingPayments)}
                    </span>
                  }
                  href="/dashboard/finance"
                />
              )}

              {openMaintenanceCount + inProgressMaintenanceCount > 0 && (
                <DataCard
                  icon={Wrench}
                  iconTone={
                    openMaintenanceCount + inProgressMaintenanceCount > 10
                      ? "amber"
                      : "blue"
                  }
                  title={t("طلبات صيانة مفتوحة", "Open maintenance requests")}
                  subtitle={t(
                    `${formatNumber(openMaintenanceCount)} جديد · ${formatNumber(inProgressMaintenanceCount)} قيد التنفيذ`,
                    `${formatNumber(openMaintenanceCount)} new · ${formatNumber(inProgressMaintenanceCount)} in progress`,
                  )}
                  trailing={
                    <span className="font-semibold text-foreground">
                      {formatNumber(
                        openMaintenanceCount + inProgressMaintenanceCount,
                      )}
                    </span>
                  }
                  href="/dashboard/maintenance"
                />
              )}

              {stats.monthlyRevenue > 0 && (
                <DataCard
                  icon={TrendingUp}
                  iconTone="green"
                  title={t("الإيرادات", "Revenue")}
                  subtitle={t(
                    `المدفوعات المحصلة · ${periodLabel}`,
                    `Collected payments · ${periodLabel}`,
                  )}
                  trailing={
                    <SARAmount
                      value={stats.monthlyRevenue}
                      compact
                      size={13}
                    />
                  }
                  href="/dashboard/finance"
                />
              )}

              {pendingDeals === 0 &&
                upcomingPaymentsCount === 0 &&
                stats.pendingPayments === 0 &&
                openMaintenanceCount + inProgressMaintenanceCount === 0 && (
                  <EmptyState
                    compact
                    title={t(
                      "لا توجد أولويات لهذا اليوم",
                      "No priorities for today",
                    )}
                    description={t(
                      "يومك هادئ — استمتع بوقتك.",
                      "Your day looks clear — enjoy it.",
                    )}
                  />
                )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Desktop (md+) ───────────────────────────────────────── */}
      <div className="hidden md:block space-y-8">
        {/* Greeting + toolbar */}
        <div className="rounded-lg border border-border bg-card card-quiet p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {greeting}، {userName || t("مستخدم", "User")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {new Date().toLocaleDateString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <DateRangePicker value={range} onChange={onRangeChange} locale={lang} />
            <LastUpdatedAgo
              timestamp={lastLoaded}
              locale={lang}
              onRefresh={onRefresh}
            />
          </div>
        </div>

        {/* KPIs — hero + 3 standards + 2 utility per § 6.9.1 North Star rule */}
        <div className="space-y-4">
          <KPICard
            tier="hero"
            label={t("الإيرادات", "Revenue")}
            value={<SARAmount value={stats.monthlyRevenue} compact size={20} />}
            subtitle={t(
              `المدفوعات المحصلة · ${periodLabel}`,
              `Payments collected · ${periodLabel}`,
            )}
            secondaryInsight={t(
              `${formatNumber(stats.signedContracts)} عقد موقّع · ${formatNumber(stats.totalProperties)} وحدة بالمحفظة`,
              `${formatNumber(stats.signedContracts)} signed contracts · ${formatNumber(stats.totalProperties)} units in portfolio`,
            )}
            icon={<TrendingUp className="h-[18px] w-[18px]" />}
            accent="secondary"
            comparisonPeriod={periodLabel}
            trend={trends.collections.slice(-12)}
            href="/dashboard/finance"
            lastUpdated={lastLoaded}
            locale={lang}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <KPICard
              label={t("الحجوزات النشطة", "Active Reservations")}
              value={formatNumber(stats.activeDeals)}
              subtitle={t(
                "حجوزات معلقة أو مؤكدة",
                "Pending or confirmed reservations",
              )}
              icon={<Handshake className="h-[18px] w-[18px]" />}
              accent="info"
              trend={trends.pipeline.slice(-12)}
              href="/dashboard/reservations"
              lastUpdated={lastLoaded}
              locale={lang}
            />
            <KPICard
              label={t("العقود الموقعة", "Signed Contracts")}
              value={formatNumber(stats.signedContracts)}
              subtitle={t("عقود مكتملة الإجراءات", "Fully executed contracts")}
              icon={<FileText className="h-[18px] w-[18px]" />}
              accent="success"
              href="/dashboard/contracts"
              lastUpdated={lastLoaded}
              locale={lang}
            />
            <KPICard
              label={t("المدفوعات المعلقة", "Pending Payments")}
              value={formatNumber(stats.pendingPayments)}
              subtitle={t(
                "أقساط متأخرة غير مسددة",
                "Overdue installments unpaid",
              )}
              icon={<CreditCard className="h-[18px] w-[18px]" />}
              accent={stats.pendingPayments > 0 ? "warning" : "primary"}
              href="/dashboard/finance"
              lastUpdated={lastLoaded}
              locale={lang}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <KPICard
              tier="utility"
              label={t("إجمالي الوحدات", "Total Properties")}
              value={formatNumber(stats.totalProperties)}
              icon={<Building2 className="h-[18px] w-[18px]" />}
              accent="primary"
              href="/dashboard/units"
              locale={lang}
            />
            <KPICard
              tier="utility"
              label={t("طلبات الصيانة", "Open Maintenance")}
              value={formatNumber(stats.openMaintenance)}
              icon={<Wrench className="h-[18px] w-[18px]" />}
              accent={stats.openMaintenance > 10 ? "warning" : "info"}
              href="/dashboard/maintenance"
              locale={lang}
            />
          </div>
        </div>

        {/* Task Queue */}
        <RoleTaskQueue
          items={taskQueue?.owner ?? []}
          lang={lang}
          heading={{ ar: "المهام العاجلة", en: "Pending Actions" }}
        />

        {/* Activity Widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Deals */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Handshake className="h-4 w-4 text-muted-foreground" />
                {t("آخر الحجوزات", "Recent Reservations")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {deals.length === 0 ? (
                <EmptyState
                  compact
                  variant="first-time"
                  icon={<Handshake className="h-8 w-8" />}
                  title={t("لا توجد حجوزات بعد", "No reservations yet")}
                  description={t(
                    "ستظهر آخر الحجوزات هنا بمجرد إنشائها.",
                    "Recent reservations show up here once created.",
                  )}
                  action={
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push("/dashboard/reservations")}
                      style={{ display: "inline-flex" }}
                    >
                      {t("فتح الحجوزات", "Open reservations")}
                    </Button>
                  }
                />
              ) : (
                <div className="divide-y divide-border">
                  {deals.map((deal) => (
                    <div key={deal.id} className="flex items-center justify-between py-3 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-card-foreground truncate">
                            {deal.customer.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground font-latin">
                            {t("وحدة", "Unit")} {deal.unit.number}
                            {" · "}
                            {formatRelativeDate(deal.createdAt, lang)}
                          </p>
                        </div>
                      </div>
                      {statusBadge(deal.status, lang)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Payment Deadlines */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {t("مواعيد الأقساط القادمة", "Upcoming Payment Deadlines")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <EmptyState
                  compact
                  icon={<Calendar className="h-8 w-8" />}
                  title={t("لا توجد أقساط قادمة", "No upcoming payments")}
                  description={t(
                    "سنُنبّهك هنا عند اقتراب أي موعد استحقاق.",
                    "We'll surface upcoming due dates here.",
                  )}
                />
              ) : (
                <div className="divide-y divide-border">
                  {payments.map((inst) => (
                    <div key={inst.id} className="flex items-center justify-between py-3 gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-card-foreground truncate">
                          {inst.paymentPlan.contract.customer.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground font-latin">
                          {t("وحدة", "Unit")} {inst.paymentPlan.contract.unit.number}
                          {" · "}
                          {formatDueDate(inst.dueDate, lang)}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-card-foreground number-ltr shrink-0">
                        <SARAmount value={inst.amount} compact size={13} />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Maintenance Status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Wrench className="h-4 w-4 text-muted-foreground" />
                {t("حالة الصيانة", "Maintenance Status")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {maintenance.length === 0 ? (
                <EmptyState
                  compact
                  icon={<Wrench className="h-8 w-8" />}
                  title={t("لا توجد طلبات صيانة", "No maintenance requests")}
                  description={t(
                    "كل الأصول تعمل بسلاسة — ستظهر الطلبات الجديدة هنا.",
                    "All assets look healthy — new requests show up here.",
                  )}
                />
              ) : (
                <div className="space-y-3">
                  {maintenance.map((item) => (
                    <div key={item.status} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {maintenanceStatusIcon(item.status)}
                        <span className="text-sm text-card-foreground">
                          {maintenanceStatusLabel(item.status, lang)}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-card-foreground number-ltr">
                        {formatNumber(item.count)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
