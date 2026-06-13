"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ClipboardList,
  FileSignature,
  Users,
  CalendarClock,
  BarChart3,
} from "lucide-react";
import {
  KPICard,
  PageIntro,
  SARAmount,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
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
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useLanguage } from "../../../components/LanguageProvider";
import { useDateRangeQuery } from "../../../lib/use-date-range-query";
import type { LeasingStats } from "../../actions/dashboard-leasing";
import type { RoleTaskQueueResult } from "../../actions/role-task-queue";

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

export default function LeasingView({
  stats,
  pipelineTrend,
  taskQueue,
  loadedAt,
}: {
  stats: LeasingStats;
  pipelineTrend: number[];
  taskQueue: RoleTaskQueueResult;
  loadedAt: string;
}) {
  const { lang, t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { range, setRange } = useDateRangeQuery();
  const [isPending, startTransition] = React.useTransition();

  // The date range scopes the flow KPI (leasesSignedMTD — leases created in
  // the window). pendingApplications, activeLeases, expiringSoon, and the
  // pipeline funnel are current-state stock metrics and are not window-bound.
  // Labels must reflect the actual window so they don't silently mis-claim a
  // period the data ignores (finance honesty pattern).
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

  const funnelData = React.useMemo(
    () =>
      (stats.pipeline ?? []).map((p) => ({
        stage: STAGE_LABELS[p.stage]?.[lang] ?? p.stage,
        key: p.stage,
        count: p.count,
        amount: p.amount,
      })),
    [stats, lang],
  );

  const chartConfig: ChartConfig = {
    count: { label: t("عدد الحجوزات", "Reservation count") },
  };

  const fmt = (n: number) => n.toLocaleString("en-US");

  return (
    <div className={`space-y-6 transition-opacity ${isPending ? "opacity-60" : ""}`}>
      <PageIntro
        title={t("التأجير", "Leasing")}
        description={t("عقود، طلبات، ومسار التحويل", "Leases, applications, and pipeline")}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <DateRangePicker value={range} onChange={onRangeChange} locale={lang} />
            <LastUpdatedAgo timestamp={lastLoaded} locale={lang} onRefresh={onRefresh} />
          </div>
        }
      />

      {/* KPIs — hero + 3 standards per § 6.9.1 North Star rule */}
      <div className="space-y-4">
        <KPICard
          tier="hero"
          label={t("عقود موقعة", "Leases Signed")}
          value={fmt(stats.leasesSignedMTD)}
          icon={<FileSignature className="h-[18px] w-[18px]" />}
          accent="primary"
          comparisonPeriod={periodLabel}
          secondaryInsight={t(
            `${fmt(stats.activeLeases)} عقد نشط حالياً`,
            `${fmt(stats.activeLeases)} active leases in portfolio`,
          )}
          trend={pipelineTrend.slice(-12)}
          href="/dashboard/contracts"
          lastUpdated={lastLoaded}
          locale={lang}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <KPICard
            label={t("طلبات معلقة", "Pending Applications")}
            value={fmt(stats.pendingApplications)}
            icon={<ClipboardList className="h-[18px] w-[18px]" />}
            accent={stats.pendingApplications > 0 ? "warning" : "primary"}
            comparisonPeriod={t("تحتاج مراجعة", "awaiting review")}
            href="/dashboard/reservations"
            lastUpdated={lastLoaded}
            locale={lang}
          />
          <KPICard
            label={t("عقود نشطة", "Active Leases")}
            value={fmt(stats.activeLeases)}
            icon={<Users className="h-[18px] w-[18px]" />}
            accent="success"
            comparisonPeriod={t("حالياً", "currently")}
            href="/dashboard/contracts"
            lastUpdated={lastLoaded}
            locale={lang}
          />
          <KPICard
            label={t("تنتهي قريباً", "Expiring Soon")}
            value={fmt(stats.expiringSoon)}
            icon={<CalendarClock className="h-[18px] w-[18px]" />}
            accent={stats.expiringSoon > 0 ? "warning" : "primary"}
            comparisonPeriod={t("خلال 30 يوم", "in next 30 days")}
            href="/dashboard/contracts"
            lastUpdated={lastLoaded}
            locale={lang}
          />
        </div>
      </div>

      {/* Task Queue */}
      <RoleTaskQueue
        items={taskQueue?.leasing ?? []}
        lang={lang}
        heading={{ ar: "المهام العاجلة", en: "Pending Actions" }}
      />

      {/* Pipeline funnel + stage breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              {t("مسار التحويل", "Pipeline Funnel")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {funnelData.length === 0 ? (
              <EmptyState
                compact
                icon={<BarChart3 className="h-10 w-10" />}
                title={t("لا توجد بيانات بعد", "No pipeline data yet")}
                description={t(
                  "ستظهر حجوزات التأجير هنا عند إنشائها.",
                  "Leasing reservations will appear here once created.",
                )}
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
              {t("قيمة المسار", "Pipeline Value")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {funnelData.length === 0 ? (
              <EmptyState
                compact
                icon={<BarChart3 className="h-10 w-10" />}
                title={t("لا توجد بيانات بعد", "No pipeline data yet")}
                description={t(
                  "ستظهر قيم المسار هنا عند إضافة حجوزات.",
                  "Pipeline values will appear here once reservations are added.",
                )}
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
