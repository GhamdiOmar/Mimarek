"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Ticket, Search, Filter, ChevronDown, MessageSquare,
  AlertCircle, Clock, CheckCircle, XCircle, ShieldAlert,
} from "lucide-react";
import {
  AppBar, Button, DataCard, DataTable, EmptyState, MobileKPICard, MobileTabs, Skeleton, Badge,
  type ColumnDef,
} from "@repo/ui";
import { PageHeader } from "@repo/ui/components/PageHeader";
import { useLanguage } from "../../../../components/LanguageProvider";
import { useSession } from "../../../../components/SimpleSessionProvider";
import { isSystemRole } from "../../../../lib/permissions";
import { adminGetAllTickets } from "../../../actions/admin-stats";

type TicketRow = {
  id: string;
  ticketNumber: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
  user: { id: string; name: string | null; email: string };
  organization: { id: string; name: string; nameArabic: string | null };
  _count: { messages: number };
};

type PageData = Awaited<ReturnType<typeof adminGetAllTickets>>;

const STATUS_OPTIONS = [
  { value: "", label: { ar: "كل الحالات", en: "All Statuses" } },
  { value: "OPEN", label: { ar: "مفتوح", en: "Open" } },
  { value: "IN_PROGRESS", label: { ar: "قيد المعالجة", en: "In Progress" } },
  { value: "WAITING_ON_USER", label: { ar: "بانتظار المستخدم", en: "Waiting on User" } },
  { value: "RESOLVED", label: { ar: "محلول", en: "Resolved" } },
  { value: "CLOSED", label: { ar: "مغلق", en: "Closed" } },
];

const PRIORITY_OPTIONS = [
  { value: "", label: { ar: "كل الأولويات", en: "All Priorities" } },
  { value: "LOW", label: { ar: "منخفض", en: "Low" } },
  { value: "MEDIUM", label: { ar: "متوسط", en: "Medium" } },
  { value: "HIGH", label: { ar: "عالي", en: "High" } },
  { value: "URGENT", label: { ar: "عاجل", en: "Urgent" } },
];

const CATEGORY_OPTIONS = [
  { value: "", label: { ar: "كل الفئات", en: "All Categories" } },
  { value: "BUG_REPORT", label: { ar: "تقرير خلل", en: "Bug Report" } },
  { value: "FEATURE_REQUEST", label: { ar: "طلب ميزة", en: "Feature Request" } },
  { value: "ACCOUNT_ISSUE", label: { ar: "مشكلة حساب", en: "Account Issue" } },
  { value: "BILLING", label: { ar: "فوترة", en: "Billing" } },
  { value: "TECHNICAL_SUPPORT", label: { ar: "دعم تقني", en: "Technical Support" } },
  { value: "GENERAL_INQUIRY", label: { ar: "استفسار عام", en: "General Inquiry" } },
];

function statusBadge(status: string, lang: "ar" | "en") {
  const map: Record<string, { label: { ar: string; en: string }; cls: string; icon: React.ReactNode }> = {
    OPEN:            { label: { ar: "مفتوح", en: "Open" },                cls: "bg-info/15 text-info",        icon: <AlertCircle className="h-3 w-3" /> },
    IN_PROGRESS:     { label: { ar: "قيد المعالجة", en: "In Progress" },  cls: "bg-warning/15 text-warning",  icon: <Clock className="h-3 w-3" /> },
    WAITING_ON_USER: { label: { ar: "بانتظار المستخدم", en: "Waiting" },  cls: "bg-primary/15 text-primary",  icon: <Clock className="h-3 w-3" /> },
    RESOLVED:        { label: { ar: "محلول", en: "Resolved" },            cls: "bg-success/15 text-success",  icon: <CheckCircle className="h-3 w-3" /> },
    CLOSED:          { label: { ar: "مغلق", en: "Closed" },               cls: "bg-muted text-muted-foreground", icon: <XCircle className="h-3 w-3" /> },
  };
  const entry = map[status] ?? { label: { ar: status, en: status }, cls: "bg-muted text-muted-foreground", icon: null };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${entry.cls}`}>
      {entry.icon}
      {entry.label[lang]}
    </span>
  );
}

function priorityBadge(priority: string, lang: "ar" | "en") {
  const map: Record<string, { label: { ar: string; en: string }; cls: string }> = {
    LOW:    { label: { ar: "منخفض", en: "Low" },    cls: "bg-muted text-muted-foreground" },
    MEDIUM: { label: { ar: "متوسط", en: "Medium" }, cls: "bg-info/15 text-info" },
    HIGH:   { label: { ar: "عالي", en: "High" },    cls: "bg-warning/15 text-warning" },
    URGENT: { label: { ar: "عاجل", en: "Urgent" },  cls: "bg-destructive/15 text-destructive" },
  };
  const entry = map[priority] ?? { label: { ar: priority, en: priority }, cls: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${entry.cls}`}>
      {entry.label[lang]}
    </span>
  );
}

function categoryLabel(category: string, lang: "ar" | "en") {
  const opt = CATEGORY_OPTIONS.find((o) => o.value === category);
  return opt ? opt.label[lang] : category;
}

export default function AdminTicketsPage() {
  const { lang } = useLanguage();
  const router = useRouter();
  const { data: session } = useSession();
  const userRole = session?.user?.role ?? "";
  const authorized = isSystemRole(userRole);
  const [data, setData] = React.useState<PageData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [priority, setPriority] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [page, setPage] = React.useState(1);
  const searchRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = React.useCallback(
    (s: string, st: string, pr: string, cat: string, pg: number) => {
      setLoading(true);
      adminGetAllTickets({ search: s || undefined, status: st || undefined, priority: pr || undefined, category: cat || undefined, page: pg, pageSize: 30 })
        .then(setData)
        .finally(() => setLoading(false));
    },
    []
  );

  React.useEffect(() => {
    load(search, status, priority, category, page);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, priority, category, page]);

  function handleSearchChange(val: string) {
    setSearch(val);
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => {
      setPage(1);
      load(val, status, priority, category, 1);
    }, 400);
  }

  function handleFilterChange(setter: (v: string) => void) {
    return (e: React.ChangeEvent<HTMLSelectElement>) => {
      setter(e.target.value);
      setPage(1);
    };
  }

  const tickets: TicketRow[] = data?.tickets ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const openCount = tickets.filter((t) => t.status === "OPEN").length;
  const inProgressCount = tickets.filter((t) => t.status === "IN_PROGRESS").length;
  const resolvedCount = tickets.filter((t) => t.status === "RESOLVED").length;

  // ── Mobile helpers ────────────────────────────────────────────────────
  const mobileStatusTabs = [
    { key: "", label: lang === "ar" ? "الكل" : "All" },
    { key: "OPEN", label: lang === "ar" ? "مفتوح" : "Open" },
    { key: "IN_PROGRESS", label: lang === "ar" ? "قيد المعالجة" : "In Progress" },
    { key: "RESOLVED", label: lang === "ar" ? "محلول" : "Resolved" },
    { key: "CLOSED", label: lang === "ar" ? "مغلق" : "Closed" },
  ];

  const priorityTone = (p: string): "red" | "amber" | "blue" | "default" => {
    if (p === "URGENT") return "red";
    if (p === "HIGH") return "amber";
    if (p === "MEDIUM") return "blue";
    return "default";
  };

  const statusBadgeVariant = (s: string): "info" | "warning" | "success" | "default" | "error" => {
    if (s === "OPEN") return "info";
    if (s === "IN_PROGRESS" || s === "WAITING_ON_USER") return "warning";
    if (s === "RESOLVED") return "success";
    if (s === "CLOSED") return "default";
    return "default";
  };

  const statusLabelAr: Record<string, string> = {
    OPEN: "مفتوح",
    IN_PROGRESS: "قيد المعالجة",
    WAITING_ON_USER: "بانتظار",
    RESOLVED: "محلول",
    CLOSED: "مغلق",
  };
  const statusLabelEn: Record<string, string> = {
    OPEN: "Open",
    IN_PROGRESS: "In Progress",
    WAITING_ON_USER: "Waiting",
    RESOLVED: "Resolved",
    CLOSED: "Closed",
  };

  const columns = React.useMemo<ColumnDef<TicketRow>[]>(
    () => [
      {
        id: "ticketNumber",
        accessorKey: "ticketNumber",
        header: lang === "ar" ? "رقم التذكرة" : "Ticket #",
        cell: ({ row }) => (
          <span className="font-mono text-xs font-semibold text-primary whitespace-nowrap">
            {row.original.ticketNumber}
          </span>
        ),
      },
      {
        id: "organization",
        header: lang === "ar" ? "المنظمة" : "Organization",
        accessorFn: (row) =>
          lang === "ar" && row.organization.nameArabic
            ? row.organization.nameArabic
            : row.organization.name,
        cell: ({ row }) => (
          <span className="font-medium text-foreground whitespace-nowrap">
            {lang === "ar" && row.original.organization.nameArabic
              ? row.original.organization.nameArabic
              : row.original.organization.name}
          </span>
        ),
      },
      {
        id: "user",
        header: lang === "ar" ? "مقدم الطلب" : "Submitter",
        accessorFn: (row) => row.user.name ?? row.user.email,
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-foreground">
              {row.original.user.name ?? "—"}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {row.original.user.email}
            </span>
          </div>
        ),
      },
      {
        id: "subject",
        accessorKey: "subject",
        header: lang === "ar" ? "الموضوع" : "Subject",
        cell: ({ row }) => (
          <span
            className="block max-w-[220px] truncate text-foreground"
            title={row.original.subject}
          >
            {row.original.subject}
          </span>
        ),
      },
      {
        id: "category",
        accessorKey: "category",
        header: lang === "ar" ? "الفئة" : "Category",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {categoryLabel(row.original.category, lang)}
          </span>
        ),
      },
      {
        id: "priority",
        accessorKey: "priority",
        header: lang === "ar" ? "الأولوية" : "Priority",
        cell: ({ row }) => priorityBadge(row.original.priority, lang),
      },
      {
        id: "status",
        accessorKey: "status",
        header: lang === "ar" ? "الحالة" : "Status",
        cell: ({ row }) => statusBadge(row.original.status, lang),
      },
      {
        id: "messages",
        header: lang === "ar" ? "الرسائل" : "Messages",
        accessorFn: (row) => row._count.messages,
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
            <MessageSquare className="h-3 w-3" aria-hidden="true" />
            {row.original._count.messages}
          </span>
        ),
      },
      {
        id: "createdAt",
        accessorKey: "createdAt",
        header: lang === "ar" ? "التاريخ" : "Date",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
            {new Date(row.original.createdAt).toLocaleDateString(
              lang === "ar" ? "ar-SA" : "en-US",
              { day: "numeric", month: "short", year: "numeric" },
            )}
          </span>
        ),
      },
    ],
    [lang],
  );

  return (
    <>
    {/* ─── Mobile (< md) ─────────────────────────────────────────────── */}
    <div
      className="md:hidden -m-4 sm:-m-6 min-h-dvh flex flex-col bg-background"
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <AppBar title={lang === "ar" ? "التذاكر" : "Tickets"} lang={lang} />

      {!authorized ? (
        <div className="flex-1 px-4 pt-10">
          <EmptyState
            icon={<ShieldAlert className="h-10 w-10" aria-hidden="true" />}
            title={lang === "ar" ? "غير مصرح" : "Unauthorized"}
            description={
              lang === "ar"
                ? "هذه الصفحة متاحة لفريق الدعم فقط."
                : "This page is available to support staff only."
            }
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 px-4 pt-3">
            <MobileKPICard
              label={lang === "ar" ? "مفتوحة" : "Open"}
              value={<span className="tabular-nums">{openCount}</span>}
              tone="blue"
            />
            <MobileKPICard
              label={lang === "ar" ? "قيد المعالجة" : "In Progress"}
              value={<span className="tabular-nums">{inProgressCount}</span>}
              tone="amber"
            />
            <MobileKPICard
              label={lang === "ar" ? "محلولة" : "Resolved"}
              value={<span className="tabular-nums">{resolvedCount}</span>}
              tone="green"
            />
            <MobileKPICard
              label={lang === "ar" ? "الإجمالي" : "Total"}
              value={<span className="tabular-nums">{total}</span>}
              tone="primary"
            />
          </div>

          <div className="px-4 pt-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={lang === "ar" ? "بحث..." : "Search..."}
                className="h-11 w-full rounded-md border border-input bg-background ps-9 pe-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <div className="px-4 pt-3">
            <MobileTabs
              ariaLabel={lang === "ar" ? "تصفية حسب الحالة" : "Filter by status"}
              active={status}
              onChange={(v) => { setStatus(v); setPage(1); }}
              items={mobileStatusTabs}
            />
          </div>

          <div className="flex-1 px-4 pb-24 pt-3">
            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
            ) : tickets.length === 0 ? (
              search || status || priority || category ? (
                <EmptyState
                  variant="filtered"
                  icon={<Search className="h-10 w-10" aria-hidden="true" />}
                  title={lang === "ar" ? "لا توجد نتائج مطابقة" : "No matching tickets"}
                  description={
                    lang === "ar"
                      ? "جرّب تعديل البحث أو الحالة."
                      : "Try adjusting your search or status filter."
                  }
                  action={
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearch("");
                        setStatus("");
                        setPriority("");
                        setCategory("");
                        setPage(1);
                      }}
                      style={{ display: "inline-flex" }}
                    >
                      {lang === "ar" ? "مسح الفلاتر" : "Clear filters"}
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  variant="first-time"
                  icon={<Ticket className="h-12 w-12" aria-hidden="true" />}
                  title={lang === "ar" ? "لا توجد تذاكر دعم" : "No support tickets"}
                  description={
                    lang === "ar"
                      ? "تظهر هنا تذاكر العملاء التي يحتاجون فيها إلى المساعدة."
                      : "Customer help requests from across the platform show up here."
                  }
                />
              )
            ) : (
              <div className="rounded-2xl border border-border bg-card px-4">
                {tickets.map((tk, idx) => {
                  const orgName =
                    lang === "ar" && tk.organization.nameArabic
                      ? tk.organization.nameArabic
                      : tk.organization.name;
                  const dateLabel = new Date(tk.createdAt).toLocaleDateString(
                    lang === "ar" ? "ar-SA" : "en-US",
                    { day: "numeric", month: "short" },
                  );
                  const requester = tk.user.name ?? tk.user.email;
                  return (
                    <DataCard
                      key={tk.id}
                      icon={Ticket}
                      iconTone={priorityTone(tk.priority)}
                      href={`/dashboard/help/tickets/${tk.id}`}
                      title={
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-xs text-primary">{tk.ticketNumber}</span>
                          <span className="truncate">{tk.subject}</span>
                        </span>
                      }
                      subtitle={[orgName, requester, dateLabel]}
                      trailing={
                        <Badge variant={statusBadgeVariant(tk.status)} size="sm">
                          {lang === "ar" ? statusLabelAr[tk.status] ?? tk.status : statusLabelEn[tk.status] ?? tk.status}
                        </Badge>
                      }
                      divider={idx !== tickets.length - 1}
                    />
                  );
                })}
              </div>
            )}

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="min-h-11 rounded-md border border-border px-3 py-1.5 font-medium disabled:opacity-40"
                >
                  {lang === "ar" ? "السابق" : "Previous"}
                </button>
                <span className="tabular-nums">{page} / {totalPages}</span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="min-h-11 rounded-md border border-border px-3 py-1.5 font-medium disabled:opacity-40"
                >
                  {lang === "ar" ? "التالي" : "Next"}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>

    {/* ─── Desktop (≥ md) ─ unchanged ───────────────────────────────── */}
    <div className="hidden md:block">
    <div className="space-y-6 animate-in fade-in duration-500" dir={lang === "ar" ? "rtl" : "ltr"}>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <Ticket className="h-7 w-7" />
        </div>
        <PageHeader
          className="flex-1"
          title={lang === "ar" ? "تذاكر الدعم" : "Support Tickets"}
          description={
            lang === "ar"
              ? "إدارة طلبات دعم العملاء عبر جميع المنظمات"
              : "Manage customer support requests across all organizations"
          }
        />
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: { ar: "إجمالي التذاكر", en: "Total Tickets" }, value: total, cls: "bg-primary/10 text-primary" },
          { label: { ar: "مفتوح", en: "Open" }, value: openCount, cls: "bg-info/10 text-info" },
          { label: { ar: "قيد المعالجة", en: "In Progress" }, value: inProgressCount, cls: "bg-warning/10 text-warning" },
          { label: { ar: "الصفحة الحالية", en: "This Page" }, value: tickets.length, cls: "bg-muted text-muted-foreground" },
        ].map((s, i) => (
          <div key={i} className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
            <div className={`h-9 w-9 rounded-md flex items-center justify-center shrink-0 ${s.cls}`}>
              <Ticket className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground leading-none">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label[lang]}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder={lang === "ar" ? "بحث بالموضوع أو الرقم أو البريد..." : "Search subject, number, or email…"}
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full rounded-md border border-input bg-background ps-9 pe-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {[
          { value: status, setter: setStatus, options: STATUS_OPTIONS },
          { value: priority, setter: setPriority, options: PRIORITY_OPTIONS },
          { value: category, setter: setCategory, options: CATEGORY_OPTIONS },
        ].map((f, i) => (
          <div key={i} className="relative">
            <Filter className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <select
              value={f.value}
              onChange={handleFilterChange(f.setter)}
              className="appearance-none rounded-md border border-input bg-background ps-8 pe-8 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
            >
              {f.options.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label[lang]}</option>
              ))}
            </select>
            <ChevronDown className="absolute end-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          </div>
        ))}
      </div>

      {/* Table */}
      <DataTable<TicketRow, unknown>
        columns={columns}
        data={tickets}
        loading={loading}
        locale={lang}
        pagination={false}
        getRowId={(row) => row.id}
        onRowClick={(row) => router.push(`/dashboard/help/tickets/${row.id}`)}
        caption={lang === "ar" ? "جدول تذاكر الدعم" : "Support tickets table"}
        emptyTitle={lang === "ar" ? "لا توجد تذاكر" : "No tickets found"}
        emptyDescription={
          lang === "ar"
            ? "لا توجد تذاكر مطابقة للتصفية الحالية."
            : "No tickets match the current filters."
        }
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
          <span>
            {lang === "ar"
              ? `عرض ${tickets.length} من ${total} تذكرة`
              : `Showing ${tickets.length} of ${total} tickets`}
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 rounded-md border border-border text-xs font-medium disabled:opacity-40 hover:bg-muted/40 transition-colors"
            >
              {lang === "ar" ? "السابق" : "Previous"}
            </button>
            <span className="text-xs">{lang === "ar" ? `صفحة ${page} من ${totalPages}` : `Page ${page} of ${totalPages}`}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-md border border-border text-xs font-medium disabled:opacity-40 hover:bg-muted/40 transition-colors"
            >
              {lang === "ar" ? "التالي" : "Next"}
            </button>
          </div>
        </div>
      )}
    </div>
    </div>
    </>
  );
}
