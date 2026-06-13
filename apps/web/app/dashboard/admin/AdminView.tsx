"use client";

import * as React from "react";
import {
  Users, Receipt,
  Ticket, ListChecks, Tag, SearchCheck, Settings,
  ChevronRight, ShieldAlert, TrendingUp, AlertTriangle,
  TrendingDown, Wallet, PieChart, Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AppBar,
  DirectionalIcon,
  DateRangePicker,
  LastUpdatedAgo,
  KPICard,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  ChartContainer,
  type ChartConfig,
} from "@repo/ui";
import { PageHeader } from "@repo/ui/components/PageHeader";
import { formatSARCompact } from "@repo/ui/lib/format-sar";
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useLanguage } from "../../../components/LanguageProvider";
import { useDateRangeQuery } from "../../../lib/use-date-range-query";
import type { adminGetPlatformStats } from "../../actions/admin-stats";
import type { getNetNewArr } from "../../actions/admin-analytics/getNetNewArr";
import type { getArrWaterfall } from "../../actions/admin-analytics/getArrWaterfall";
import type { getArAging } from "../../actions/admin-analytics/getArAging";
import type { getCollectedVsBilled } from "../../actions/admin-analytics/getCollectedVsBilled";
import type { getFailedPaymentArrAtRisk } from "../../actions/admin-analytics/getFailedPaymentArrAtRisk";
import type { getZatcaClearanceRate } from "../../actions/admin-analytics/getZatcaClearanceRate";
import type { getTopArrConcentration } from "../../actions/admin-analytics/getTopArrConcentration";
import type { getDiscountLeakage } from "../../actions/admin-analytics/getDiscountLeakage";
import type { getTrialToPaidConversion } from "../../actions/admin-analytics/getTrialToPaidConversion";
import type { getPlatformRiskInputs } from "../../actions/admin-analytics/getPlatformRiskInputs";

// ─── Bilingual metric descriptions (Step G catalog) ──────────────────────────
const D = {
  en: {
    netNewArr:
      "The net change in annualized recurring revenue across all paying tenants for the selected period. New + Expansion + Reactivation minus Contraction, Churn, and Refunds. In SAR, ex-VAT.",
    startingArr:
      "Total annualized recurring revenue at the start of the selected period, from the month-start MRR snapshot.",
    newArr:
      "Annualized revenue from net-new paid subscriptions started within the selected period.",
    expansionArr:
      "Increase from existing tenants upgrading plans or adding seats within the period.",
    contractionArr:
      "Decrease from existing tenants downgrading plans within the period (still active, not churned).",
    churnArr:
      "Annualized revenue lost from subscriptions transitioning to canceled or unpaid status.",
    reactivationArr:
      "Annualized revenue recovered from previously canceled subscriptions returning to active.",
    refundArr:
      "Annualized revenue removed due to refunds or accounting adjustments within the period.",
    endingArr:
      "Total annualized recurring revenue at the end of the selected period — must equal Starting + Net New ARR (reconciliation check).",
    collected:
      "Total invoice payments collected in the selected period. Gross of 15% VAT.",
    billed:
      "Total invoices issued in the selected period. Gross of 15% VAT.",
    arAging030:
      "Total unpaid invoice amount where the due date has passed by 0 to 30 days. Gross of VAT.",
    arAging3160:
      "Total unpaid invoice amount aged 31 to 60 days past due. Gross of VAT.",
    arAging6190:
      "Total unpaid invoice amount aged 61 to 90 days past due. Gross of VAT.",
    arAging90:
      "Total unpaid invoice amount aged more than 90 days past due. Gross of VAT. The highest-risk bucket — often signals account at risk of churn.",
    atRiskArr:
      "Annualized recurring revenue from subscriptions currently past-due or unpaid, excluding amounts already counted in AR aging buckets to prevent double-counting. Ex-VAT.",
    zatcaClearance:
      "Percentage of invoices issued in the period that successfully cleared with ZATCA. Steady-state target ≥99%. A drop indicates integration breakage.",
    pastDue:
      "Number of tenant organizations with at least one subscription currently in Past-Due or Unpaid status. Direct churn-risk signal.",
    noLoginAdmin:
      "Number of paying tenants where no ADMIN-role user has signed in for more than 21 days. Engagement leading indicator.",
    openP1Old:
      "Open Urgent or High-priority support tickets older than 14 days. Support-SLA-breach proxy.",
    failedPayment:
      "Tenants who experienced more than 2 failed payment attempts in the last 30 days. Dunning-candidate signal.",
    top5:
      "Share of total ARR held by the five largest paying tenants. A high concentration (above ~40%) signals customer-concentration risk.",
    top10:
      "Share of total ARR held by the ten largest paying tenants.",
    discountLeakage:
      "Coupon-driven revenue forgone as a percentage of pre-discount revenue. Use to size discount discipline.",
    trialConversion:
      "Of trials started in the period, the percentage that converted to paid before trial end. The denominator is always shown to prevent small-sample misreading.",
    activeOrgs:
      "Count of tenant organizations with at least one active subscription. A scale tile — not a North Star.",
    totalUsers:
      "Count of all user accounts across the platform (tenant + system staff).",
    totalProperties:
      "Count of all unit / property records across all tenants.",
    totalContracts:
      "Count of all contracts (lease + sale) created across all tenants.",
    openTickets:
      "Count of open and in-progress support tickets across all tenants.",
  },
  ar: {
    netNewArr:
      "صافي التغيّر في الإيراد السنوي المتكرر عبر جميع المستأجرين المدفوعين خلال الفترة المحددة. الجديد + التوسع + إعادة التفعيل ناقص الانكماش والإلغاء والاسترداد. بالريال السعودي، غير شامل الضريبة.",
    startingArr:
      "إجمالي الإيراد السنوي المتكرر في بداية الفترة المحددة، من اللقطة الشهرية لبداية الشهر.",
    newArr:
      "الإيراد السنوي من الاشتراكات المدفوعة الجديدة التي بدأت خلال الفترة المحددة.",
    expansionArr:
      "الزيادة من المستأجرين الحاليين عبر ترقية الخطط أو إضافة المقاعد خلال الفترة.",
    contractionArr:
      "النقص من المستأجرين الحاليين عبر تخفيض الخطط خلال الفترة (لا يزالون نشطين).",
    churnArr:
      "الإيراد السنوي المفقود من الاشتراكات التي انتقلت إلى ملغاة أو غير مدفوعة.",
    reactivationArr:
      "الإيراد السنوي المستعاد من اشتراكات سبق إلغاؤها وعادت إلى الحالة النشطة.",
    refundArr:
      "الإيراد السنوي المخصوم بسبب الاستردادات أو تعديلات المحاسبة خلال الفترة.",
    endingArr:
      "إجمالي الإيراد السنوي المتكرر في نهاية الفترة — يجب أن يساوي البداية + صافي التغيّر (تحقق المطابقة).",
    collected:
      "إجمالي مدفوعات الفواتير المحصلة خلال الفترة المحددة. شامل ضريبة القيمة المضافة.",
    billed:
      "إجمالي الفواتير المُصدرة خلال الفترة المحددة. شامل ضريبة القيمة المضافة.",
    arAging030:
      "إجمالي مبلغ الفواتير غير المدفوعة حيث تجاوز تاريخ الاستحقاق 0 إلى 30 يوماً. شامل الضريبة.",
    arAging3160:
      "إجمالي مبلغ الفواتير غير المدفوعة المتأخرة بين 31 و60 يوماً. شامل الضريبة.",
    arAging6190:
      "إجمالي مبلغ الفواتير غير المدفوعة المتأخرة بين 61 و90 يوماً. شامل الضريبة.",
    arAging90:
      "إجمالي مبلغ الفواتير غير المدفوعة المتأخرة لأكثر من 90 يوماً. شامل الضريبة. الفئة الأعلى مخاطرة.",
    atRiskArr:
      "الإيراد السنوي من الاشتراكات المتأخرة أو غير المدفوعة، باستثناء المبالغ المُحتسبة بالفعل في تقادم الذمم لتجنب الازدواجية. غير شامل الضريبة.",
    zatcaClearance:
      "نسبة الفواتير المُصدرة خلال الفترة التي تم اعتمادها بنجاح من هيئة الزكاة والضريبة. الهدف المستدام ≥99%. الانخفاض يشير إلى مشكلة في التكامل.",
    pastDue:
      "عدد المنظمات المستأجرة التي لديها اشتراك واحد على الأقل متأخر السداد أو غير مدفوع حالياً. مؤشر مباشر لخطر الإلغاء.",
    noLoginAdmin:
      "عدد المستأجرين المدفوعين حيث لم يسجل أي مستخدم بدور المسؤول الدخول لأكثر من 21 يوماً. مؤشر تحذيري للتفاعل.",
    openP1Old:
      "تذاكر الدعم العاجلة أو ذات الأولوية العالية المفتوحة منذ أكثر من 14 يوماً. مؤشر إخلال بمستوى الخدمة.",
    failedPayment:
      "المستأجرون الذين شهدوا أكثر من محاولتين فاشلتين للدفع في آخر 30 يوماً. مرشحون لإجراءات المتابعة.",
    top5:
      "حصة الخمسة المستأجرين الأكبر من إجمالي الإيراد السنوي. التركيز العالي (فوق 40% تقريباً) يشير إلى مخاطر التركيز.",
    top10:
      "حصة العشرة المستأجرين الأكبر من إجمالي الإيراد السنوي.",
    discountLeakage:
      "الإيراد المتنازل عنه بسبب الكوبونات كنسبة من الإيراد قبل الخصم. يستخدم لتقدير انضباط الخصومات.",
    trialConversion:
      "من الاشتراكات التجريبية التي بدأت خلال الفترة، نسبة التي تحولت إلى مدفوعة قبل انتهاء الفترة التجريبية. يظهر المقام دائماً لمنع سوء القراءة عند العينات الصغيرة.",
    activeOrgs:
      "عدد المنظمات المستأجرة التي لديها اشتراك نشط واحد على الأقل. مقياس حجم — ليس مقياس النجمة القطبية.",
    totalUsers:
      "عدد جميع حسابات المستخدمين عبر المنصة (المستأجرون + موظفو النظام).",
    totalProperties:
      "عدد جميع سجلات الوحدات / العقارات عبر جميع المستأجرين.",
    totalContracts:
      "عدد جميع العقود (إيجار + بيع) المُنشأة عبر جميع المستأجرين.",
    openTickets:
      "عدد تذاكر الدعم المفتوحة وقيد المعالجة عبر جميع المستأجرين.",
  },
} as const;

const quickLinks = [
  {
    href: "/dashboard/admin/plans",
    icon: ListChecks,
    label: { ar: "إدارة الخطط", en: "Plans" },
    desc: { ar: "خطط الاشتراك والأسعار", en: "Subscription plans & pricing" },
  },
  {
    href: "/dashboard/admin/subscriptions",
    icon: Users,
    label: { ar: "الاشتراكات", en: "Subscriptions" },
    desc: { ar: "اشتراكات المنظمات وحالتها", en: "Organization subscriptions" },
  },
  {
    href: "/dashboard/admin/coupons",
    icon: Tag,
    label: { ar: "الكوبونات", en: "Coupons" },
    desc: { ar: "أكواد الخصم والعروض", en: "Discount codes & promotions" },
  },
  {
    href: "/dashboard/admin/payments",
    icon: Receipt,
    label: { ar: "الفواتير والمدفوعات", en: "Invoices & Payments" },
    desc: { ar: "جميع الفواتير والمعاملات", en: "All invoices & transactions" },
  },
  {
    href: "/dashboard/admin/seo",
    icon: SearchCheck,
    label: { ar: "إعدادات SEO", en: "SEO Settings" },
    desc: { ar: "ميتاداتا وروبوتس والتحليلات", en: "Metadata, robots & analytics" },
  },
  {
    href: "/dashboard/admin/tickets",
    icon: Ticket,
    label: { ar: "تذاكر الدعم", en: "Support Tickets" },
    desc: { ar: "إدارة طلبات الدعم", en: "Manage support requests" },
  },
];

// ─── Props (server-fetched results) ──────────────────────────────────────────
type AdminViewProps = {
  netNew: Awaited<ReturnType<typeof getNetNewArr>>;
  waterfall: Awaited<ReturnType<typeof getArrWaterfall>>;
  aging: Awaited<ReturnType<typeof getArAging>>;
  collected: Awaited<ReturnType<typeof getCollectedVsBilled>>;
  atRisk: Awaited<ReturnType<typeof getFailedPaymentArrAtRisk>>;
  zatca: Awaited<ReturnType<typeof getZatcaClearanceRate>>;
  concentration: Awaited<ReturnType<typeof getTopArrConcentration>>;
  leakage: Awaited<ReturnType<typeof getDiscountLeakage>>;
  trial: Awaited<ReturnType<typeof getTrialToPaidConversion>>;
  risk: Awaited<ReturnType<typeof getPlatformRiskInputs>>;
  stats: Awaited<ReturnType<typeof adminGetPlatformStats>>;
  mrrTrend: number[];
  loadedAt: string;
};

// ─── Number formatting helpers ───────────────────────────────────────────────
function fmtCount(n: number | null | undefined): string {
  if (n == null) return "— — —";
  return n.toLocaleString("en-US");
}

function fmtPct(value: number | null | undefined, digits = 1): string {
  if (value == null) return "— — —";
  return `${(value * 100).toFixed(digits)}%`;
}

function fmtSarCompact(n: number | null | undefined): string {
  if (n == null) return "— — —";
  return formatSARCompact(n);
}

// ─── View ──────────────────────────────────────────────────────────────────
export default function AdminView({
  netNew,
  waterfall,
  aging,
  collected,
  atRisk,
  zatca,
  concentration,
  leakage,
  trial,
  risk,
  stats,
  mrrTrend,
  loadedAt,
}: AdminViewProps) {
  const { lang } = useLanguage();
  const router = useRouter();
  const { range, setRange } = useDateRangeQuery();
  const [isPending, startTransition] = React.useTransition();

  const desc = D[lang];
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

  // Hero secondary insight — breakdown line under the value
  const heroBreakdown = React.useMemo(() => {
    const b = netNew.breakdown;
    const fmt = (n: number) =>
      `${n >= 0 ? "+" : ""}${formatSARCompact(Math.abs(n))}${n < 0 ? " ⌄" : ""}`;
    return lang === "ar"
      ? `جديد ${fmt(b.newSar)} · توسع ${fmt(b.expansionSar)} · انكماش ${fmt(b.contractionSar)} · إلغاء ${fmt(b.churnSar)}`
      : `New ${fmt(b.newSar)} · Expansion ${fmt(b.expansionSar)} · Contraction ${fmt(b.contractionSar)} · Churn ${fmt(b.churnSar)}`;
  }, [netNew, lang]);

  const arrSign = netNew.valueSar ?? 0;

  // Waterfall chart data
  const waterfallChartData = React.useMemo(() => {
    const w = waterfall;
    return [
      {
        key: "starting",
        label: lang === "ar" ? "البداية" : "Starting",
        value: w.startingArr,
        kind: "endpoint" as const,
      },
      { key: "new", label: lang === "ar" ? "جديد" : "New", value: w.newArr, kind: "delta" as const },
      {
        key: "expansion",
        label: lang === "ar" ? "توسع" : "Expansion",
        value: w.expansionArr,
        kind: "delta" as const,
      },
      {
        key: "reactivation",
        label: lang === "ar" ? "إعادة تفعيل" : "Reactivation",
        value: w.reactivationArr,
        kind: "delta" as const,
      },
      {
        key: "contraction",
        label: lang === "ar" ? "انكماش" : "Contraction",
        value: w.contractionArr,
        kind: "delta" as const,
      },
      {
        key: "churn",
        label: lang === "ar" ? "إلغاء" : "Churn",
        value: w.churnArr,
        kind: "delta" as const,
      },
      {
        key: "refund",
        label: lang === "ar" ? "استرداد" : "Refund/Adj",
        value: w.refundAdjArr,
        kind: "delta" as const,
      },
      {
        key: "ending",
        label: lang === "ar" ? "النهاية" : "Ending",
        value: w.endingArr,
        kind: "endpoint" as const,
      },
    ];
  }, [waterfall, lang]);

  // AR aging chart data
  const agingChartData = React.useMemo(() => {
    return aging.buckets.map((b) => ({
      bucket: b.label,
      value: b.sumSarGross,
    }));
  }, [aging]);

  // 12-mo MRR trend chart data
  const mrrChartData = React.useMemo(() => {
    const now = new Date();
    return mrrTrend.map((total, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      return {
        month: d.toLocaleDateString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-US", {
          month: "short",
        }),
        total,
      };
    });
  }, [mrrTrend, lang]);

  const mrrChartConfig: ChartConfig = {
    total: {
      label: lang === "ar" ? "الإيراد الشهري" : "Monthly revenue",
    },
  };

  const waterfallChartConfig: ChartConfig = {
    value: {
      label: lang === "ar" ? "الإيراد السنوي" : "ARR",
    },
  };

  return (
    <>
      {/* ─── Mobile (< md) — quick-link tiles unchanged ──────────────────── */}
      <div
        className="md:hidden -m-4 sm:-m-6 min-h-dvh flex flex-col bg-background"
        dir={lang === "ar" ? "rtl" : "ltr"}
      >
        <AppBar title={lang === "ar" ? "الإدارة" : "Admin"} lang={lang} />
        <div className="flex-1 px-4 pt-4 pb-8">
          <div className="grid grid-cols-2 gap-3">
            {quickLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card p-4 min-h-[120px] text-center transition-colors active:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]"
              >
                <span className="inline-flex items-center justify-center rounded-xl bg-primary/10 p-3 text-primary">
                  <item.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {item.label[lang]}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Desktop (≥ md) ────────────────────────────────────────────── */}
      <div className="hidden md:block">
        <div
          className={`space-y-8 animate-in fade-in duration-500 transition-opacity ${isPending ? "opacity-60" : ""}`}
          dir={lang === "ar" ? "rtl" : "ltr"}
        >
          {/* Header — title + DateRangePicker + LastUpdatedAgo */}
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Settings className="h-7 w-7" />
            </div>
            <PageHeader
              className="flex-1"
              title={lang === "ar" ? "إدارة المنصة" : "Platform Administration"}
              description={
                lang === "ar"
                  ? "مقاييس الإيراد والمخاطر — افتراضي: منذ بداية الشهر"
                  : "Revenue & risk metrics — defaults to month-to-date"
              }
              actions={
                <div className="flex items-center gap-3">
                  <div className="w-[280px]">
                    <DateRangePicker
                      value={range}
                      onChange={onRangeChange}
                      locale={lang}
                    />
                  </div>
                  <LastUpdatedAgo
                    timestamp={lastLoaded}
                    locale={lang}
                    onRefresh={onRefresh}
                  />
                </div>
              }
            />
          </div>

          {/* HERO — Net New ARR */}
          <KPICard
            tier="hero"
            label={lang === "ar" ? "صافي الإيراد السنوي الجديد" : "Net New ARR"}
            description={desc.netNewArr}
            value={fmtSarCompact(netNew.valueSar)}
            unit={lang === "ar" ? "ر.س" : "SAR"}
            icon={<TrendingUp className="h-[18px] w-[18px]" />}
            accent={arrSign >= 0 ? "secondary" : "destructive"}
            comparisonPeriod={lang === "ar" ? "للفترة المحددة" : "selected period"}
            secondaryInsight={heroBreakdown}
            trend={mrrTrend}
            href="/dashboard/admin/subscriptions"
            lastUpdated={lastLoaded}
            locale={lang}
          />

          {/* ARR Waterfall */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              {lang === "ar"
                ? "شلال الإيراد السنوي — غير شامل الضريبة"
                : "ARR Waterfall — ex-VAT"}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPICard
                tier="standard"
                label={lang === "ar" ? "بداية الفترة" : "Starting ARR"}
                description={desc.startingArr}
                value={fmtSarCompact(waterfall.startingArr)}
                unit={lang === "ar" ? "ر.س" : "SAR"}
                accent="info"
                locale={lang}
              />
              <KPICard
                tier="standard"
                label={lang === "ar" ? "جديد" : "New"}
                description={desc.newArr}
                value={fmtSarCompact(waterfall.newArr)}
                unit={lang === "ar" ? "ر.س" : "SAR"}
                accent="success"
                locale={lang}
              />
              <KPICard
                tier="standard"
                label={lang === "ar" ? "توسع" : "Expansion"}
                description={desc.expansionArr}
                value={fmtSarCompact(waterfall.expansionArr)}
                unit={lang === "ar" ? "ر.س" : "SAR"}
                accent="secondary"
                locale={lang}
              />
              <KPICard
                tier="standard"
                label={lang === "ar" ? "إعادة تفعيل" : "Reactivation"}
                description={desc.reactivationArr}
                value={fmtSarCompact(waterfall.reactivationArr)}
                unit={lang === "ar" ? "ر.س" : "SAR"}
                accent="primary"
                locale={lang}
              />
              <KPICard
                tier="standard"
                label={lang === "ar" ? "انكماش" : "Contraction"}
                description={desc.contractionArr}
                value={fmtSarCompact(waterfall.contractionArr)}
                unit={lang === "ar" ? "ر.س" : "SAR"}
                accent="warning"
                locale={lang}
              />
              <KPICard
                tier="standard"
                label={lang === "ar" ? "إلغاء" : "Churn"}
                description={desc.churnArr}
                value={fmtSarCompact(waterfall.churnArr)}
                unit={lang === "ar" ? "ر.س" : "SAR"}
                accent="destructive"
                locale={lang}
              />
              <KPICard
                tier="standard"
                label={lang === "ar" ? "استرداد / تعديل" : "Refund / Adj"}
                description={desc.refundArr}
                value={fmtSarCompact(waterfall.refundAdjArr)}
                unit={lang === "ar" ? "ر.س" : "SAR"}
                accent="destructive"
                locale={lang}
              />
              <KPICard
                tier="standard"
                label={lang === "ar" ? "نهاية الفترة" : "Ending ARR"}
                description={desc.endingArr}
                value={fmtSarCompact(waterfall.endingArr)}
                unit={lang === "ar" ? "ر.س" : "SAR"}
                accent="info"
                locale={lang}
              />
            </div>

            {/* Waterfall reconciliation alert */}
            {waterfall.reconciliationDrift > 1 && (
              <div className="mt-3 rounded-md border border-warning bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
                <AlertTriangle className="inline h-3.5 w-3.5 me-1" aria-hidden="true" />
                {lang === "ar"
                  ? `تحذير المطابقة: انحراف ${fmtSarCompact(waterfall.reconciliationDrift)} ر.س — يجب أن تساوي الدلتا فرق نقاط البداية والنهاية.`
                  : `Reconciliation drift: ${fmtSarCompact(waterfall.reconciliationDrift)} SAR — deltas must equal Ending − Starting.`}
              </div>
            )}

            {/* Waterfall chart */}
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">
                  {lang === "ar" ? "تصوّر الشلال" : "Waterfall view"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={waterfallChartConfig} className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={waterfallChartData} margin={{ top: 8, right: 16, left: 16, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickFormatter={(v: number) => formatSARCompact(v)}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 10,
                          color: "hsl(var(--popover-foreground))",
                        }}
                        formatter={(v: number) => [formatSARCompact(v), ""]}
                      />
                      <Bar dataKey="value">
                        {waterfallChartData.map((d, i) => (
                          <Cell
                            key={`c-${i}`}
                            fill={
                              d.kind === "endpoint"
                                ? "hsl(var(--info))"
                                : d.value >= 0
                                  ? "hsl(var(--success))"
                                  : "hsl(var(--destructive))"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </section>

          {/* Collections & AR Aging */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              {lang === "ar"
                ? "التحصيل وتقادم الذمم — شامل الضريبة"
                : "Collections & AR Aging — incl. VAT"}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPICard
                tier="standard"
                label={lang === "ar" ? "المحصّل" : "Collected"}
                description={desc.collected}
                value={fmtSarCompact(collected.collectedSarGross)}
                unit={lang === "ar" ? "ر.س" : "SAR"}
                accent="success"
                comparisonPeriod={
                  lang === "ar"
                    ? `من ${fmtSarCompact(collected.billedSarGross)} مُصدر`
                    : `of ${fmtSarCompact(collected.billedSarGross)} billed`
                }
                locale={lang}
              />
              <KPICard
                tier="standard"
                label={lang === "ar" ? "متبقي (0-30)" : "AR 0-30"}
                description={desc.arAging030}
                value={fmtSarCompact(aging.buckets[0]?.sumSarGross ?? 0)}
                unit={lang === "ar" ? "ر.س" : "SAR"}
                accent="info"
                locale={lang}
              />
              <KPICard
                tier="standard"
                label={lang === "ar" ? "متبقي (31-60)" : "AR 31-60"}
                description={desc.arAging3160}
                value={fmtSarCompact(aging.buckets[1]?.sumSarGross ?? 0)}
                unit={lang === "ar" ? "ر.س" : "SAR"}
                accent="warning"
                locale={lang}
              />
              <KPICard
                tier="standard"
                label={lang === "ar" ? "متبقي (61-90)" : "AR 61-90"}
                description={desc.arAging6190}
                value={fmtSarCompact(aging.buckets[2]?.sumSarGross ?? 0)}
                unit={lang === "ar" ? "ر.س" : "SAR"}
                accent="warning"
                locale={lang}
              />
              <KPICard
                tier="standard"
                label={lang === "ar" ? "متبقي (+90)" : "AR 90+"}
                description={desc.arAging90}
                value={fmtSarCompact(aging.buckets[3]?.sumSarGross ?? 0)}
                unit={lang === "ar" ? "ر.س" : "SAR"}
                accent="destructive"
                locale={lang}
              />
              <KPICard
                tier="standard"
                label={
                  lang === "ar"
                    ? "إيراد سنوي معرّض للخطر"
                    : "ARR at risk (failed payment)"
                }
                description={desc.atRiskArr}
                value={fmtSarCompact(atRisk.atRiskArrSar)}
                unit={lang === "ar" ? "ر.س" : "SAR"}
                accent="destructive"
                comparisonPeriod={
                  lang === "ar"
                    ? `${fmtCount(atRisk.count)} اشتراك`
                    : `${fmtCount(atRisk.count)} subs`
                }
                locale={lang}
              />
              <KPICard
                tier="standard"
                label={lang === "ar" ? "اعتماد زاتكا" : "ZATCA Clearance"}
                description={desc.zatcaClearance}
                value={fmtPct(zatca.rate)}
                accent={
                  zatca.alertSpike
                    ? "destructive"
                    : zatca.rate != null && zatca.rate >= 0.99
                      ? "success"
                      : "warning"
                }
                comparisonPeriod={
                  zatca.alertSpike
                    ? lang === "ar"
                      ? "ارتفاع في الرفض — تحقق من التكامل"
                      : "rejection spike — check integration"
                    : undefined
                }
                locale={lang}
              />
            </div>

            {/* AR aging bar chart */}
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">
                  {lang === "ar"
                    ? "توزيع تقادم الذمم"
                    : "AR aging distribution"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={waterfallChartConfig} className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={agingChartData} margin={{ top: 8, right: 16, left: 16, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="bucket" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickFormatter={(v: number) => formatSARCompact(v)}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 10,
                          color: "hsl(var(--popover-foreground))",
                        }}
                        formatter={(v: number) => [formatSARCompact(v), ""]}
                      />
                      <Bar dataKey="value">
                        {agingChartData.map((d, i) => (
                          <Cell
                            key={`a-${i}`}
                            fill={
                              i === 0
                                ? "hsl(var(--info))"
                                : i === 1 || i === 2
                                  ? "hsl(var(--warning))"
                                  : "hsl(var(--destructive))"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </section>

          {/* Tenant Risk Inputs */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              {lang === "ar"
                ? "مؤشرات مخاطر المستأجرين"
                : "Tenant Risk Inputs"}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPICard
                tier="standard"
                label={lang === "ar" ? "متأخرات السداد" : "Past-due"}
                description={desc.pastDue}
                value={fmtCount(risk.pastDueCount)}
                accent="destructive"
                icon={<Wallet className="h-[18px] w-[18px]" />}
                locale={lang}
              />
              <KPICard
                tier="standard"
                label={lang === "ar" ? "بدون دخول مسؤول > 21 يوم" : "Admin no-login > 21d"}
                description={desc.noLoginAdmin}
                value={fmtCount(risk.noLoginAdminCount)}
                accent="warning"
                icon={<ShieldAlert className="h-[18px] w-[18px]" />}
                locale={lang}
              />
              <KPICard
                tier="standard"
                label={lang === "ar" ? "تذاكر P1+ > 14 يوم" : "Open P1+ > 14d"}
                description={desc.openP1Old}
                value={fmtCount(risk.openP1OldCount)}
                accent="warning"
                icon={<Ticket className="h-[18px] w-[18px]" />}
                locale={lang}
              />
              <KPICard
                tier="standard"
                label={lang === "ar" ? "فشل دفع > 2 (30 يوم)" : "Failed pay > 2 in 30d"}
                description={desc.failedPayment}
                value={fmtCount(risk.failedPaymentCount)}
                accent="destructive"
                icon={<TrendingDown className="h-[18px] w-[18px]" />}
                locale={lang}
              />
            </div>
          </section>

          {/* Concentration & Revenue Mix */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              {lang === "ar"
                ? "التركيز ومزيج الإيراد"
                : "Concentration & Revenue Mix"}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPICard
                tier="standard"
                label={lang === "ar" ? "أكبر 5 من الإيراد السنوي" : "Top-5 % of ARR"}
                description={desc.top5}
                value={fmtPct(concentration.top5Pct)}
                accent="warning"
                icon={<PieChart className="h-[18px] w-[18px]" />}
                locale={lang}
              />
              <KPICard
                tier="standard"
                label={lang === "ar" ? "أكبر 10 من الإيراد السنوي" : "Top-10 % of ARR"}
                description={desc.top10}
                value={fmtPct(concentration.top10Pct)}
                accent="info"
                icon={<PieChart className="h-[18px] w-[18px]" />}
                locale={lang}
              />
              <KPICard
                tier="standard"
                label={lang === "ar" ? "تسرّب الخصومات" : "Discount Leakage"}
                description={desc.discountLeakage}
                value={fmtPct(leakage.leakagePct)}
                accent="warning"
                icon={<Tag className="h-[18px] w-[18px]" />}
                locale={lang}
              />
              <KPICard
                tier="standard"
                label={
                  lang === "ar" ? "تحويل التجربة إلى دفع" : "Trial → Paid"
                }
                description={desc.trialConversion}
                value={fmtPct(trial.rate)}
                accent="primary"
                icon={<Sparkles className="h-[18px] w-[18px]" />}
                comparisonPeriod={
                  lang === "ar"
                    ? `من ${fmtCount(trial.denominator)} تجربة`
                    : `of ${fmtCount(trial.denominator)} trials`
                }
                locale={lang}
              />
            </div>
          </section>

          {/* Platform Scale (utility tier — count metrics, not revenue) */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              {lang === "ar" ? "حجم المنصة" : "Platform Scale"}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <KPICard
                tier="utility"
                label={lang === "ar" ? "منظمات نشطة" : "Active Orgs"}
                description={desc.activeOrgs}
                value={fmtCount(stats.orgCount)}
                accent="primary"
                locale={lang}
              />
              <KPICard
                tier="utility"
                label={lang === "ar" ? "المستخدمون" : "Total Users"}
                description={desc.totalUsers}
                value={fmtCount(stats.userCount)}
                accent="info"
                locale={lang}
              />
              <KPICard
                tier="utility"
                label={lang === "ar" ? "الوحدات" : "Properties"}
                description={desc.totalProperties}
                value={fmtCount(stats.propertyCount)}
                accent="secondary"
                locale={lang}
              />
              <KPICard
                tier="utility"
                label={lang === "ar" ? "العقود" : "Contracts"}
                description={desc.totalContracts}
                value={fmtCount(stats.contractCount)}
                accent="primary"
                locale={lang}
              />
              <KPICard
                tier="utility"
                label={lang === "ar" ? "تذاكر مفتوحة" : "Open Tickets"}
                description={desc.openTickets}
                value={fmtCount(stats.openTickets + stats.inProgressTickets)}
                accent="warning"
                locale={lang}
              />
            </div>
          </section>

          {/* 12-mo MRR trend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">
                {lang === "ar"
                  ? "اتجاه الإيراد الشهري — آخر 12 شهراً"
                  : "MRR Trend — last 12 months"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={mrrChartConfig} className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={mrrChartData}
                    margin={{ top: 8, right: 16, left: 16, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickFormatter={(v: number) => formatSARCompact(v)}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 10,
                        color: "hsl(var(--popover-foreground))",
                      }}
                      formatter={(v: number) => [formatSARCompact(v), ""]}
                    />
                    <Line
                      type="monotone"
                      dataKey="total"
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

          {/* Quick Links */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              {lang === "ar" ? "أدوات الإدارة" : "Management Tools"}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {quickLinks.map((item) => (
                <Link key={item.href} href={item.href} className="group">
                  <div className="bg-card border border-border rounded-lg p-5 hover:border-primary/40 hover:shadow-md transition-all duration-200 flex items-center gap-4">
                    <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all duration-200 shrink-0">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground">
                        {item.label[lang]}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {item.desc[lang]}
                      </p>
                    </div>
                    <DirectionalIcon
                      icon={ChevronRight}
                      className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0"
                    />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
