"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  TrendingUp,
  CreditCard,
  AlertCircle,
  Percent,
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
import type { FinanceStats } from "../../actions/dashboard-finance";
import type { RoleTaskQueueResult } from "../../actions/role-task-queue";

export default function FinanceView({
  stats,
  collectionsTrend,
  revenueTrend,
  taskQueue,
  loadedAt,
}: {
  stats: FinanceStats;
  collectionsTrend: number[];
  revenueTrend: number[];
  taskQueue: RoleTaskQueueResult;
  loadedAt: string;
}) {
  const { lang, t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { range, setRange } = useDateRangeQuery();
  const [isPending, startTransition] = React.useTransition();

  // The date range scopes the flow KPIs (collected/expected/rate). AR aging,
  // overdue and the collection trend are current-state / rolling and are not
  // window-bound by design — so the flow labels must reflect the actual window
  // (not a hardcoded "this month") whenever a custom range is active, to avoid
  // a silent half-filter.
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

  // § 6.2 Finance semantic-color hierarchy — buckets go green → amber → orange → red
  const AGING_COLORS = [
    "hsl(var(--success))",
    "hsl(var(--warning))",
    "hsl(28 72% 42%)",
    "hsl(var(--destructive))",
  ];

  const agingData = React.useMemo(
    () =>
      (stats.aging ?? []).map((b, i) => ({
        bucket: lang === "ar" ? b.bucket.replace("-", "–") + " يومًا" : b.bucket + " d",
        amount: b.amount,
        color: AGING_COLORS[i] ?? AGING_COLORS[0]!,
      })),
    [stats, lang],
  );

  const collectionsData = React.useMemo(
    () =>
      collectionsTrend.map((pct, i) => ({
        week: `W-${collectionsTrend.length - i}`,
        rate: pct,
      })),
    [collectionsTrend],
  );

  const chartConfig: ChartConfig = {
    rate: { label: t("نسبة التحصيل", "Collection rate") },
    amount: { label: t("المبلغ", "Amount") },
  };

  const fmt = (n: number) => n.toLocaleString("en-US");

  return (
    <div className={`space-y-6 transition-opacity ${isPending ? "opacity-60" : ""}`}>
      <PageIntro
        title={t("المالية", "Finance")}
        description={t("التحصيل وأعمار المستحقات", "Collections and AR aging")}
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
          label={t("نسبة التحصيل", "Collection Rate")}
          value={`${stats.collectionRatePct}%`}
          icon={<Percent className="h-[18px] w-[18px]" />}
          accent={
            stats.collectionRatePct >= 90
              ? "success"
              : stats.collectionRatePct >= 75
                ? "warning"
                : "destructive"
          }
          comparisonPeriod={periodLabel}
          secondaryInsight={t(
            `${fmt(stats.collectedMTD)} من ${fmt(stats.expectedMTD)} ر.س محصّل`,
            `${fmt(stats.collectedMTD)} of ${fmt(stats.expectedMTD)} SAR collected`,
          )}
          trend={collectionsTrend}
          href="/dashboard/finance"
          lastUpdated={lastLoaded}
          locale={lang}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <KPICard
            label={t("المحصّل", "Collected")}
            value={<SARAmount value={stats.collectedMTD} compact size={20} />}
            icon={<TrendingUp className="h-[18px] w-[18px]" />}
            accent="success"
            comparisonPeriod={t(
              `من ${fmt(stats.expectedMTD)} ر.س`,
              `of ${fmt(stats.expectedMTD)} SAR`,
            )}
            trend={revenueTrend.slice(-12)}
            href="/dashboard/finance"
            lastUpdated={lastLoaded}
            locale={lang}
          />
          <KPICard
            label={t("إجمالي المستحق", "Total AR")}
            value={<SARAmount value={stats.totalAR} compact size={20} />}
            icon={<CreditCard className="h-[18px] w-[18px]" />}
            accent={stats.totalAR > 0 ? "warning" : "primary"}
            comparisonPeriod={t("غير محصّل", "outstanding")}
            href="/dashboard/finance"
            lastUpdated={lastLoaded}
            locale={lang}
          />
          <KPICard
            label={t("متأخرات", "Overdue")}
            value={fmt(stats.overdueCount)}
            icon={<AlertCircle className="h-[18px] w-[18px]" />}
            accent={stats.overdueCount > 0 ? "destructive" : "primary"}
            comparisonPeriod={t("قسط", "installments")}
            href="/dashboard/finance"
            lastUpdated={lastLoaded}
            locale={lang}
          />
        </div>
      </div>

      {/* Task Queue */}
      <RoleTaskQueue
        items={taskQueue?.finance ?? []}
        lang={lang}
        heading={{ ar: "المهام العاجلة", en: "Pending Actions" }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              {t("أعمار المستحقات", "AR Aging")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {agingData.every((d) => d.amount === 0) ? (
              <EmptyState
                compact
                icon={<CreditCard className="h-10 w-10" />}
                title={t("لا توجد مستحقات متأخرة", "No outstanding receivables")}
                description={t(
                  "كل المدفوعات محصّلة في موعدها.",
                  "All payments are collected on time.",
                )}
              />
            ) : (
              <ChartContainer config={chartConfig} className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={agingData} margin={{ top: 8, right: 16, left: 16, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="bucket" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 10,
                        color: "hsl(var(--popover-foreground))",
                      }}
                    />
                    <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                      {agingData.map((d) => (
                        <Cell key={d.bucket} fill={d.color} />
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
              {t("اتجاه التحصيل", "Collection Trend")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={collectionsData} margin={{ top: 8, right: 16, left: 16, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="week"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickFormatter={(v) => {
                      const n = String(v).match(/(\d+)/)?.[1] ?? v;
                      return t(`أسبوع ${n}`, `Wk ${n}`);
                    }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 10,
                      color: "hsl(var(--popover-foreground))",
                    }}
                    formatter={(v: number) => [`${v}%`, ""]}
                  />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    dot={{ fill: "hsl(var(--primary))", r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
