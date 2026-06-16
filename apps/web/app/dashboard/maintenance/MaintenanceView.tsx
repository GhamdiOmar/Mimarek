"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Wrench,
  Clock,
  AlertOctagon,
  Timer,
  AlertTriangle,
} from "lucide-react";
import {
  KPICard,
  PageIntro,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  DateRangePicker,
  LastUpdatedAgo,
  ChartContainer,
  EmptyState,
  RoleTaskQueue,
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
import { useDateRangeQuery } from "../../../lib/use-date-range-query";
import type { MaintenanceStats } from "../../actions/dashboard-maintenance";
import type { RoleTaskQueueResult } from "../../actions/role-task-queue";

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

export default function MaintenanceView({
  stats,
  ticketsTrend,
  taskQueue,
  loadedAt,
}: {
  stats: MaintenanceStats;
  ticketsTrend: number[];
  taskQueue: RoleTaskQueueResult;
  loadedAt: string;
}) {
  const { lang, t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { range, setRange } = useDateRangeQuery();
  const [isPending, startTransition] = React.useTransition();

  // The date range scopes the flow KPI (avgResolutionHours — tickets resolved
  // within the window). openTickets, inProgressTickets, slaBreachCount,
  // byCategory, and byPriority are current-state stock metrics and are not
  // window-bound. The avgResolutionHours comparisonPeriod label must reflect
  // the actual window (finance honesty pattern).
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
  }, [hasCustomRange, range.from, range.to, lang, t]);

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

  const lastLoaded = React.useMemo(() => new Date(loadedAt), [loadedAt]);

  const categoryData = React.useMemo(
    () =>
      (stats.byCategory ?? []).slice(0, 7).map((c) => ({
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
    count: { label: t("عدد الطلبات", "Ticket count") },
    open:  { label: t("مفتوحة", "Open") },
  };

  const fmt = (n: number) => n.toLocaleString("en-US");

  return (
    <div className={`space-y-6 transition-opacity ${isPending ? "opacity-60" : ""}`}>
      <PageIntro
        title={t("الصيانة", "Maintenance Overview")}
        description={t(
          "الطلبات، وقت المعالجة، ومستوى الخدمة",
          "Tickets, resolution time, and SLA health",
        )}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <DateRangePicker value={range} onChange={onRangeChange} locale={lang} />
            <LastUpdatedAgo timestamp={lastLoaded} locale={lang} onRefresh={onRefresh} />
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                (window.location.href = "/dashboard/maintenance/tickets")
              }
              style={{ display: "inline-flex" }}
            >
              {t("كل الطلبات", "All Tickets")}
            </Button>
          </div>
        }
      />

      {/* KPIs — hero + 3 standards per § 6.9.1 North Star rule */}
      <div className="space-y-4">
        <KPICard
          tier="hero"
          label={t("طلبات مفتوحة", "Open Tickets")}
          value={fmt(stats.openTickets)}
          icon={<Wrench className="h-[18px] w-[18px]" />}
          accent={
            stats.slaBreachCount > 0
              ? "destructive"
              : stats.openTickets > 10
                ? "warning"
                : "primary"
          }
          comparisonPeriod={t("تنتظر التعيين", "awaiting assignment")}
          secondaryInsight={
            stats.slaBreachCount > 0
              ? t(
                  `${fmt(stats.slaBreachCount)} طلب تجاوز مستوى الخدمة`,
                  `${fmt(stats.slaBreachCount)} tickets breaching SLA`,
                )
              : t("كل الطلبات ضمن مستوى الخدمة", "All tickets within SLA")
          }
          trend={ticketsTrend}
          href="/dashboard/maintenance/tickets"
          lastUpdated={lastLoaded}
          locale={lang}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <KPICard
            label={t("قيد التنفيذ", "In Progress")}
            value={fmt(stats.inProgressTickets)}
            icon={<Clock className="h-[18px] w-[18px]" />}
            accent="info"
            comparisonPeriod={t("مُعيّنة لفريق", "assigned")}
            href="/dashboard/maintenance/tickets"
            lastUpdated={lastLoaded}
            locale={lang}
          />
          <KPICard
            label={t("طلبات متأخرة", "SLA Breached")}
            value={fmt(stats.slaBreachCount)}
            icon={<AlertOctagon className="h-[18px] w-[18px]" />}
            accent={stats.slaBreachCount > 0 ? "destructive" : "primary"}
            comparisonPeriod={t("طلب متأخر", "tickets overdue")}
            href="/dashboard/maintenance/tickets"
            lastUpdated={lastLoaded}
            locale={lang}
          />
          <KPICard
            label={t("متوسط زمن الحل", "Avg Resolution")}
            value={
              stats.avgResolutionHours == null
                ? "—"
                : lang === "ar"
                  ? `${fmt(stats.avgResolutionHours)} س`
                  : `${fmt(stats.avgResolutionHours)} h`
            }
            icon={<Timer className="h-[18px] w-[18px]" />}
            accent="success"
            comparisonPeriod={periodLabel}
            href="/dashboard/maintenance/tickets"
            lastUpdated={lastLoaded}
            locale={lang}
          />
        </div>
      </div>

      {/* Task Queue */}
      <RoleTaskQueue
        items={taskQueue?.maintenance ?? []}
        lang={lang}
        heading={{ ar: "المهام العاجلة", en: "Pending Actions" }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              {t("حسب الفئة", "By Category")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length === 0 ? (
              <EmptyState
                compact
                icon={<Wrench className="h-10 w-10" />}
                title={t("لا توجد طلبات مفتوحة", "No open tickets")}
                description={t(
                  "ستظهر طلبات الصيانة هنا عند استلامها.",
                  "Maintenance tickets will appear here once raised.",
                )}
              />
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
              {t("الطلبات المفتوحة عبر الوقت", "Open Tickets Over Time")}
            </CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>

      {stats.byPriority.length > 0 && (() => {
        // Severity order — highest first
        const SEVERITY_ORDER = ["URGENT", "HIGH", "MEDIUM", "LOW"] as const;

        // Bilingual priority labels
        const PRIORITY_LABELS: Record<string, { ar: string; en: string }> = {
          URGENT: { ar: "عاجل",   en: "Urgent" },
          HIGH:   { ar: "عالية",  en: "High" },
          MEDIUM: { ar: "متوسطة", en: "Medium" },
          LOW:    { ar: "منخفضة", en: "Low" },
        };

        // Bilingual urgency sub-labels (shown only on the dominant tile)
        const URGENCY_LABEL: Record<string, { ar: string; en: string }> = {
          URGENT: { ar: "بحاجة إلى استجابة فورية", en: "Needs immediate dispatch" },
          HIGH:   { ar: "يتطلب متابعة سريعة",       en: "Requires prompt follow-up" },
        };

        // Sort the incoming array by severity
        const sorted = [...stats.byPriority].sort(
          (a, b) =>
            (SEVERITY_ORDER.indexOf(a.priority as typeof SEVERITY_ORDER[number]) === -1
              ? 999
              : SEVERITY_ORDER.indexOf(a.priority as typeof SEVERITY_ORDER[number])) -
            (SEVERITY_ORDER.indexOf(b.priority as typeof SEVERITY_ORDER[number]) === -1
              ? 999
              : SEVERITY_ORDER.indexOf(b.priority as typeof SEVERITY_ORDER[number])),
        );

        // Dominant = highest-severity tile with count > 0; fall back to URGENT (even at 0)
        const dominantEntry =
          sorted.find((p) => (p.priority === "URGENT" || p.priority === "HIGH") && p.count > 0) ??
          sorted.find((p) => p.priority === "URGENT") ??
          sorted[0];

        if (!dominantEntry) return null;

        const secondaryEntries = sorted.filter((p) => p !== dominantEntry);

        // Semantic tint + text color per dominant priority
        const dominantTintClass =
          dominantEntry.priority === "URGENT"
            ? "bg-destructive/5"
            : dominantEntry.priority === "HIGH"
            ? "bg-warning/5"
            : "";

        const dominantTextClass =
          dominantEntry.priority === "URGENT"
            ? "text-destructive"
            : dominantEntry.priority === "HIGH"
            ? "text-warning"
            : "text-foreground";
        // Strong variant for rendered text (WCAG AA on tinted bg); icon keeps base token (aria-hidden)
        const dominantTextStrongClass =
          dominantEntry.priority === "URGENT"
            ? "text-destructive"
            : dominantEntry.priority === "HIGH"
            ? "text-warning-strong"
            : "text-foreground";

        const urgencyLabel =
          URGENCY_LABEL[dominantEntry.priority]?.[lang];

        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">
                {t("حسب الأولوية", "By Priority")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Dominant block — spans 2 columns, elevated visual weight */}
                <div
                  className={[
                    "col-span-2 sm:col-span-2 rounded-lg border border-border card-quiet p-5 flex flex-col gap-2",
                    dominantTintClass,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle
                      className={["h-5 w-5 shrink-0", dominantTextClass].join(" ")}
                      aria-hidden="true"
                    />
                    <span className={["text-sm font-semibold", dominantTextStrongClass].join(" ")}>
                      {PRIORITY_LABELS[dominantEntry.priority]?.[lang] ?? dominantEntry.priority}
                    </span>
                  </div>
                  <p className={["text-4xl font-bold tabular-nums leading-none", dominantTextStrongClass].join(" ")}>
                    {fmt(dominantEntry.count)}
                  </p>
                  {urgencyLabel && (
                    <p className="text-xs text-muted-foreground leading-snug">
                      {urgencyLabel}
                    </p>
                  )}
                </div>

                {/* Secondary tiles — compact, muted */}
                {secondaryEntries.map((p) => (
                  <div
                    key={p.priority}
                    className="rounded-lg border border-border card-quiet p-4 flex flex-col gap-1"
                  >
                    <p className="text-xs text-muted-foreground">
                      {PRIORITY_LABELS[p.priority]?.[lang] ?? p.priority}
                    </p>
                    <p className="text-xl font-bold text-foreground tabular-nums">
                      {fmt(p.count)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}
