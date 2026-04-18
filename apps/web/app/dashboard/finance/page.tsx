"use client";

import * as React from "react";
import {
  TrendingUp,
  CreditCard,
  AlertCircle,
  Percent,
  AlertTriangle,
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
  getFinanceStats,
  type FinanceStats,
} from "../../actions/dashboard-finance";
import { getCollectionsTrend } from "../../actions/trends/getCollectionsTrend";
import { getRevenueTrend } from "../../actions/trends/getRevenueTrend";

export default function FinanceDashboardPage() {
  const { lang } = useLanguage();
  const [stats, setStats] = React.useState<FinanceStats | null>(null);
  const [collectionsTrend, setCollectionsTrend] = React.useState<number[]>([]);
  const [revenueTrend, setRevenueTrend] = React.useState<number[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [lastLoaded, setLastLoaded] = React.useState<Date>(new Date());

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, c, r] = await Promise.all([
        getFinanceStats(),
        getCollectionsTrend(),
        getRevenueTrend(),
      ]);
      setStats(s);
      setCollectionsTrend(c);
      setRevenueTrend(r);
      setLastLoaded(new Date());
    } catch {
      setError(
        lang === "ar"
          ? "تعذّر تحميل بيانات المالية. حاول مرة أخرى."
          : "Couldn't load finance data. Try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [lang]);

  React.useEffect(() => {
    load();
  }, [load]);

  // § 6.2 Finance semantic-color hierarchy — buckets go green → amber → orange → red
  const AGING_COLORS = [
    "hsl(var(--success))",      // 0-30 — current
    "hsl(var(--warning))",      // 31-60 — aging
    "hsl(28 72% 42%)",          // 61-90 — orange (darker warning)
    "hsl(var(--destructive))",  // 90+   — overdue
  ];

  const agingData = React.useMemo(
    () =>
      (stats?.aging ?? []).map((b, i) => ({
        bucket:
          lang === "ar"
            ? b.bucket.replace("-", "–") + " يومًا"
            : b.bucket + " d",
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

  const revenueData = React.useMemo(
    () =>
      revenueTrend.map((amt, i) => ({
        day: `D-${revenueTrend.length - i}`,
        amount: amt,
      })),
    [revenueTrend],
  );

  const chartConfig: ChartConfig = {
    rate: { label: lang === "ar" ? "نسبة التحصيل" : "Collection rate" },
    amount: { label: lang === "ar" ? "المبلغ" : "Amount" },
  };

  const fmt = (n: number) => n.toLocaleString("en-US");

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {lang === "ar" ? "المالية" : "Finance"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lang === "ar"
              ? "التحصيل وأعمار المستحقات"
              : "Collections and AR aging"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DateRangePicker locale={lang} />
          <LastUpdatedAgo timestamp={lastLoaded} locale={lang} onRefresh={load} />
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
          label={lang === "ar" ? "نسبة التحصيل" : "Collection Rate"}
          value={loading ? "—" : `${stats?.collectionRatePct ?? 0}%`}
          icon={<Percent className="h-[18px] w-[18px]" />}
          accent={
            !loading
              ? (stats?.collectionRatePct ?? 0) >= 90
                ? "success"
                : (stats?.collectionRatePct ?? 0) >= 75
                  ? "warning"
                  : "destructive"
              : "primary"
          }
          comparisonPeriod={lang === "ar" ? "هذا الشهر" : "this month"}
          secondaryInsight={
            !loading && stats
              ? lang === "ar"
                ? `${fmt(stats.collectedMTD)} من ${fmt(stats.expectedMTD)} ر.س محصّل`
                : `${fmt(stats.collectedMTD)} of ${fmt(stats.expectedMTD)} SAR collected`
              : undefined
          }
          trend={collectionsTrend}
          href="/dashboard/finance"
          lastUpdated={lastLoaded}
          locale={lang}
          loading={loading}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <KPICard
            label={lang === "ar" ? "المحصّل هذا الشهر" : "Collected MTD"}
            value={
              loading ? (
                "—"
              ) : (
                <SARAmount value={stats?.collectedMTD ?? 0} compact size={20} />
              )
            }
            icon={<TrendingUp className="h-[18px] w-[18px]" />}
            accent="success"
            comparisonPeriod={
              lang === "ar"
                ? `من ${fmt(stats?.expectedMTD ?? 0)} ر.س`
                : `of ${fmt(stats?.expectedMTD ?? 0)} SAR`
            }
            trend={revenueTrend.slice(-12)}
            href="/dashboard/finance"
            lastUpdated={lastLoaded}
            locale={lang}
            loading={loading}
          />
          <KPICard
            label={lang === "ar" ? "إجمالي المستحق" : "Total AR"}
            value={
              loading ? (
                "—"
              ) : (
                <SARAmount value={stats?.totalAR ?? 0} compact size={20} />
              )
            }
            icon={<CreditCard className="h-[18px] w-[18px]" />}
            accent={stats && stats.totalAR > 0 ? "warning" : "primary"}
            comparisonPeriod={lang === "ar" ? "غير محصّل" : "outstanding"}
            href="/dashboard/finance"
            lastUpdated={lastLoaded}
            locale={lang}
            loading={loading}
          />
          <KPICard
            label={lang === "ar" ? "متأخرات" : "Overdue"}
            value={loading ? "—" : fmt(stats?.overdueCount ?? 0)}
            icon={<AlertCircle className="h-[18px] w-[18px]" />}
            accent={
              stats && stats.overdueCount > 0 ? "destructive" : "primary"
            }
            comparisonPeriod={lang === "ar" ? "قسط" : "installments"}
            href="/dashboard/finance"
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
              {lang === "ar" ? "أعمار المستحقات" : "AR Aging"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-64 animate-pulse rounded bg-muted" />
            ) : agingData.every((d) => d.amount === 0) ? (
              <EmptyState
                compact
                icon={<CreditCard className="h-10 w-10" />}
                title={
                  lang === "ar"
                    ? "لا توجد مستحقات متأخرة"
                    : "No outstanding receivables"
                }
                description={
                  lang === "ar"
                    ? "كل المدفوعات محصّلة في موعدها."
                    : "All payments are collected on time."
                }
              />
            ) : (
              <ChartContainer config={chartConfig} className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={agingData}
                    margin={{ top: 8, right: 16, left: 16, bottom: 8 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="bucket"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
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
              {lang === "ar" ? "اتجاه التحصيل" : "Collection Trend"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-64 animate-pulse rounded bg-muted" />
            ) : (
              <ChartContainer config={chartConfig} className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={collectionsData}
                    margin={{ top: 8, right: 16, left: 16, bottom: 8 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="week"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
