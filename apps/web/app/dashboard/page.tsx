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
} from "@repo/ui";
import { useRouter } from "next/navigation";
import { useLanguage } from "../../components/LanguageProvider";
import { useSession } from "../../components/SimpleSessionProvider";
import { isSystemRole } from "../../lib/permissions";
import {
  getDashboardV3Stats,
  getDashboardRecentDeals,
  getDashboardUpcomingPayments,
  getDashboardMaintenanceSummary,
} from "../actions/dashboard";
import { getOccupancyTrend } from "../actions/trends/getOccupancyTrend";
import { getPipelineTrend } from "../actions/trends/getPipelineTrend";
import { getCollectionsTrend } from "../actions/trends/getCollectionsTrend";
import { getTicketsTrend } from "../actions/trends/getTicketsTrend";

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
  contract: {
    customer: { id: string; name: string };
    unit: { id: string; number: string };
  };
};

type MaintenanceSummaryItem = { status: string; count: number };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusBadge(status: string, lang: "ar" | "en") {
  const map: Record<string, { label: { ar: string; en: string }; cls: string }> = {
    PENDING:   { label: { ar: "معلق", en: "Pending" },     cls: "bg-warning/15 text-warning" },
    CONFIRMED: { label: { ar: "مؤكد", en: "Confirmed" },   cls: "bg-info/15 text-info" },
    SIGNED:    { label: { ar: "موقع", en: "Signed" },      cls: "bg-success/15 text-success" },
    CANCELLED: { label: { ar: "ملغى", en: "Cancelled" },   cls: "bg-destructive/15 text-destructive" },
  };
  const entry = map[status] ?? { label: { ar: status, en: status }, cls: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${entry.cls}`}>
      {entry.label[lang]}
    </span>
  );
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
  return d.toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { lang } = useLanguage();
  const { data: session } = useSession();
  const router = useRouter();

  React.useEffect(() => {
    if (!session) return;
    const role = session.user?.role ?? "";
    if (isSystemRole(role)) {
      router.replace("/dashboard/admin");
      return;
    }
    const roleRoute: Record<string, string> = {
      LEASING: "/dashboard/leasing",
      AGENT: "/dashboard/leasing",
      FINANCE: "/dashboard/finance",
      TECHNICIAN: "/dashboard/maintenance",
    };
    const target = roleRoute[role];
    if (target) router.replace(target);
  }, [session, router]);

  const [stats, setStats] = React.useState<V3Stats | null>(null);
  const [deals, setDeals] = React.useState<Deal[]>([]);
  const [payments, setPayments] = React.useState<Installment[]>([]);
  const [maintenance, setMaintenance] = React.useState<MaintenanceSummaryItem[]>([]);
  const [trends, setTrends] = React.useState<{
    units: number[];
    pipeline: number[];
    collections: number[];
    tickets: number[];
  }>({ units: [], pipeline: [], collections: [], tickets: [] });
  const [lastLoaded, setLastLoaded] = React.useState<Date>(new Date());
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const [s, d, p, m, tu, tp, tc, tt] = await Promise.all([
        getDashboardV3Stats(),
        getDashboardRecentDeals(),
        getDashboardUpcomingPayments(),
        getDashboardMaintenanceSummary(),
        getOccupancyTrend(),
        getPipelineTrend(),
        getCollectionsTrend(),
        getTicketsTrend(),
      ]);
      setStats(s);
      setDeals(d);
      setPayments(p);
      setMaintenance(m);
      setTrends({ units: tu, pipeline: tp, collections: tc, tickets: tt });
      setLastLoaded(new Date());
    } catch {
      setError(lang === "ar" ? "فشل تحميل بيانات لوحة المعلومات. يرجى المحاولة مرة أخرى." : "Failed to load dashboard data. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadDashboard();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatNumber = (n: number) => n.toLocaleString("en-US");
  const userName = session?.user?.name ?? (lang === "ar" ? "مستخدم" : "User");
  const firstName = userName.split(" ")[0] ?? userName;

  const hour = new Date().getHours();
  const greeting =
    lang === "ar"
      ? hour < 12 ? "صباح الخير" : "مساء الخير"
      : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const todayLabel = new Date().toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", {
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
    <>
      {/* ─── Mobile (< md) ───────────────────────────────────────── */}
      <div className="md:hidden -m-4 sm:-m-6 min-h-dvh flex flex-col bg-background">
        <AppBar
          title={lang === "ar" ? "الرئيسية" : "Dashboard"}
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

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
              <p className="flex-1 text-sm text-destructive">
                {error}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={loadDashboard}
                style={{ display: "inline-flex" }}
              >
                {lang === "ar" ? "إعادة المحاولة" : "Retry"}
              </Button>
            </div>
          )}

          {/* KPIs — 2×2 with sparklines */}
          <div className="grid grid-cols-2 gap-3">
            <MobileKPICard
              label={lang === "ar" ? "إجمالي الوحدات" : "Total Units"}
              value={loading ? "—" : formatNumber(stats?.totalProperties ?? 0)}
              icon={Building2}
              tone="primary"
              sparkline={trends.units.slice(-12)}
              href="/dashboard/units"
            />
            <MobileKPICard
              label={lang === "ar" ? "الصفقات النشطة" : "Active Deals"}
              value={loading ? "—" : formatNumber(stats?.activeDeals ?? 0)}
              icon={Handshake}
              tone="blue"
              sparkline={trends.pipeline.slice(-12)}
              href="/dashboard/deals"
            />
            <MobileKPICard
              label={lang === "ar" ? "العقود الموقعة" : "Signed Contracts"}
              value={loading ? "—" : formatNumber(stats?.signedContracts ?? 0)}
              icon={FileText}
              tone="green"
              sparkline={trends.collections.slice(-12)}
              href="/dashboard/contracts"
            />
            <MobileKPICard
              label={lang === "ar" ? "المدفوعات المعلقة" : "Pending Payments"}
              value={loading ? "—" : formatNumber(stats?.pendingPayments ?? 0)}
              icon={CreditCard}
              tone={stats && stats.pendingPayments > 0 ? "amber" : "default"}
              sparkline={trends.tickets.slice(-12)}
              href="/dashboard/finance"
            />
          </div>

          {/* Today's Priorities */}
          <div className="rounded-2xl bg-card border border-border p-4">
            <h2 className="mb-2 text-sm font-semibold text-foreground">
              {lang === "ar" ? "أولويات اليوم" : "Today's Priorities"}
            </h2>

            {loading ? (
              <div className="space-y-2 py-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-12 animate-pulse rounded bg-muted"
                  />
                ))}
              </div>
            ) : (
              <div className="-mb-3">
                {pendingDeals > 0 && (
                  <DataCard
                    icon={Handshake}
                    iconTone="blue"
                    title={
                      lang === "ar" ? "حجوزات بانتظار التأكيد" : "Deals pending approval"
                    }
                    subtitle={
                      lang === "ar"
                        ? `${formatNumber(pendingDeals)} حجز يحتاج مراجعة`
                        : `${formatNumber(pendingDeals)} reservations need review`
                    }
                    trailing={
                      <span className="font-semibold text-foreground">
                        {formatNumber(pendingDeals)}
                      </span>
                    }
                    href="/dashboard/deals"
                  />
                )}

                {upcomingPaymentsCount > 0 && (
                  <DataCard
                    icon={Clock}
                    iconTone={
                      stats && stats.pendingPayments > 0 ? "amber" : "default"
                    }
                    title={
                      lang === "ar"
                        ? "أقساط مستحقة قريباً"
                        : "Upcoming payments due"
                    }
                    subtitle={
                      nextPayment
                        ? [
                            nextPayment.contract.customer.name,
                            formatDueDate(nextPayment.dueDate, lang),
                          ]
                        : lang === "ar"
                        ? `${formatNumber(upcomingPaymentsCount)} قسط قادم`
                        : `${formatNumber(upcomingPaymentsCount)} installments`
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

                {stats && stats.pendingPayments > 0 && (
                  <DataCard
                    icon={AlertTriangle}
                    iconTone="red"
                    title={lang === "ar" ? "مدفوعات متأخرة" : "Overdue payments"}
                    subtitle={
                      lang === "ar"
                        ? `${formatNumber(stats.pendingPayments)} قسط متأخر غير مسدد`
                        : `${formatNumber(stats.pendingPayments)} overdue unpaid installments`
                    }
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
                    title={
                      lang === "ar"
                        ? "طلبات صيانة مفتوحة"
                        : "Open maintenance requests"
                    }
                    subtitle={
                      lang === "ar"
                        ? `${formatNumber(openMaintenanceCount)} جديد · ${formatNumber(inProgressMaintenanceCount)} قيد التنفيذ`
                        : `${formatNumber(openMaintenanceCount)} new · ${formatNumber(inProgressMaintenanceCount)} in progress`
                    }
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

                {stats &&
                  stats.monthlyRevenue > 0 && (
                    <DataCard
                      icon={TrendingUp}
                      iconTone="green"
                      title={
                        lang === "ar"
                          ? "الإيرادات هذا الشهر"
                          : "Revenue this month"
                      }
                      subtitle={
                        lang === "ar"
                          ? "المدفوعات المحصلة"
                          : "Collected payments"
                      }
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
                  (!stats || stats.pendingPayments === 0) &&
                  openMaintenanceCount + inProgressMaintenanceCount === 0 && (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      {lang === "ar"
                        ? "لا توجد أولويات لهذا اليوم"
                        : "No priorities for today"}
                    </p>
                  )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Desktop (md+) ───────────────────────────────────────── */}
      <div className="hidden md:block space-y-8">
      {/* Greeting + toolbar */}
      <div className="glass rounded-xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {greeting}، {userName}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {new Date().toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DateRangePicker locale={lang} />
          <LastUpdatedAgo
            timestamp={lastLoaded}
            locale={lang}
            onRefresh={loadDashboard}
          />
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/10">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <p className="text-sm text-destructive flex-1">{error}</p>
          <Button variant="outline" size="sm" onClick={loadDashboard} style={{ display: "inline-flex" }}>
            {lang === "ar" ? "إعادة المحاولة" : "Retry"}
          </Button>
        </div>
      )}

      {/* KPIs — hero + 3 standards + 2 utility per § 6.9.1 North Star rule */}
      <div className="space-y-4">
        <KPICard
          tier="hero"
          label={lang === "ar" ? "الإيرادات الشهرية" : "Monthly Revenue"}
          value={
            loading ? (
              "—"
            ) : (
              <SARAmount value={stats?.monthlyRevenue ?? 0} compact size={20} />
            )
          }
          subtitle={
            lang === "ar"
              ? "المدفوعات المحصلة هذا الشهر"
              : "Payments collected this month"
          }
          secondaryInsight={
            !loading && stats
              ? lang === "ar"
                ? `${formatNumber(stats.signedContracts)} عقد موقّع · ${formatNumber(stats.totalProperties)} وحدة بالمحفظة`
                : `${formatNumber(stats.signedContracts)} signed contracts · ${formatNumber(stats.totalProperties)} units in portfolio`
              : undefined
          }
          icon={<TrendingUp className="h-[18px] w-[18px]" />}
          accent="secondary"
          comparisonPeriod={lang === "ar" ? "هذا الشهر" : "this month"}
          trend={trends.collections.slice(-12)}
          href="/dashboard/finance"
          lastUpdated={lastLoaded}
          locale={lang}
          loading={loading}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <KPICard
            label={lang === "ar" ? "الصفقات النشطة" : "Active Deals"}
            value={loading ? "—" : formatNumber(stats?.activeDeals ?? 0)}
            subtitle={
              lang === "ar"
                ? "حجوزات معلقة أو مؤكدة"
                : "Pending or confirmed reservations"
            }
            icon={<Handshake className="h-[18px] w-[18px]" />}
            accent="info"
            trend={trends.pipeline.slice(-12)}
            href="/dashboard/deals"
            lastUpdated={lastLoaded}
            locale={lang}
            loading={loading}
          />
          <KPICard
            label={lang === "ar" ? "العقود الموقعة" : "Signed Contracts"}
            value={loading ? "—" : formatNumber(stats?.signedContracts ?? 0)}
            subtitle={
              lang === "ar" ? "عقود مكتملة الإجراءات" : "Fully executed contracts"
            }
            icon={<FileText className="h-[18px] w-[18px]" />}
            accent="success"
            href="/dashboard/contracts"
            lastUpdated={lastLoaded}
            locale={lang}
            loading={loading}
          />
          <KPICard
            label={lang === "ar" ? "المدفوعات المعلقة" : "Pending Payments"}
            value={loading ? "—" : formatNumber(stats?.pendingPayments ?? 0)}
            subtitle={
              lang === "ar"
                ? "أقساط متأخرة غير مسددة"
                : "Overdue installments unpaid"
            }
            icon={<CreditCard className="h-[18px] w-[18px]" />}
            accent={
              stats && stats.pendingPayments > 0 ? "warning" : "primary"
            }
            href="/dashboard/finance"
            lastUpdated={lastLoaded}
            locale={lang}
            loading={loading}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <KPICard
            tier="utility"
            label={lang === "ar" ? "إجمالي الوحدات" : "Total Properties"}
            value={loading ? "—" : formatNumber(stats?.totalProperties ?? 0)}
            icon={<Building2 className="h-[18px] w-[18px]" />}
            accent="primary"
            href="/dashboard/units"
            locale={lang}
            loading={loading}
          />
          <KPICard
            tier="utility"
            label={lang === "ar" ? "طلبات الصيانة" : "Open Maintenance"}
            value={loading ? "—" : formatNumber(stats?.openMaintenance ?? 0)}
            icon={<Wrench className="h-[18px] w-[18px]" />}
            accent={
              stats && stats.openMaintenance > 10 ? "warning" : "info"
            }
            href="/dashboard/maintenance"
            locale={lang}
            loading={loading}
          />
        </div>
      </div>

      {/* Activity Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Deals */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Handshake className="h-4 w-4 text-muted-foreground" />
              {lang === "ar" ? "آخر الصفقات" : "Recent Deals"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : deals.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                {lang === "ar" ? "لا توجد صفقات حتى الآن" : "No deals yet"}
              </p>
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
                          {lang === "ar" ? "وحدة" : "Unit"} {deal.unit.number}
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
              {lang === "ar" ? "مواعيد الأقساط القادمة" : "Upcoming Payment Deadlines"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : payments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                {lang === "ar" ? "لا توجد أقساط قادمة" : "No upcoming payments"}
              </p>
            ) : (
              <div className="divide-y divide-border">
                {payments.map((inst) => (
                  <div key={inst.id} className="flex items-center justify-between py-3 gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-card-foreground truncate">
                        {inst.contract.customer.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground font-latin">
                        {lang === "ar" ? "وحدة" : "Unit"} {inst.contract.unit.number}
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
              {lang === "ar" ? "حالة الصيانة" : "Maintenance Status"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : maintenance.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                {lang === "ar" ? "لا توجد طلبات صيانة" : "No maintenance requests"}
              </p>
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
    </>
  );
}
