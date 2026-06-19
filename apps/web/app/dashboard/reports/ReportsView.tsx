"use client";

import * as React from "react";
import {
  Download,
  Loader2,
  DollarSign,
  Building2,
  Receipt,
  Wrench,
  Sheet,
  ChevronRight,
  Search,
  type LucideIcon,
} from "lucide-react";
import {
  Button,
  Badge,
  PageIntro,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  AppBar,
  Input,
  EmptyState,
  HijriDatePicker,
  cn,
} from "@repo/ui";
import { useLanguage } from "../../../components/LanguageProvider";
import {
  getRevenueReport,
  getOccupancyReport,
  getRentCollectionReport,
  getMaintenanceReport,
  getMaintenanceCostReport,
} from "../../actions/reports";
import { generateReportPDF } from "../../../lib/report-pdf";
import { exportToExcel } from "../../../lib/export";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-SA", { maximumFractionDigits: 0 }).format(n);

const MONTH_NAMES: Record<string, string> = {
  "01": "يناير", "02": "فبراير", "03": "مارس", "04": "أبريل",
  "05": "مايو", "06": "يونيو", "07": "يوليو", "08": "أغسطس",
  "09": "سبتمبر", "10": "أكتوبر", "11": "نوفمبر", "12": "ديسمبر",
};

function getDefaultDateRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: start.toISOString().split("T")[0] as string,
    end: end.toISOString().split("T")[0] as string,
  };
}

interface ReportDef {
  id: string;
  name: string;
  nameEn: string;
  desc: string;
  descEn: string;
  type: string;
  typeEn: string;
  icon: LucideIcon;
}

const REPORTS: ReportDef[] = [
  {
    id: "revenue",
    name: "تقرير الإيرادات",
    nameEn: "Revenue Report",
    desc: "إجمالي الإيرادات من الإيجارات والمبيعات مع التوزيع الشهري",
    descEn: "Total rental and sales revenue with monthly breakdown",
    type: "مالي",
    typeEn: "Financial",
    icon: DollarSign,
  },
  {
    id: "occupancy",
    name: "تقرير الإشغال",
    nameEn: "Occupancy Report",
    desc: "معدلات الإشغال حسب المشروع والوحدات الشاغرة والمؤجرة",
    descEn: "Occupancy rates per project with vacant and leased units",
    type: "تشغيلي",
    typeEn: "Operational",
    icon: Building2,
  },
  {
    id: "collection",
    name: "تقرير التحصيل",
    nameEn: "Rent Collection Report",
    desc: "تفاصيل تحصيل الإيجارات وتقادم المتأخرات حسب العميل",
    descEn: "Rent collection details and overdue aging per customer",
    type: "مالي",
    typeEn: "Financial",
    icon: Receipt,
  },
  {
    id: "maintenance",
    name: "تقرير الصيانة",
    nameEn: "Maintenance Report",
    desc: "ملخص طلبات الصيانة والأولويات ومتوسط وقت الحل",
    descEn: "Maintenance requests, priorities and avg resolution time",
    type: "تشغيلي",
    typeEn: "Operational",
    icon: Wrench,
  },
  {
    id: "maintenance-costs",
    name: "تقرير تكاليف الصيانة",
    nameEn: "Maintenance Cost Report",
    desc: "تحليل التكاليف الفعلية مقابل التقديرية",
    descEn: "Actual vs estimated maintenance cost analysis",
    type: "مالي",
    typeEn: "Financial",
    icon: Wrench,
  },
];

interface ReportGroup {
  id: string;
  heading: string;
  headingEn: string;
  question: string;
  questionEn: string;
  reportIds: string[];
}

const REPORT_GROUPS: ReportGroup[] = [
  {
    id: "financial",
    heading: "الأداء المالي",
    headingEn: "Financial Performance",
    question: "كيف يؤدّي المحفظة مالياً؟",
    questionEn: "How is the portfolio performing financially?",
    reportIds: ["revenue", "collection", "maintenance-costs"],
  },
  {
    id: "operations",
    heading: "التشغيل والاستخدام",
    headingEn: "Operations & Utilization",
    question: "كيف تُشغَّل المحفظة وتُصان؟",
    questionEn: "How is the portfolio being utilized & serviced?",
    reportIds: ["occupancy", "maintenance"],
  },
];

export default function ReportsView({ loadedAt }: { loadedAt: string }) {
  const { t, lang } = useLanguage();
  const defaults = getDefaultDateRange();
  const [startDate, setStartDate] = React.useState(defaults.start);
  const [endDate, setEndDate] = React.useState(defaults.end);
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const [mobileSearch, setMobileSearch] = React.useState("");

  // loadedAt is available for future use (e.g. LastUpdatedAgo) — kept for
  // pattern parity with FinanceView without wiring it to UI today.
  void loadedAt;

  const mobileFiltered = React.useMemo(() => {
    if (!mobileSearch) return REPORTS;
    const q = mobileSearch.toLowerCase();
    return REPORTS.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.nameEn.toLowerCase().includes(q) ||
        r.desc.toLowerCase().includes(q) ||
        r.descEn.toLowerCase().includes(q)
    );
  }, [mobileSearch]);

  /** Build grouped structure for mobile, preserving search filter. */
  const mobileGroups = React.useMemo(() => {
    return REPORT_GROUPS.map((group) => ({
      ...group,
      reports: group.reportIds
        .map((id) => mobileFiltered.find((r) => r.id === id))
        .filter((r): r is ReportDef => r !== undefined),
    })).filter((g) => g.reports.length > 0);
  }, [mobileFiltered]);

  /** Build grouped structure for desktop (no search filter needed). */
  const desktopGroups = React.useMemo(() => {
    return REPORT_GROUPS.map((group) => ({
      ...group,
      reports: group.reportIds
        .map((id) => REPORTS.find((r) => r.id === id))
        .filter((r): r is ReportDef => r !== undefined),
    }));
  }, []);

  const dateRange = `${startDate} → ${endDate}`;

  async function handlePDF(reportId: string) {
    setLoadingId(reportId + "-pdf");
    try {
      if (reportId === "revenue") {
        const data = await getRevenueReport(startDate, endDate);
        await generateReportPDF({
          title: "تقرير الإيرادات",
          subtitle: "Revenue Report",
          dateRange,
          sections: [
            {
              title: "ملخص الإيرادات",
              rows: [
                { label: "إيرادات الإيجار", value: `${fmt(data.rentTotal)} ر.س` },
                { label: "إيرادات المبيعات", value: `${fmt(data.salesTotal)} ر.س` },
                { label: "الإجمالي", value: `${fmt(data.combined)} ر.س` },
                { label: "التغيير عن الفترة السابقة", value: `${data.changePercent}%` },
              ],
            },
            {
              title: "التوزيع الشهري",
              rows: data.months.map((m) => ({
                label: MONTH_NAMES[m.month.split("-")[1] ?? ""] ?? m.month,
                value: `${fmt(m.total)} ر.س`,
              })),
            },
            {
              title: "أعلى 5 وحدات إيراداً",
              rows: data.topUnits.map((u, i) => ({
                label: `${i + 1}. ${u.unit}`,
                value: `${fmt(u.revenue)} ر.س`,
              })),
            },
          ],
        });
      } else if (reportId === "occupancy") {
        const data = await getOccupancyReport(startDate, endDate);
        await generateReportPDF({
          title: "تقرير الإشغال",
          subtitle: "Occupancy Report",
          dateRange,
          sections: [
            {
              title: "ملخص عام",
              rows: [
                { label: "إجمالي الوحدات", value: String(data.totalUnits) },
                { label: "الوحدات المشغولة", value: String(data.totalOccupied) },
                { label: "نسبة الإشغال الكلية", value: `${data.overallRate}%` },
              ],
            },
            {
              title: "حسب المشروع",
              rows: data.projects.map((p: { name: string; occupied: number; total: number; rate: number }) => ({
                label: p.name,
                value: `${p.occupied}/${p.total} (${p.rate}%)`,
              })),
            },
          ],
        });
      } else if (reportId === "collection") {
        const data = await getRentCollectionReport(startDate, endDate);
        await generateReportPDF({
          title: "تقرير تحصيل الإيجارات",
          subtitle: "Rent Collection Report",
          dateRange,
          sections: [
            {
              title: "ملخص التحصيل",
              rows: [
                { label: "المستحق", value: `${fmt(data.totalDue)} ر.س` },
                { label: "المحصّل", value: `${fmt(data.totalCollected)} ر.س` },
                { label: "نسبة التحصيل", value: `${data.collectionRate}%` },
                { label: "عدد المتأخرات", value: String(data.overdueCount) },
                { label: "مبلغ المتأخرات", value: `${fmt(data.overdueAmount)} ر.س` },
              ],
            },
            {
              title: "تقادم المتأخرات",
              rows: [
                { label: "0-30 يوم", value: `${fmt(data.aging["0-30"])} ر.س` },
                { label: "31-60 يوم", value: `${fmt(data.aging["31-60"])} ر.س` },
                { label: "61-90 يوم", value: `${fmt(data.aging["61-90"])} ر.س` },
                { label: "90+ يوم", value: `${fmt(data.aging["90+"])} ر.س` },
              ],
            },
          ],
        });
      } else if (reportId === "maintenance") {
        const data = await getMaintenanceReport(startDate, endDate);
        await generateReportPDF({
          title: "تقرير الصيانة",
          subtitle: "Maintenance Report",
          dateRange,
          sections: [
            {
              title: "ملخص الطلبات",
              rows: [
                { label: "إجمالي الطلبات", value: String(data.total) },
                { label: "تم الحل", value: String(data.resolved) },
                { label: "قيد التنفيذ", value: String(data.inProgress) },
                { label: "مفتوحة", value: String(data.open) },
                { label: "متوسط وقت الحل (أيام)", value: String(data.avgResolutionDays) },
              ],
            },
            {
              title: "حسب الأولوية",
              rows: Object.entries(data.priorities).map(([p, v]) => ({
                label: p === "HIGH" ? "عالية" : p === "MEDIUM" ? "متوسطة" : p === "LOW" ? "منخفضة" : p === "CRITICAL" ? "حرجة" : p,
                value: `${v.total} (${v.resolved} محلولة)`,
              })),
            },
          ],
        });
      } else if (reportId === "maintenance-costs") {
        const data = await getMaintenanceCostReport(startDate, endDate);
        await generateReportPDF({
          title: "تقرير تكاليف الصيانة",
          subtitle: "Maintenance Cost Report",
          dateRange,
          sections: [
            {
              title: "ملخص",
              rows: [
                { label: "عدد الطلبات", value: data.totalRequests.toString() },
                { label: "التكلفة التقديرية (ر.س)", value: fmt(data.totalEstimated) },
                { label: "التكلفة الفعلية (ر.س)", value: fmt(data.totalActual) },
                { label: "الفرق (ر.س)", value: fmt(data.variance) },
                { label: "ساعات العمل", value: data.totalLaborHours.toString() },
              ],
            },
            {
              title: "حسب التصنيف",
              rows: data.byCategory.map((c: { category: string; count: number; actual: number }) => ({
                label: c.category,
                value: `${c.count} طلب — ${fmt(c.actual)} ر.س`,
              })),
            },
            {
              title: "حسب المبنى",
              // `costPerSqm` is not present on the report row shape; the read
              // resolves to `undefined` at runtime today — typed optional to
              // preserve that exact rendering without a behavior change.
              rows: data.byBuilding.map((b: { name: string; actual: number; costPerSqm?: number | string }) => ({
                label: b.name,
                value: `${fmt(b.actual)} ر.س (${b.costPerSqm} ر.س/م²)`,
              })),
            },
          ],
        });
      }
    } catch (e) {
      console.error("Report generation failed:", e);
    } finally {
      setLoadingId(null);
    }
  }

  async function handleExcel(reportId: string) {
    setLoadingId(reportId + "-excel");
    try {
      if (reportId === "revenue") {
        const data = await getRevenueReport(startDate, endDate);
        await exportToExcel({
          data: data.months,
          columns: [
            { header: "الشهر", key: "month", render: (v: string) => MONTH_NAMES[v?.split("-")[1] ?? ""] ?? v },
            { header: "إيجارات", key: "rent", render: (v: number) => fmt(v) },
            { header: "مبيعات", key: "sales", render: (v: number) => fmt(v) },
            { header: "الإجمالي", key: "total", render: (v: number) => fmt(v) },
          ],
          filename: "revenue-report",
          title: "تقرير الإيرادات",
        });
      } else if (reportId === "occupancy") {
        const data = await getOccupancyReport(startDate, endDate);
        await exportToExcel({
          data: data.projects,
          columns: [
            { header: "المشروع", key: "name" },
            { header: "إجمالي الوحدات", key: "total" },
            { header: "مشغولة", key: "occupied" },
            { header: "شاغرة", key: "vacant" },
            { header: "نسبة الإشغال %", key: "rate" },
          ],
          filename: "occupancy-report",
          title: "تقرير الإشغال",
        });
      } else if (reportId === "collection") {
        const data = await getRentCollectionReport(startDate, endDate);
        await exportToExcel({
          data: data.customers,
          columns: [
            { header: "العميل", key: "name" },
            { header: "الوحدة", key: "unit" },
            { header: "المستحق", key: "due", render: (v: number) => fmt(v) },
            { header: "المسدد", key: "paid", render: (v: number) => fmt(v) },
            { header: "الحالة", key: "status" },
          ],
          filename: "collection-report",
          title: "تقرير تحصيل الإيجارات",
        });
      } else if (reportId === "maintenance") {
        const data = await getMaintenanceReport(startDate, endDate);
        const rows = Object.entries(data.priorities).map(([p, v]) => ({
          priority: p === "HIGH" ? "عالية" : p === "MEDIUM" ? "متوسطة" : p === "LOW" ? "منخفضة" : p === "CRITICAL" ? "حرجة" : p,
          ...v,
        }));
        await exportToExcel({
          data: rows,
          columns: [
            { header: "الأولوية", key: "priority" },
            { header: "الإجمالي", key: "total" },
            { header: "تم الحل", key: "resolved" },
            { header: "مفتوحة", key: "open" },
          ],
          filename: "maintenance-report",
          title: "تقرير الصيانة",
        });
      } else if (reportId === "maintenance-costs") {
        const data = await getMaintenanceCostReport(startDate, endDate);
        await exportToExcel({
          data: data.byCategory,
          columns: [
            { header: "التصنيف", key: "category" },
            { header: "عدد الطلبات", key: "count" },
            { header: "تقديري", key: "estimated", render: (v: number) => fmt(v) },
            { header: "فعلي", key: "actual", render: (v: number) => fmt(v) },
          ],
          filename: "maintenance-cost-report",
          title: "تقرير تكاليف الصيانة",
        });
      }
    } catch (e) {
      console.error("Excel export failed:", e);
    } finally {
      setLoadingId(null);
    }
  }

  const datePickerActions = (
    <div className="flex items-center gap-3">
      <label htmlFor="reports-start-date" className="sr-only">
        {t("تاريخ البداية", "Start date")}
      </label>
      <HijriDatePicker
        id="reports-start-date"
        locale={lang === "ar" ? "ar" : "en"}
        value={startDate ? new Date(startDate) : null}
        onChange={(d) => setStartDate(d ? d.toISOString().slice(0, 10) : "")}
        className="w-auto bg-card"
      />
      <span className="text-muted-foreground text-sm" aria-hidden="true">إلى</span>
      <label htmlFor="reports-end-date" className="sr-only">
        {t("تاريخ النهاية", "End date")}
      </label>
      <HijriDatePicker
        id="reports-end-date"
        locale={lang === "ar" ? "ar" : "en"}
        value={endDate ? new Date(endDate) : null}
        onChange={(d) => setEndDate(d ? d.toISOString().slice(0, 10) : "")}
        className="w-auto bg-card"
      />
    </div>
  );

  return (
    <>
    {/* ─── Mobile (< md) ─────────────────────────────────────────────── */}
    <div
      className="md:hidden -m-4 sm:-m-6 min-h-dvh flex flex-col bg-background"
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <AppBar title={t("التقارير", "Reports")} lang={lang} />

      <div className="px-4 pt-3">
        <div className="relative">
          <svg
            className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground start-3"
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <Input
            value={mobileSearch}
            onChange={(e) => setMobileSearch(e.target.value)}
            placeholder={t("ابحث في التقارير...", "Search reports...")}
            className="h-10 ps-9"
          />
        </div>
      </div>

      <div className="flex-1 px-4 pb-24 pt-3 space-y-6">
        {mobileGroups.map((group) => (
          <div key={group.id}>
            {/* Group heading — shown even during search as long as group has results */}
            <div className="mb-2 pb-2 border-b border-border">
              <p className="text-xs font-bold text-foreground">
                {lang === "ar" ? group.heading : group.headingEn}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {lang === "ar" ? group.question : group.questionEn}
              </p>
            </div>

            <div className="space-y-3">
              {group.reports.map((report) => {
                const Icon = report.icon;
                const name = lang === "ar" ? report.name : report.nameEn;
                const desc = lang === "ar" ? report.desc : report.descEn;
                const busy =
                  loadingId === `${report.id}-pdf` || loadingId === `${report.id}-excel`;
                return (
                  <Button
                    key={report.id}
                    type="button"
                    variant="ghost"
                    onClick={() => handlePDF(report.id)}
                    disabled={loadingId !== null}
                    className={cn(
                      "flex h-auto w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-start",
                      "transition-colors hover:border-foreground/20 active:scale-[0.99]"
                    )}
                  >
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 p-3 text-primary">
                      {busy ? (
                        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-foreground">
                        {name}
                      </div>
                      <div className="line-clamp-2 text-xs text-muted-foreground mt-0.5">
                        {desc}
                      </div>
                    </div>
                    <ChevronRight
                      className="h-5 w-5 shrink-0 text-muted-foreground rtl:scale-x-[-1]"
                      aria-hidden="true"
                    />
                  </Button>
                );
              })}
            </div>
          </div>
        ))}

        {mobileGroups.length === 0 && (
          <EmptyState
            icon={<Search className="h-12 w-12" />}
            title={t("لا توجد نتائج", "No results")}
            description={
              t(`لا توجد تقارير تطابق "${mobileSearch}".`, `No reports match "${mobileSearch}".`)
            }
            action={
              <Button
                variant="secondary"
                style={{ display: "inline-flex" }}
                onClick={() => setMobileSearch("")}
              >
                {t("مسح البحث", "Clear search")}
              </Button>
            }
          />
        )}
      </div>
    </div>

    {/* ─── Desktop (≥ md) ────────────────────────────────────────────── */}
    <div className="hidden md:block">
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageIntro
        title="التقارير والتحليلات"
        description="عرض وتصدير التقارير التفصيلية لأداء المحفظة العقارية."
        actions={datePickerActions}
      />

      <div className="space-y-10">
        {desktopGroups.map((group) => (
          <section key={group.id} aria-labelledby={`group-heading-${group.id}`}>
            {/* Section header */}
            <div className="mb-5 pb-3 border-b border-border">
              <h2
                id={`group-heading-${group.id}`}
                className="text-base font-bold text-foreground"
              >
                {lang === "ar" ? group.heading : group.headingEn}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {lang === "ar" ? group.question : group.questionEn}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {group.reports.map((report) => {
                const Icon = report.icon;
                return (
                  <Card
                    key={report.id}
                    className="hover:shadow-lg hover:border-primary/20 transition-all group"
                  >
                    <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
                      <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <Badge variant="draft" className="text-[10px] font-bold">
                        {report.type}
                      </Badge>
                    </CardHeader>
                    <CardContent className="pb-0">
                      <h3 className="text-sm font-bold text-foreground">{report.name}</h3>
                      <p className="text-[10px] text-muted-foreground mt-1">{report.desc}</p>
                    </CardContent>
                    <CardFooter className="justify-end gap-2 border-t border-border mt-4">
                      <Button
                        variant="secondary"
                        size="sm"
                        style={{ display: "inline-flex" }}
                        className="gap-2 text-xs hover:bg-secondary/10 hover:border-secondary/50 hover:text-secondary hover:shadow-sm hover:-translate-y-0.5 transition-all"
                        onClick={() => handleExcel(report.id)}
                        disabled={loadingId !== null}
                      >
                        {loadingId === report.id + "-excel" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sheet className="h-3.5 w-3.5" />
                        )}
                        Excel
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        style={{ display: "inline-flex" }}
                        className="gap-2 text-xs hover:bg-destructive/10 hover:border-destructive/50 hover:text-destructive hover:shadow-sm hover:-translate-y-0.5 transition-all"
                        onClick={() => handlePDF(report.id)}
                        disabled={loadingId !== null}
                      >
                        {loadingId === report.id + "-pdf" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                        PDF
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
    </div>
    </>
  );
}
