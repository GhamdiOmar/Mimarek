"use client";

import * as React from "react";
import {
  Building2, Users, Home, FileText, CheckCircle, Clock, AlertCircle,
  XCircle, Receipt, BadgeDollarSign, TrendingUp, Ticket,
  ListChecks, Tag, SearchCheck, Settings, ChevronRight, ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import {
  AppBar,
  EmptyState,
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
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useLanguage } from "../../../components/LanguageProvider";
import { useSession } from "../../../components/SimpleSessionProvider";
import { isSystemRole } from "../../../lib/permissions";
import { adminGetPlatformStats } from "../../actions/admin-stats";
import { getMrrTrend } from "../../actions/trends/getMrrTrend";

type Stats = Awaited<ReturnType<typeof adminGetPlatformStats>>;

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: { ar: string; en: string };
  value: number | string;
  icon: React.ElementType;
  color: string;
}) {
  const { lang } = useLanguage();
  return (
    <div className="bg-card border border-border rounded-lg p-5 flex items-center gap-4 shadow-sm">
      <div className={`h-11 w-11 rounded-md flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label[lang]}</p>
      </div>
    </div>
  );
}

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

export default function SystemAdminPage() {
  const { lang } = useLanguage();
  const { data: session } = useSession();
  const userRole = session?.user?.role ?? "";
  const authorized = isSystemRole(userRole);
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [mrrTrend, setMrrTrend] = React.useState<number[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [lastLoaded, setLastLoaded] = React.useState<Date>(new Date());

  const load = React.useCallback(async () => {
    if (!authorized) return;
    setLoading(true);
    try {
      const [s, t] = await Promise.all([adminGetPlatformStats(), getMrrTrend()]);
      setStats(s);
      setMrrTrend(t);
      setLastLoaded(new Date());
    } finally {
      setLoading(false);
    }
  }, [authorized]);

  React.useEffect(() => {
    load();
  }, [load]);

  const fmt = (n: number) => n.toLocaleString("en-US");

  const mrrData = React.useMemo(() => {
    const now = new Date();
    return mrrTrend.map((total, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      return {
        month: d.toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", {
          month: "short",
        }),
        total,
      };
    });
  }, [mrrTrend, lang]);

  const chartConfig: ChartConfig = {
    total: { label: lang === "ar" ? "الإيراد الشهري" : "Monthly revenue" },
  };

  return (
    <>
      {/* ─── Mobile (< md) ─────────────────────────────────────────────── */}
      <div
        className="md:hidden -m-4 sm:-m-6 min-h-dvh flex flex-col bg-background"
        dir={lang === "ar" ? "rtl" : "ltr"}
      >
        <AppBar
          title={lang === "ar" ? "الإدارة" : "Admin"}
          lang={lang}
        />
        {!authorized ? (
          <div className="flex-1 px-4 pt-10">
            <EmptyState
              icon={<ShieldAlert className="h-10 w-10" aria-hidden="true" />}
              title={lang === "ar" ? "غير مصرح" : "Unauthorized"}
              description={
                lang === "ar"
                  ? "هذه الصفحة متاحة لفريق منصة ممعاريك فقط."
                  : "This page is available to the Mimaric platform team only."
              }
            />
          </div>
        ) : (
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
        )}
      </div>

    {/* ─── Desktop (≥ md) ─ unchanged ───────────────────────────────── */}
    <div className="hidden md:block">
    <div className="space-y-8 animate-in fade-in duration-500" dir={lang === "ar" ? "rtl" : "ltr"}>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center text-primary">
            <Settings className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {lang === "ar" ? "إدارة المنصة" : "Platform Administration"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {lang === "ar" ? "نظرة عامة على الإحصاءات والوصول إلى أدوات الإدارة" : "Platform-wide statistics and management tools"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DateRangePicker locale={lang} />
          <LastUpdatedAgo timestamp={lastLoaded} locale={lang} onRefresh={load} />
        </div>
      </div>

      {/* North Star — Active Orgs hero card (§ 6.9.1) */}
      <KPICard
        tier="hero"
        label={lang === "ar" ? "المنظمات العميلة" : "Active Client Orgs"}
        value={loading || !stats ? "—" : fmt(stats.orgCount)}
        icon={<Building2 className="h-[18px] w-[18px]" />}
        accent="primary"
        comparisonPeriod={lang === "ar" ? "حالياً" : "currently active"}
        secondaryInsight={
          !loading && stats
            ? lang === "ar"
              ? `${fmt(stats.activeSubscriptions)} اشتراك نشط · ${fmt(stats.trialingSubscriptions)} في الفترة التجريبية`
              : `${fmt(stats.activeSubscriptions)} active subscriptions · ${fmt(stats.trialingSubscriptions)} trialing`
            : undefined
        }
        trend={mrrTrend}
        href="/dashboard/admin/subscriptions"
        lastUpdated={lastLoaded}
        locale={lang}
        loading={loading}
      />

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-lg p-5 h-[88px] animate-pulse" />
          ))}
        </div>
      ) : stats && (
        <>
          {/* Row 1: Platform Scale */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              {lang === "ar" ? "حجم المنصة" : "Platform Scale"}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label={{ ar: "إجمالي المستخدمين", en: "Total Users" }} value={fmt(stats.userCount)} icon={Users} color="bg-blue-500/10 text-blue-500" />
              <StatCard label={{ ar: "إجمالي الوحدات", en: "Total Properties" }} value={fmt(stats.propertyCount)} icon={Home} color="bg-indigo-500/10 text-indigo-500" />
              <StatCard label={{ ar: "إجمالي العقود", en: "Total Contracts" }} value={fmt(stats.contractCount)} icon={FileText} color="bg-violet-500/10 text-violet-500" />
              <StatCard label={{ ar: "تذاكر مفتوحة", en: "Open Tickets" }} value={fmt(stats.openTickets + stats.inProgressTickets)} icon={Ticket} color="bg-orange-500/10 text-orange-500" />
            </div>
          </section>

          {/* Row 2: Subscription Health */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              {lang === "ar" ? "صحة الاشتراكات" : "Subscription Health"}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label={{ ar: "اشتراكات نشطة", en: "Active" }} value={fmt(stats.activeSubscriptions)} icon={CheckCircle} color="bg-green-500/10 text-green-500" />
              <StatCard label={{ ar: "فترة تجريبية", en: "Trialing" }} value={fmt(stats.trialingSubscriptions)} icon={Clock} color="bg-blue-500/10 text-blue-500" />
              <StatCard label={{ ar: "متأخرة الدفع", en: "Past Due" }} value={fmt(stats.pastDueSubscriptions)} icon={AlertCircle} color="bg-amber-500/10 text-amber-500" />
              <StatCard label={{ ar: "ملغاة", en: "Canceled" }} value={fmt(stats.canceledSubscriptions)} icon={XCircle} color="bg-muted text-muted-foreground" />
            </div>
          </section>

          {/* Row 3: Billing Health */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              {lang === "ar" ? "صحة الفوترة" : "Billing Health"}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard label={{ ar: "فواتير مدفوعة", en: "Paid Invoices" }} value={fmt(stats.paidInvoices)} icon={BadgeDollarSign} color="bg-green-500/10 text-green-500" />
              <StatCard label={{ ar: "فواتير غير مدفوعة", en: "Unpaid Invoices" }} value={fmt(stats.unpaidInvoices)} icon={TrendingUp} color="bg-amber-500/10 text-amber-500" />
              <StatCard label={{ ar: "فواتير متأخرة", en: "Overdue Invoices" }} value={fmt(stats.overdueInvoices)} icon={AlertCircle} color="bg-red-500/10 text-red-500" />
            </div>
          </section>

          {/* MRR trend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">
                {lang === "ar" ? "إيرادات المنصة — آخر 12 شهرًا" : "Platform Revenue — last 12 months"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={mrrData}
                    margin={{ top: 8, right: 16, left: 16, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="month"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickFormatter={(v: number) =>
                        v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)
                      }
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 10,
                        color: "hsl(var(--popover-foreground))",
                      }}
                      formatter={(v: number) => [fmt(v), ""]}
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
        </>
      )}

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
                  <p className="font-semibold text-sm text-foreground">{item.label[lang]}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.desc[lang]}</p>
                </div>
                <DirectionalIcon icon={ChevronRight} className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
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
