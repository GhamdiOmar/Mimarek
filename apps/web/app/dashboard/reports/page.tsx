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
  MapPin,
  HardHat,
  Rocket,
  Stamp,
  Tag,
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
  cn,
} from "@repo/ui";
import { useLanguage } from "../../../components/LanguageProvider";
import {
  getRevenueReport,
  getOccupancyReport,
  getRentCollectionReport,
  getMaintenanceReport,
  getLandPortfolioReport,
  getProjectProgressReport,
  getMaintenanceCostReport,
  getDevelopmentPipelineReport,
  getApprovalStatusReport,
  getPricingAnalysisReport,
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
    id: "land",
    name: "تقرير محفظة الأراضي",
    nameEn: "Land Portfolio Report",
    desc: "تحليل شامل لمحفظة الأراضي والاستثمارات",
    descEn: "Comprehensive land holdings and investment analysis",
    type: "استثماري",
    typeEn: "Investment",
    icon: MapPin,
  },
  {
    id: "project-progress",
    name: "تقرير تقدم المشاريع",
    nameEn: "Project Progress Report",
    desc: "تتبع حالة المشاريع ونسب البيع والتأجير",
    descEn: "Project status with sale and lease percentages",
    type: "تشغيلي",
    typeEn: "Operational",
    icon: HardHat,
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
  {
    id: "dev-pipeline",
    name: "تقرير مسار التطوير",
    nameEn: "Development Pipeline Report",
    desc: "توزيع المشاريع على مراحل التطوير العقاري على الخارطة",
    descEn: "Projects distributed across development pipeline stages",
    type: "تطويري",
    typeEn: "Development",
    icon: Rocket,
  },
  {
    id: "approval-status",
    name: "تقرير حالة الموافقات",
    nameEn: "Approval Status Report",
    desc: "تتبع طلبات الموافقة من الجهات الحكومية ونسب القبول",
    descEn: "Government approval requests tracking and acceptance rates",
    type: "تنظيمي",
    typeEn: "Regulatory",
    icon: Stamp,
  },
  {
    id: "pricing-analysis",
    name: "تقرير تحليل التسعير",
    nameEn: "Pricing Analysis Report",
    desc: "تحليل الأسعار حسب نوع المنتج وقواعد التسعير النشطة",
    descEn: "Price analysis by product type and active pricing rules",
    type: "مالي",
    typeEn: "Financial",
    icon: Tag,
  },
];

export default function ReportsPage() {
  const { lang } = useLanguage();
  const defaults = getDefaultDateRange();
  const [startDate, setStartDate] = React.useState(defaults.start);
  const [endDate, setEndDate] = React.useState(defaults.end);
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const [mobileSearch, setMobileSearch] = React.useState("");

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
      } else if (reportId === "land") {
        const data = await getLandPortfolioReport(startDate, endDate);
        await generateReportPDF({
          title: "تقرير محفظة الأراضي",
          subtitle: "Land Portfolio Report",
          dateRange,
          sections: [
            {
              title: "ملخص",
              rows: [
                { label: "عدد الأراضي", value: data.totalParcels.toString() },
                { label: "إجمالي المساحة (م²)", value: fmt(data.totalArea) },
                { label: "القيمة التقديرية (ر.س)", value: fmt(data.totalEstimatedValue) },
                { label: "تكلفة الاستحواذ (ر.س)", value: fmt(data.totalAcquisitionCost) },
                { label: "الربح/الخسارة غير المحققة (ر.س)", value: fmt(data.unrealizedGainLoss) },
              ],
            },
            ...data.parcels.map((p: any) => ({
              title: p.name,
              rows: [
                { label: "المساحة", value: p.area ? `${p.area.toLocaleString()} م²` : "—" },
                { label: "القيمة التقديرية", value: `${fmt(p.estimatedValue)} ر.س` },
                { label: "الموقع", value: p.location || "—" },
                { label: "الحالة", value: p.status },
              ],
            })),
          ],
        });
      } else if (reportId === "project-progress") {
        const data = await getProjectProgressReport(startDate, endDate);
        await generateReportPDF({
          title: "تقرير تقدم المشاريع",
          subtitle: "Project Progress Report",
          dateRange,
          sections: data.projects.map((p: any) => ({
            title: p.name,
            rows: [
              { label: "الحالة", value: p.status },
              { label: "عدد الوحدات", value: p.totalUnits.toString() },
              { label: "نسبة البيع", value: `${p.soldPercent}%` },
              { label: "نسبة التأجير", value: `${p.rentedPercent}%` },
              { label: "إجمالي الإيرادات (ر.س)", value: fmt(p.totalRevenue) },
              { label: "قيمة المتبقي (ر.س)", value: fmt(p.remainingValue) },
            ],
          })),
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
              rows: data.byCategory.map((c: any) => ({
                label: c.category,
                value: `${c.count} طلب — ${fmt(c.actual)} ر.س`,
              })),
            },
            {
              title: "حسب المبنى",
              rows: data.byBuilding.map((b: any) => ({
                label: b.name,
                value: `${fmt(b.actual)} ر.س (${b.costPerSqm} ر.س/م²)`,
              })),
            },
          ],
        });
      } else if (reportId === "dev-pipeline") {
        const data = await getDevelopmentPipelineReport();
        await generateReportPDF({
          title: "تقرير مسار التطوير",
          subtitle: "Development Pipeline Report",
          dateRange,
          sections: [
            {
              title: "ملخص",
              rows: [
                { label: "إجمالي المشاريع", value: String(data.totalProjects) },
              ],
            },
            ...data.stages.filter((s: any) => s.count > 0).map((s: any) => ({
              title: s.stage,
              rows: s.projects.map((p: string, i: number) => ({
                label: `${i + 1}. ${p}`,
                value: "",
              })),
            })),
          ],
        });
      } else if (reportId === "approval-status") {
        const data = await getApprovalStatusReport();
        await generateReportPDF({
          title: "تقرير حالة الموافقات",
          subtitle: "Approval Status Report",
          dateRange,
          sections: [
            {
              title: "ملخص",
              rows: [
                { label: "إجمالي الطلبات", value: String(data.total) },
                { label: "معتمدة", value: String(data.approved) },
                { label: "مرفوضة", value: String(data.rejected) },
                { label: "قيد المراجعة", value: String(data.pending) },
                { label: "نسبة القبول", value: `${data.successRate}%` },
              ],
            },
            {
              title: "حسب النوع",
              rows: data.byType.map((t: any) => ({
                label: t.type,
                value: `${t.approved}/${t.total} معتمدة`,
              })),
            },
          ],
        });
      } else if (reportId === "pricing-analysis") {
        const data = await getPricingAnalysisReport();
        await generateReportPDF({
          title: "تقرير تحليل التسعير",
          subtitle: "Pricing Analysis Report",
          dateRange,
          sections: [
            {
              title: "ملخص",
              rows: [
                { label: "عدد الوحدات", value: String(data.totalItems) },
                { label: "إجمالي القيمة (ر.س)", value: fmt(data.totalValue) },
              ],
            },
            {
              title: "حسب نوع المنتج",
              rows: data.byProductType.map((t: any) => ({
                label: t.type,
                value: `${t.count} وحدة — متوسط ${fmt(t.avgPrice)} ر.س`,
              })),
            },
            {
              title: "قواعد التسعير النشطة",
              rows: data.activeRules.map((r: any) => ({
                label: r.name,
                value: r.fixedAmount > 0 ? `${fmt(r.fixedAmount)} ر.س` : `${r.factor}x`,
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
      } else if (reportId === "land") {
        const data = await getLandPortfolioReport(startDate, endDate);
        await exportToExcel({
          data: data.parcels,
          columns: [
            { header: "الاسم", key: "name" },
            { header: "المساحة", key: "area" },
            { header: "القيمة التقديرية", key: "estimatedValue", render: (v: number) => fmt(v) },
            { header: "تكلفة الاستحواذ", key: "acquisitionCost", render: (v: number) => fmt(v) },
            { header: "الموقع", key: "location" },
            { header: "الحالة", key: "status" },
          ],
          filename: "land-portfolio-report",
          title: "تقرير محفظة الأراضي",
        });
      } else if (reportId === "project-progress") {
        const data = await getProjectProgressReport(startDate, endDate);
        await exportToExcel({
          data: data.projects,
          columns: [
            { header: "المشروع", key: "name" },
            { header: "الحالة", key: "status" },
            { header: "الوحدات", key: "totalUnits" },
            { header: "بيع %", key: "soldPercent", render: (v: number) => `${v}%` },
            { header: "تأجير %", key: "rentedPercent", render: (v: number) => `${v}%` },
            { header: "الإيرادات", key: "totalRevenue", render: (v: number) => fmt(v) },
            { header: "المتبقي", key: "remainingValue", render: (v: number) => fmt(v) },
          ],
          filename: "project-progress-report",
          title: "تقرير تقدم المشاريع",
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
      } else if (reportId === "dev-pipeline") {
        const data = await getDevelopmentPipelineReport();
        await exportToExcel({
          data: data.stages,
          columns: [
            { header: "المرحلة", key: "stage" },
            { header: "Stage", key: "stageEn" },
            { header: "عدد المشاريع", key: "count" },
          ],
          filename: "development-pipeline-report",
          title: "تقرير مسار التطوير",
        });
      } else if (reportId === "approval-status") {
        const data = await getApprovalStatusReport();
        await exportToExcel({
          data: data.details,
          columns: [
            { header: "المشروع", key: "project" },
            { header: "النوع", key: "type" },
            { header: "الجهة", key: "authority" },
            { header: "الحالة", key: "status" },
            { header: "تاريخ التقديم", key: "submittedAt" },
          ],
          filename: "approval-status-report",
          title: "تقرير حالة الموافقات",
        });
      } else if (reportId === "pricing-analysis") {
        const data = await getPricingAnalysisReport();
        await exportToExcel({
          data: data.byProductType,
          columns: [
            { header: "نوع المنتج", key: "type" },
            { header: "عدد الوحدات", key: "count" },
            { header: "إجمالي القيمة", key: "totalValue", render: (v: number) => fmt(v) },
            { header: "متوسط السعر", key: "avgPrice", render: (v: number) => fmt(v) },
          ],
          filename: "pricing-analysis-report",
          title: "تقرير تحليل التسعير",
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
      <input
        type="date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        className="border border-border rounded-md px-3 py-1.5 text-sm text-foreground bg-card"
      />
      <span className="text-muted-foreground text-sm">إلى</span>
      <input
        type="date"
        value={endDate}
        onChange={(e) => setEndDate(e.target.value)}
        className="border border-border rounded-md px-3 py-1.5 text-sm text-foreground bg-card"
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
      <AppBar title={lang === "ar" ? "التقارير" : "Reports"} lang={lang} />

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
            placeholder={lang === "ar" ? "ابحث في التقارير..." : "Search reports..."}
            className="h-10 ps-9"
          />
        </div>
      </div>

      <div className="flex-1 px-4 pb-24 pt-3 space-y-3">
        {mobileFiltered.map((report) => {
          const Icon = report.icon;
          const name = lang === "ar" ? report.name : report.nameEn;
          const desc = lang === "ar" ? report.desc : report.descEn;
          const busy =
            loadingId === `${report.id}-pdf` || loadingId === `${report.id}-excel`;
          return (
            <button
              key={report.id}
              type="button"
              onClick={() => handlePDF(report.id)}
              disabled={loadingId !== null}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-start",
                "transition-colors hover:border-foreground/20 active:scale-[0.99] disabled:opacity-60",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]"
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
            </button>
          );
        })}

        {mobileFiltered.length === 0 && (
          <EmptyState
            icon={<Search className="h-12 w-12" />}
            title={lang === "ar" ? "لا توجد نتائج" : "No results"}
            description={
              lang === "ar"
                ? `لا توجد تقارير تطابق "${mobileSearch}".`
                : `No reports match "${mobileSearch}".`
            }
            action={
              <Button
                variant="secondary"
                style={{ display: "inline-flex" }}
                onClick={() => setMobileSearch("")}
              >
                {lang === "ar" ? "مسح البحث" : "Clear search"}
              </Button>
            }
          />
        )}
      </div>
    </div>

    {/* ─── Desktop (≥ md) ─ unchanged ───────────────────────────────── */}
    <div className="hidden md:block">
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageIntro
        title="التقارير والتحليلات"
        description="عرض وتصدير التقارير التفصيلية لأداء المحفظة العقارية."
        actions={datePickerActions}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {REPORTS.map((report) => {
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
    </div>
    </div>
    </>
  );
}
