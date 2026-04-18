"use client";

import * as React from "react";
import {
  Wrench,
  Clock,
  AlertOctagon,
  Timer,
  AlertTriangle,
} from "lucide-react";
import {
  KPICard,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  DateRangePicker,
  LastUpdatedAgo,
  ChartContainer,
  type ChartConfig,
} from "@repo/ui";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useLanguage } from "../../../components/LanguageProvider";
import {
  getMaintenanceStats,
  type MaintenanceStats,
} from "../../actions/dashboard-maintenance";
import { getTicketsTrend } from "../../actions/trends/getTicketsTrend";

const CATEGORY_LABELS: Record<string, { ar: string; en: string }> = {
  GENERAL:    { ar: "عام",       en: "General" },
  ELECTRICAL: { ar: "كهرباء",    en: "Electrical" },
  PLUMBING:   { ar: "سباكة",     en: "Plumbing" },
  HVAC:       { ar: "تكييف",     en: "HVAC" },
  APPLIANCE:  { ar: "أجهزة",     en: "Appliance" },
  STRUCTURAL: { ar: "إنشائي",    en: "Structural" },
  LANDSCAPE:  { ar: "مناظر",     en: "Landscape" },
  SECURITY:   { ar: "أمن",       en: "Security" },
  OTHER:      { ar: "أخرى",      en: "Other" },
};

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: "hsl(var(--destructive))",
  HIGH:   "hsl(var(--warning))",
  MEDIUM: "hsl(var(--chart-1))",
  LOW:    "hsl(var(--muted-foreground))",
};

export default function MaintenanceOverviewPage() {
  const { lang } = useLanguage();
  const [stats, setStats] = React.useState<MaintenanceStats | null>(null);
  const [ticketsTrend, setTicketsTrend] = React.useState<number[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [lastLoaded, setLastLoaded] = React.useState<Date>(new Date());

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, t] = await Promise.all([getMaintenanceStats(), getTicketsTrend()]);
      setStats(s);
      setTicketsTrend(t);
      setLastLoaded(new Date());
    } catch {
      setError(
        lang === "ar"
          ? "تعذّر تحميل بيانات الصيانة. حاول مرة أخرى."
          : "Couldn't load maintenance data. Try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [lang]);

  React.useEffect(() => {
    load();
  }, [load]);

  const categoryData = React.useMemo(
    () =>
      (stats?.byCategory ?? []).slice(0, 7).map((c) => ({
        category: CATEGORY_LABELS[c.category]?.[lang] ?? c.category,
        key: c.category,
        count: c.count,
      })),
    [stats, lang],
  );

  const trendData = React.useMemo(
    () =>
      ticketsTrend.map((count, i) => ({
        day: `D-${ticketsTrend.length - i}`,
        open: count,
      })),
    [ticketsTrend],
  );

  const chartConfig: ChartConfig = {
    count: { label: lang === "ar" ? "عدد الطلبات" : "Ticket count" },
    open:  { label: lang === "ar" ? "مفتوحة" : "Open" },
  };

  const fmt = (n: number) => n.toLocaleString("en-US");

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {lang === "ar" ? "الصيانة" : "Maintenance Overview"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lang === "ar"
              ? "الطلبات، وقت المعالجة، ومستوى الخدمة"
              : "Tickets, resolution time, and SLA health"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DateRangePicker locale={lang} />
          <LastUpdatedAgo timestamp={lastLoaded} locale={lang} onRefresh={load} />
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              (window.location.href = "/dashboard/maintenance/tickets")
            }
            style={{ display: "inline-flex" }}
          >
            {lang === "ar" ? "كل الطلبات" : "All Tickets"}
          </Button>
        </div>
      </div>

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
          label={lang === "ar" ? "طلبات مفتوحة" : "Open Tickets"}
          value={loading ? "—" : fmt(stats?.openTickets ?? 0)}
          icon={<Wrench className="h-[18px] w-[18px]" />}
          accent={
            stats && stats.slaBreachCount > 0
              ? "destructive"
              : stats && stats.openTickets > 10
                ? "warning"
                : "primary"
          }
          comparisonPeriod={
            lang === "ar" ? "تنتظر التعيين" : "awaiting assignment"
          }
          secondaryInsight={
            !loading && stats
              ? stats.slaBreachCount > 0
                ? lang === "ar"
                  ? `${fmt(stats.slaBreachCount)} طلب تجاوز مستوى الخدمة`
                  : `${fmt(stats.slaBreachCount)} tickets breaching SLA`
                : lang === "ar"
                  ? "كل الطلبات ضمن مستوى الخدمة"
                  : "All tickets within SLA"
              : undefined
          }
          trend={ticketsTrend}
          href="/dashboard/maintenance/tickets"
          lastUpdated={lastLoaded}
          locale={lang}
          loading={loading}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <KPICard
            label={lang === "ar" ? "قيد التنفيذ" : "In Progress"}
            value={loading ? "—" : fmt(stats?.inProgressTickets ?? 0)}
            icon={<Clock className="h-[18px] w-[18px]" />}
            accent="info"
            comparisonPeriod={lang === "ar" ? "مُعيّنة لفريق" : "assigned"}
            href="/dashboard/maintenance/tickets"
            lastUpdated={lastLoaded}
            locale={lang}
            loading={loading}
          />
          <KPICard
            label={lang === "ar" ? "طلبات متأخرة" : "SLA Breached"}
            value={loading ? "—" : fmt(stats?.slaBreachCount ?? 0)}
            icon={<AlertOctagon className="h-[18px] w-[18px]" />}
            accent={
              stats && stats.slaBreachCount > 0 ? "destructive" : "primary"
            }
            comparisonPeriod={lang === "ar" ? "طلب متأخر" : "tickets overdue"}
            href="/dashboard/maintenance/tickets"
            lastUpdated={lastLoaded}
            locale={lang}
            loading={loading}
          />
          <KPICard
            label={lang === "ar" ? "متوسط زمن الحل" : "Avg Resolution"}
            value={
              loading
                ? "—"
                : stats?.avgResolutionHours == null
                  ? "—"
                  : lang === "ar"
                    ? `${fmt(stats.avgResolutionHours)} س`
                    : `${fmt(stats.avgResolutionHours)} h`
            }
            icon={<Timer className="h-[18px] w-[18px]" />}
            accent="success"
            comparisonPeriod={lang === "ar" ? "آخر 30 يوم" : "last 30 days"}
            href="/dashboard/maintenance/tickets"
            lastUpdated={lastLoaded}
            locale={lang}
            loading={loading}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              {lang === "ar" ? "حسب الفئة" : "By Category"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-64 animate-pulse rounded bg-muted" />
            ) : categoryData.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                {lang === "ar" ? "لا توجد طلبات مفتوحة" : "No open tickets"}
              </p>
            ) : (
              <ChartContainer config={chartConfig} className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={categoryData}
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
                      dataKey="category"
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
                      {categoryData.map((d) => (
                        <Cell key={d.key} fill="hsl(var(--chart-1))" />
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
              {lang === "ar" ? "الطلبات المفتوحة عبر الوقت" : "Open Tickets Over Time"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-64 animate-pulse rounded bg-muted" />
            ) : (
              <ChartContainer config={chartConfig} className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={trendData}
                    margin={{ top: 8, right: 16, left: 16, bottom: 8 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="day"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      interval={Math.ceil(trendData.length / 8)}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 10,
                        color: "hsl(var(--popover-foreground))",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="open"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {stats && stats.byPriority.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              {lang === "ar" ? "حسب الأولوية" : "By Priority"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {stats.byPriority.map((p) => (
                <div
                  key={p.priority}
                  className="rounded-lg border border-border p-4"
                  style={{
                    borderInlineStartWidth: 4,
                    borderInlineStartColor:
                      PRIORITY_COLORS[p.priority] ?? "hsl(var(--chart-1))",
                  }}
                >
                  <p className="text-xs text-muted-foreground">
                    {p.priority}
                  </p>
                  <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">
                    {fmt(p.count)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
