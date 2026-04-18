"use client";

import * as React from "react";
import {
  ClipboardList,
  FileSignature,
  Users,
  CalendarClock,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import {
  KPICard,
  SARAmount,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  DateRangePicker,
  LastUpdatedAgo,
  ChartContainer,
  EmptyState,
  type ChartConfig,
} from "@repo/ui";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useLanguage } from "../../../components/LanguageProvider";
import {
  getLeasingStats,
  type LeasingStats,
} from "../../actions/dashboard-leasing";
import { getPipelineTrend } from "../../actions/trends/getPipelineTrend";

const STAGE_LABELS: Record<string, { ar: string; en: string }> = {
  PENDING:   { ar: "معلقة",    en: "Pending" },
  CONFIRMED: { ar: "مؤكدة",    en: "Confirmed" },
  SIGNED:    { ar: "موقعة",    en: "Signed" },
  CANCELLED: { ar: "ملغاة",    en: "Cancelled" },
  EXPIRED:   { ar: "منتهية",   en: "Expired" },
};

const STAGE_COLORS: Record<string, string> = {
  PENDING:   "hsl(var(--chart-3))",
  CONFIRMED: "hsl(var(--chart-1))",
  SIGNED:    "hsl(var(--chart-2))",
  CANCELLED: "hsl(var(--destructive))",
  EXPIRED:   "hsl(var(--muted-foreground))",
};

export default function LeasingDashboardPage() {
  const { lang } = useLanguage();
  const [stats, setStats] = React.useState<LeasingStats | null>(null);
  const [pipelineTrend, setPipelineTrend] = React.useState<number[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [lastLoaded, setLastLoaded] = React.useState<Date>(new Date());

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, t] = await Promise.all([getLeasingStats(), getPipelineTrend()]);
      setStats(s);
      setPipelineTrend(t);
      setLastLoaded(new Date());
    } catch {
      setError(
        lang === "ar"
          ? "تعذّر تحميل بيانات التأجير. حاول مرة أخرى."
          : "Couldn't load leasing data. Try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [lang]);

  React.useEffect(() => {
    load();
  }, [load]);

  const funnelData = React.useMemo(
    () =>
      (stats?.pipeline ?? []).map((p) => ({
        stage: STAGE_LABELS[p.stage]?.[lang] ?? p.stage,
        key: p.stage,
        count: p.count,
        amount: p.amount,
      })),
    [stats, lang],
  );

  const chartConfig: ChartConfig = {
    count: { label: lang === "ar" ? "عدد الصفقات" : "Deal count" },
  };

  const fmt = (n: number) => n.toLocaleString("en-US");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {lang === "ar" ? "التأجير" : "Leasing"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lang === "ar"
              ? "عقود، طلبات، ومسار التحويل"
              : "Leases, applications, and pipeline"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DateRangePicker locale={lang} />
          <LastUpdatedAgo
            timestamp={lastLoaded}
            locale={lang}
            onRefresh={load}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <p className="text-sm text-destructive flex-1">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            style={{ display: "inline-flex" }}
          >
            {lang === "ar" ? "إعادة المحاولة" : "Retry"}
          </Button>
        </div>
      )}

      {/* KPIs — hero + 3 standards per § 6.9.1 North Star rule */}
      <div className="space-y-4">
        <KPICard
          tier="hero"
          label={lang === "ar" ? "عقود موقعة هذا الشهر" : "Leases Signed MTD"}
          value={loading ? "—" : fmt(stats?.leasesSignedMTD ?? 0)}
          icon={<FileSignature className="h-[18px] w-[18px]" />}
          accent="primary"
          comparisonPeriod={lang === "ar" ? "هذا الشهر" : "this month"}
          secondaryInsight={
            !loading && stats
              ? lang === "ar"
                ? `${fmt(stats.activeLeases)} عقد نشط حالياً`
                : `${fmt(stats.activeLeases)} active leases in portfolio`
              : undefined
          }
          trend={pipelineTrend.slice(-12)}
          href="/dashboard/contracts"
          lastUpdated={lastLoaded}
          locale={lang}
          loading={loading}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <KPICard
            label={lang === "ar" ? "طلبات معلقة" : "Pending Applications"}
            value={loading ? "—" : fmt(stats?.pendingApplications ?? 0)}
            icon={<ClipboardList className="h-[18px] w-[18px]" />}
            accent={
              stats && stats.pendingApplications > 0 ? "warning" : "primary"
            }
            comparisonPeriod={lang === "ar" ? "تحتاج مراجعة" : "awaiting review"}
            href="/dashboard/deals"
            lastUpdated={lastLoaded}
            locale={lang}
            loading={loading}
          />
          <KPICard
            label={lang === "ar" ? "عقود نشطة" : "Active Leases"}
            value={loading ? "—" : fmt(stats?.activeLeases ?? 0)}
            icon={<Users className="h-[18px] w-[18px]" />}
            accent="success"
            comparisonPeriod={lang === "ar" ? "حالياً" : "currently"}
            href="/dashboard/contracts"
            lastUpdated={lastLoaded}
            locale={lang}
            loading={loading}
          />
          <KPICard
            label={lang === "ar" ? "تنتهي قريباً" : "Expiring Soon"}
            value={loading ? "—" : fmt(stats?.expiringSoon ?? 0)}
            icon={<CalendarClock className="h-[18px] w-[18px]" />}
            accent={stats && stats.expiringSoon > 0 ? "warning" : "primary"}
            comparisonPeriod={lang === "ar" ? "خلال 30 يوم" : "in next 30 days"}
            href="/dashboard/contracts"
            lastUpdated={lastLoaded}
            locale={lang}
            loading={loading}
          />
        </div>
      </div>

      {/* Pipeline funnel + stage breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              {lang === "ar" ? "مسار التحويل" : "Pipeline Funnel"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-64 animate-pulse rounded bg-muted" />
            ) : funnelData.length === 0 ? (
              <EmptyState
                compact
                icon={<BarChart3 className="h-10 w-10" />}
                title={lang === "ar" ? "لا توجد بيانات بعد" : "No pipeline data yet"}
                description={
                  lang === "ar"
                    ? "ستظهر صفقات التأجير هنا عند إنشائها."
                    : "Leasing deals will appear here once created."
                }
              />
            ) : (
              <ChartContainer config={chartConfig} className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={funnelData}
                    layout="vertical"
                    margin={{ top: 8, right: 16, left: 16, bottom: 8 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      type="number"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis
                      type="category"
                      dataKey="stage"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      width={96}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 10,
                        color: "hsl(var(--popover-foreground))",
                      }}
                    />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                      {funnelData.map((d) => (
                        <Cell
                          key={d.key}
                          fill={STAGE_COLORS[d.key] ?? "hsl(var(--chart-1))"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              {lang === "ar" ? "قيمة المسار" : "Pipeline Value"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-64 animate-pulse rounded bg-muted" />
            ) : funnelData.length === 0 ? (
              <EmptyState
                compact
                icon={<BarChart3 className="h-10 w-10" />}
                title={lang === "ar" ? "لا توجد بيانات بعد" : "No pipeline data yet"}
                description={
                  lang === "ar"
                    ? "ستظهر قيم المسار هنا عند إضافة صفقات."
                    : "Pipeline values will appear here once deals are added."
                }
              />
            ) : (
              <div className="space-y-3">
                {funnelData.map((d) => {
                  const max = Math.max(...funnelData.map((x) => x.amount));
                  const pct = max === 0 ? 0 : (d.amount / max) * 100;
                  return (
                    <div key={d.key}>
                      <div className="flex items-baseline justify-between gap-2 mb-1">
                        <span className="text-sm font-medium text-foreground">
                          {d.stage}
                        </span>
                        <SARAmount value={d.amount} compact size={13} />
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-[width]"
                          style={{
                            width: `${pct}%`,
                            backgroundColor:
                              STAGE_COLORS[d.key] ?? "hsl(var(--chart-1))",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
