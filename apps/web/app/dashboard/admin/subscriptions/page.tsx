"use client";

import { useLanguage } from "../../../../components/LanguageProvider";
import { useSession } from "../../../../components/SimpleSessionProvider";
import { isSystemRole } from "../../../../lib/permissions";
import * as React from "react";
import {
  ArrowLeft,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Pause,
  Receipt,
  Building2,
  ShieldAlert,
  Search,
} from "lucide-react";
import {
  Button,
  Card,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  AppBar,
  DataCard,
  EmptyState,
  MobileKPICard,
  Skeleton,
  SARAmount,
  Badge,
  DirectionalIcon,
} from "@repo/ui";
import { PageHeader } from "@repo/ui/components/PageHeader";
import Link from "next/link";
import { adminGetAllSubscriptions } from "../../../actions/billing";

// ─── Types ──────────────────────────────────────────────────────────────────

type Subscription = {
  id: string;
  status: string;
  billingCycle: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  priceAtRenewal: number | string | null;
  plan: {
    nameEn: string;
    nameAr: string;
    slug: string;
  };
  organization: {
    id: string;
    name: string;
    nameArabic: string | null;
    crNumber: string | null;
  };
};

type SubscriptionsResult = {
  subscriptions: Subscription[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

// ─── Status Colors ──────────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
  TRIALING: "bg-info/15 text-info",
  ACTIVE: "bg-success/15 text-success",
  PAST_DUE: "bg-warning/15 text-warning",
  CANCELED: "bg-destructive/15 text-destructive",
  UNPAID: "bg-destructive/15 text-destructive",
  PAUSED: "bg-muted text-muted-foreground",
};

const statusIcons: Record<string, React.ReactNode> = {
  TRIALING: <Clock className="h-3.5 w-3.5" />,
  ACTIVE: <CheckCircle2 className="h-3.5 w-3.5" />,
  PAST_DUE: <AlertTriangle className="h-3.5 w-3.5" />,
  CANCELED: <XCircle className="h-3.5 w-3.5" />,
  UNPAID: <XCircle className="h-3.5 w-3.5" />,
  PAUSED: <Pause className="h-3.5 w-3.5" />,
};

// ─── Translations ───────────────────────────────────────────────────────────

const translations = {
  ar: {
    back: "العودة للوحة الإدارة",
    title: "اشتراكات المنظمات",
    subtitle: "عرض وإدارة جميع اشتراكات المنظمات على المنصة",
    total: "الإجمالي",
    active: "نشط",
    trialing: "تجربة",
    pastDue: "متأخر",
    canceled: "ملغى",
    organization: "المنظمة",
    plan: "الخطة",
    status: "الحالة",
    billingCycle: "دورة الفوترة",
    price: "السعر",
    periodEnd: "نهاية الفترة",
    sar: "ر.س",
    noSubscriptions: "لا توجد اشتراكات حالياً",
    noSubscriptionsDesc: "لم يتم تسجيل أي اشتراكات بعد",
    page: "صفحة",
    of: "من",
    prev: "السابق",
    next: "التالي",
    loading: "جاري التحميل...",
    crNumber: "س.ت",
    statuses: {
      TRIALING: "تجربة مجانية",
      ACTIVE: "نشط",
      PAST_DUE: "متأخر",
      CANCELED: "ملغى",
      UNPAID: "غير مدفوع",
      PAUSED: "متوقف",
    } as Record<string, string>,
    cycles: {
      MONTHLY: "شهري",
      QUARTERLY: "ربع سنوي",
      SEMI_ANNUAL: "نصف سنوي",
      ANNUAL: "سنوي",
    } as Record<string, string>,
  },
  en: {
    back: "Back to Admin",
    title: "Organization Subscriptions",
    subtitle: "View and manage all organization subscriptions on the platform",
    total: "Total",
    active: "Active",
    trialing: "Trialing",
    pastDue: "Past Due",
    canceled: "Canceled",
    organization: "Organization",
    plan: "Plan",
    status: "Status",
    billingCycle: "Billing Cycle",
    price: "Price",
    periodEnd: "Period End",
    sar: "SAR",
    noSubscriptions: "No subscriptions yet",
    noSubscriptionsDesc: "No subscriptions have been recorded",
    page: "Page",
    of: "of",
    prev: "Previous",
    next: "Next",
    loading: "Loading...",
    crNumber: "CR",
    statuses: {
      TRIALING: "Trialing",
      ACTIVE: "Active",
      PAST_DUE: "Past Due",
      CANCELED: "Canceled",
      UNPAID: "Unpaid",
      PAUSED: "Paused",
    } as Record<string, string>,
    cycles: {
      MONTHLY: "Monthly",
      QUARTERLY: "Quarterly",
      SEMI_ANNUAL: "Semi-Annual",
      ANNUAL: "Annual",
    } as Record<string, string>,
  },
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function AdminSubscriptionsPage() {
  const { lang } = useLanguage();
  const { data: session } = useSession();
  const userRole = session?.user?.role ?? "";
  const authorized = isSystemRole(userRole);
  const [data, setData] = React.useState<SubscriptionsResult | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [mobileSearch, setMobileSearch] = React.useState("");
  const pageSize = 20;

  React.useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const result = await adminGetAllSubscriptions(page, pageSize);
        if (active) setData(result);
      } catch (error) {
        if (active) console.error("Failed to load subscriptions:", error);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [page]);

  const t = translations[lang];

  // ─── Computed stats ─────────────────────────────────────────────────────

  const stats = React.useMemo(() => {
    if (!data) return { total: 0, active: 0, trialing: 0, pastDue: 0, canceled: 0 };
    const subs = data.subscriptions;
    return {
      total: data.total,
      active: subs.filter((s) => s.status === "ACTIVE").length,
      trialing: subs.filter((s) => s.status === "TRIALING").length,
      pastDue: subs.filter((s) => s.status === "PAST_DUE").length,
      canceled: subs.filter((s) => s.status === "CANCELED").length,
    };
  }, [data]);

  // ─── Helpers ────────────────────────────────────────────────────────────

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "--";
    return new Date(dateStr).toLocaleDateString(
      lang === "ar" ? "ar-SA" : "en-US",
      { year: "numeric", month: "short", day: "numeric" }
    );
  };

  const formatPrice = (price: number | string | null) => {
    if (price == null) return "--";
    return `${Number(price).toLocaleString(lang === "ar" ? "ar-SA" : "en-US")} ${t.sar}`;
  };

  const getOrgDisplayName = (org: Subscription["organization"]) => {
    if (lang === "ar" && org.nameArabic) return org.nameArabic;
    return org.name;
  };

  // ─── Loading State ──────────────────────────────────────────────────────

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const subscriptions = data?.subscriptions ?? [];
  const totalPages = data?.totalPages ?? 1;

  // ── Mobile helpers ──────────────────────────────────────────────────────
  const mrr = subscriptions
    .filter((s) => s.status === "ACTIVE")
    .reduce((sum, s) => {
      const price = Number(s.priceAtRenewal ?? 0);
      if (!price) return sum;
      const cycle = s.billingCycle;
      if (cycle === "MONTHLY") return sum + price;
      if (cycle === "QUARTERLY") return sum + price / 3;
      if (cycle === "SEMI_ANNUAL") return sum + price / 6;
      if (cycle === "ANNUAL") return sum + price / 12;
      return sum + price;
    }, 0);
  const churnRate =
    stats.total > 0
      ? Math.round((stats.canceled / stats.total) * 1000) / 10
      : 0;

  const subStatusVariant = (s: string): "success" | "info" | "warning" | "error" | "default" => {
    if (s === "ACTIVE") return "success";
    if (s === "TRIALING") return "info";
    if (s === "PAST_DUE") return "warning";
    if (s === "CANCELED" || s === "UNPAID") return "error";
    return "default";
  };

  const filteredMobile = mobileSearch.trim()
    ? subscriptions.filter((s) => {
        const q = mobileSearch.trim().toLowerCase();
        return (
          s.organization.name.toLowerCase().includes(q) ||
          (s.organization.nameArabic ?? "").toLowerCase().includes(q)
        );
      })
    : subscriptions;

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <>
    {/* ─── Mobile (< md) ─────────────────────────────────────────────── */}
    <div
      className="md:hidden -m-4 sm:-m-6 min-h-dvh flex flex-col bg-background"
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <AppBar title={lang === "ar" ? "الاشتراكات" : "Subscriptions"} lang={lang} />

      {!authorized ? (
        <div className="flex-1 px-4 pt-10">
          <EmptyState
            icon={<ShieldAlert className="h-10 w-10" aria-hidden="true" />}
            title={lang === "ar" ? "غير مصرح" : "Unauthorized"}
            description={
              lang === "ar"
                ? "هذه الصفحة متاحة لفريق المنصة فقط."
                : "This page is available to platform staff only."
            }
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 px-4 pt-3">
            <MobileKPICard
              label={lang === "ar" ? "نشطة" : "Active"}
              value={<span className="tabular-nums">{stats.active}</span>}
              tone="green"
            />
            <MobileKPICard
              label={lang === "ar" ? "تجريبية" : "Trialing"}
              value={<span className="tabular-nums">{stats.trialing}</span>}
              tone="blue"
            />
            <MobileKPICard
              label={lang === "ar" ? "MRR" : "MRR"}
              value={<SARAmount value={mrr} size={18} compact className="tabular-nums" />}
              tone="primary"
            />
            <MobileKPICard
              label={lang === "ar" ? "معدل الانسحاب" : "Churn rate"}
              value={<span className="tabular-nums">{churnRate}%</span>}
              tone="amber"
            />
          </div>

          <div className="px-4 pt-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                type="text"
                value={mobileSearch}
                onChange={(e) => setMobileSearch(e.target.value)}
                placeholder={lang === "ar" ? "بحث باسم المنظمة..." : "Search by organization..."}
                className="h-11 w-full rounded-md border border-input bg-background ps-9 pe-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <div className="flex-1 px-4 pb-24 pt-3">
            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
            ) : filteredMobile.length === 0 ? (
              <EmptyState
                icon={<Receipt className="h-10 w-10 text-primary" aria-hidden="true" />}
                title={t.noSubscriptions}
                description={t.noSubscriptionsDesc}
              />
            ) : (
              <div className="rounded-2xl border border-border bg-card px-4">
                {filteredMobile.map((sub, idx) => {
                  const orgName = getOrgDisplayName(sub.organization);
                  const planName = lang === "ar" ? sub.plan.nameAr : sub.plan.nameEn;
                  const renewal = formatDate(sub.currentPeriodEnd);
                  const priceNum =
                    sub.priceAtRenewal != null ? Number(sub.priceAtRenewal) : null;
                  return (
                    <DataCard
                      key={sub.id}
                      icon={Building2}
                      iconTone="purple"
                      title={orgName}
                      subtitle={
                        <span className="inline-flex items-center gap-2">
                          <span className="truncate">{planName}</span>
                          <Badge variant={subStatusVariant(sub.status)} size="sm">
                            {t.statuses[sub.status] ?? sub.status}
                          </Badge>
                          <span className="text-muted-foreground">{renewal}</span>
                        </span>
                      }
                      trailing={
                        <SARAmount value={priceNum} size={14} compact className="tabular-nums" />
                      }
                      divider={idx !== filteredMobile.length - 1}
                    />
                  );
                })}
              </div>
            )}

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="min-h-11 rounded-md border border-border px-3 py-1.5 font-medium disabled:opacity-40"
                >
                  {t.prev}
                </button>
                <span className="tabular-nums">{page} / {totalPages}</span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="min-h-11 rounded-md border border-border px-3 py-1.5 font-medium disabled:opacity-40"
                >
                  {t.next}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>

    {/* ─── Desktop (≥ md) ─ unchanged ───────────────────────────────── */}
    <div className="hidden md:block">
    <div className="space-y-6" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* Back Link + Language Toggle */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/admin"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <DirectionalIcon icon={ArrowLeft} className="h-4 w-4" />
          {t.back}
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10 shrink-0">
          <CreditCard className="h-6 w-6 text-primary" />
        </div>
        <PageHeader className="flex-1" title={t.title} description={t.subtitle} />
      </div>

      {/* Summary Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{t.total}</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span className="text-xs text-muted-foreground">{t.active}</span>
          </div>
          <p className="text-2xl font-bold text-success">{stats.active}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-info" />
            <span className="text-xs text-muted-foreground">{t.trialing}</span>
          </div>
          <p className="text-2xl font-bold text-info">{stats.trialing}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <span className="text-xs text-muted-foreground">{t.pastDue}</span>
          </div>
          <p className="text-2xl font-bold text-warning">{stats.pastDue}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="h-4 w-4 text-destructive" />
            <span className="text-xs text-muted-foreground">{t.canceled}</span>
          </div>
          <p className="text-2xl font-bold text-destructive">{stats.canceled}</p>
        </Card>
      </div>

      {/* Subscriptions Table */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.organization}</TableHead>
              <TableHead>{t.plan}</TableHead>
              <TableHead>{t.status}</TableHead>
              <TableHead>{t.billingCycle}</TableHead>
              <TableHead>{t.price}</TableHead>
              <TableHead>{t.periodEnd}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                    {t.loading}
                  </div>
                </TableCell>
              </TableRow>
            ) : subscriptions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-16 text-center">
                  <Receipt className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-muted-foreground font-medium">{t.noSubscriptions}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t.noSubscriptionsDesc}</p>
                </TableCell>
              </TableRow>
            ) : (
              subscriptions.map((sub) => (
                <TableRow key={sub.id}>
                  {/* Organization */}
                  <TableCell>
                    <div className="font-medium text-foreground">
                      {getOrgDisplayName(sub.organization)}
                    </div>
                    {sub.organization.crNumber && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {t.crNumber}: {sub.organization.crNumber}
                      </div>
                    )}
                  </TableCell>

                  {/* Plan */}
                  <TableCell>
                    <span className="font-medium text-foreground">
                      {lang === "ar" ? sub.plan.nameAr : sub.plan.nameEn}
                    </span>
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[sub.status] ?? "bg-muted text-muted-foreground"}`}
                    >
                      {statusIcons[sub.status]}
                      {t.statuses[sub.status] ?? sub.status}
                    </span>
                  </TableCell>

                  {/* Billing Cycle */}
                  <TableCell className="text-muted-foreground">
                    {t.cycles[sub.billingCycle] ?? sub.billingCycle}
                  </TableCell>

                  {/* Price */}
                  <TableCell className="font-medium text-foreground">
                    {formatPrice(sub.priceAtRenewal)}
                  </TableCell>

                  {/* Period End */}
                  <TableCell className="text-muted-foreground">
                    {formatDate(sub.currentPeriodEnd)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {t.page} {page} {t.of} {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
             
            >
              <DirectionalIcon icon={ChevronLeft} className="h-3.5 w-3.5 me-1" />
              {t.prev}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
             
            >
              {t.next}
              <DirectionalIcon icon={ChevronRight} className="h-3.5 w-3.5 ms-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
    </div>
    </>
  );
}
