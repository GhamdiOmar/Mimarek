"use client";

import { useLanguage } from "../../../components/LanguageProvider";
import * as React from "react";
import {
  HelpCircle,
  Ticket,
  ShieldCheck,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Search,
  Send,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Download,
  Loader2,
  LifeBuoy,
  Plus,
  Users,
} from "lucide-react";
import {
  Button,
  PageHeader,
  AppBar,
  FAB,
  DataCard,
  MobileKPICard,
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  Input as UIInput,
  Textarea,
  SelectField,
  BottomSheet,
  DataTable,
  Badge,
  type ColumnDef,
} from "@repo/ui";
import { exportToExcel } from "../../../lib/export";
import { cn } from "@repo/ui/lib/utils";
import Link from "next/link";
import { hasPermission } from "../../../lib/permissions";
import { useSession } from "../../../components/SimpleSessionProvider";
import { FAQ_ITEMS, FAQ_CATEGORIES, GUIDE_ITEMS, type FAQCategory } from "../../../lib/help-content";
import { createPermissionRequest, getMyPermissionRequests } from "../../actions/permission-requests";
import { getPendingPermissionRequests, reviewPermissionRequest } from "../../actions/permission-requests";
import { createSupportTicket, getMySupportTickets } from "../../actions/support-tickets";
import { getPendingJoinRequests, reviewJoinRequest, cancelJoinRequest } from "../../actions/join-requests";
import { getMyJoinRequests } from "../../actions/onboarding";
import { toast } from "sonner";

const ROLE_OPTIONS = [
  { value: "ADMIN", label: { ar: "مدير", en: "Admin" } },
  { value: "MANAGER", label: { ar: "مدير عمليات", en: "Manager" } },
  { value: "AGENT", label: { ar: "وكيل", en: "Agent" } },
  { value: "TECHNICIAN", label: { ar: "فني صيانة", en: "Technician" } },
];

const CATEGORY_OPTIONS = [
  { value: "BUG_REPORT", label: { ar: "بلاغ خطأ", en: "Bug Report" } },
  { value: "FEATURE_REQUEST", label: { ar: "طلب ميزة", en: "Feature Request" } },
  { value: "ACCOUNT_ISSUE", label: { ar: "مشكلة حساب", en: "Account Issue" } },
  { value: "BILLING", label: { ar: "فوترة", en: "Billing" } },
  { value: "TECHNICAL_SUPPORT", label: { ar: "دعم فني", en: "Technical Support" } },
  { value: "GENERAL_INQUIRY", label: { ar: "استفسار عام", en: "General Inquiry" } },
];

const PRIORITY_OPTIONS = [
  { value: "LOW", label: { ar: "منخفضة", en: "Low" } },
  { value: "MEDIUM", label: { ar: "متوسطة", en: "Medium" } },
  { value: "HIGH", label: { ar: "عالية", en: "High" } },
  { value: "URGENT", label: { ar: "عاجلة", en: "Urgent" } },
];

type Tab = "overview" | "faq" | "tickets" | "permissions" | "join-requests" | "org-admin";

// Row types derived directly from the server actions' return shapes so the
// UI stays in sync with the Prisma `include` selections without re-declaring them.
type SupportTicketRow = Awaited<ReturnType<typeof getMySupportTickets>>[number];
type PermissionRequestRow = Awaited<ReturnType<typeof getMyPermissionRequests>>[number];
type PendingPermissionRequestRow = Awaited<ReturnType<typeof getPendingPermissionRequests>>[number];
type PendingJoinRequestRow = Awaited<ReturnType<typeof getPendingJoinRequests>>[number];
type MyJoinRequestRow = Awaited<ReturnType<typeof getMyJoinRequests>>[number];

// A short, hand-picked set of high-traffic FAQs surfaced on the Overview landing.
const POPULAR_FAQ_IDS = ["gs-1", "sc-1", "sc-8", "fi-7", "mk-1", "sp-5"];

// Maps the in-app deep-link anchors (e.g. an empty-state "Learn about contracts"
// linking to /dashboard/help#contracts) to the FAQ category to open + filter.
const HASH_TO_CATEGORY: Record<string, FAQCategory> = {
  crm: "sales_crm",
  deals: "sales_crm",
  contracts: "sales_crm",
  units: "property_management",
  documents: "property_management",
  maintenance: "property_management",
  "preventive-maintenance": "property_management",
  marketplace: "marketplace",
  payments: "finance",
  coupons: "finance",
  zatca: "zatca",
  invoices: "zatca",
  notifications: "account_notifications",
  search: "account_notifications",
  security: "security_privacy",
  settings: "technical",
};

export default function HelpPage() {
  const { data: session } = useSession();
  const userRole = session?.user?.role ?? "USER";
  const isOrgAdmin = hasPermission(userRole, "help:manage_permissions");
  const { t, lang } = useLanguage();
  const [activeTab, setActiveTab] = React.useState<Tab>("overview");

  // FAQ state
  const [faqSearch, setFaqSearch] = React.useState("");
  const [faqCategory, setFaqCategory] = React.useState<FAQCategory | "all">("all");
  const [openFaq, setOpenFaq] = React.useState<string | null>(null);
  const [openGuide, setOpenGuide] = React.useState<string | null>(null);
  const [overviewSearch, setOverviewSearch] = React.useState("");

  // Ticket state
  const [myTickets, setMyTickets] = React.useState<SupportTicketRow[]>([]);
  const [showNewTicket, setShowNewTicket] = React.useState(false);
  const [ticketForm, setTicketForm] = React.useState({ subject: "", description: "", category: "GENERAL_INQUIRY", priority: "MEDIUM" });
  const [ticketLoading, setTicketLoading] = React.useState(false);
  const [ticketErrors, setTicketErrors] = React.useState<Record<string, boolean>>({});

  // Permission request state
  const [myRequests, setMyRequests] = React.useState<PermissionRequestRow[]>([]);
  const [permForm, setPermForm] = React.useState({ requestedRole: "", reason: "" });
  const [permLoading, setPermLoading] = React.useState(false);

  // Admin state
  const [pendingRequests, setPendingRequests] = React.useState<PendingPermissionRequestRow[]>([]);
  const [pendingJoinRequests, setPendingJoinRequests] = React.useState<PendingJoinRequestRow[]>([]);
  const [reviewNote, setReviewNote] = React.useState("");
  const [reviewingId, setReviewingId] = React.useState<string | null>(null);
  const [reviewActionLoading, setReviewActionLoading] = React.useState(false);
  const [joinReviewingId, setJoinReviewingId] = React.useState<string | null>(null);
  const [joinReviewNote, setJoinReviewNote] = React.useState("");
  const [joinReviewActionLoading, setJoinReviewActionLoading] = React.useState(false);

  // My join requests state
  const [myJoinRequests, setMyJoinRequests] = React.useState<MyJoinRequestRow[]>([]);
  const [cancellingJoinId, setCancellingJoinId] = React.useState<string | null>(null);

  // Load data based on tab
  React.useEffect(() => {
    if (activeTab === "tickets") {
      getMySupportTickets().then(setMyTickets).catch(() => {});
    } else if (activeTab === "permissions") {
      getMyPermissionRequests().then(setMyRequests).catch(() => {});
    } else if (activeTab === "join-requests") {
      getMyJoinRequests().then(setMyJoinRequests).catch(() => {});
    } else if (activeTab === "org-admin" && isOrgAdmin) {
      getPendingPermissionRequests().then(setPendingRequests).catch(() => {});
      getPendingJoinRequests().then(setPendingJoinRequests).catch(() => {});
    }
  }, [activeTab, isOrgAdmin]);

  // Deep-link handling: open the right tab/category when the page is reached via
  // an in-app anchor (e.g. /dashboard/help#contracts from an empty-state link).
  // Listens for hashchange too, so the link also works when Help is already open.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const applyHash = () => {
      const hash = window.location.hash.replace(/^#/, "").toLowerCase();
      if (!hash) return;
      const cat = HASH_TO_CATEGORY[hash];
      if (cat) {
        setActiveTab("faq");
        setFaqCategory(cat);
      } else if (hash === "faq" || hash === "faqs" || hash === "guides") {
        setActiveTab("faq");
      } else if (hash === "tickets") {
        setActiveTab("tickets");
      } else if (hash === "permissions") {
        setActiveTab("permissions");
      } else if (hash === "join-requests" || hash === "join_requests") {
        setActiveTab("join-requests");
      } else {
        return;
      }
      // Let the tab content mount, then bring the FAQ section into view.
      window.setTimeout(() => {
        document.getElementById("help-faq-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 250);
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  // Jump to a specific FAQ from the Overview (popular questions / search).
  const goToFaq = React.useCallback((opts?: { category?: FAQCategory | "all"; search?: string; openId?: string }) => {
    if (opts?.category !== undefined) setFaqCategory(opts.category);
    if (opts?.search !== undefined) setFaqSearch(opts.search);
    if (opts?.openId !== undefined) setOpenFaq(opts.openId);
    setActiveTab("faq");
    window.setTimeout(() => {
      document.getElementById("help-faq-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }, []);

  const popularFaqs = POPULAR_FAQ_IDS
    .map((id) => FAQ_ITEMS.find((f) => f.id === id))
    .filter(Boolean) as typeof FAQ_ITEMS;

  // Shared FAQ accordion row — used by both the flat and category-grouped views.
  const renderFaqRow = (item: (typeof FAQ_ITEMS)[number]) => (
    <div key={item.id}>
      <Button
        variant="ghost"
        onClick={() => setOpenFaq(openFaq === item.id ? null : item.id)}
        className="flex items-center justify-between w-full px-4 py-3 h-auto text-sm font-medium text-foreground hover:bg-muted/10 transition-colors text-start rounded-none"
        style={{ display: "inline-flex" }}
        aria-expanded={openFaq === item.id}
      >
        <span>{item.question[lang]}</span>
        {openFaq === item.id ? <ChevronUp className="h-4 w-4 min-w-[16px]" /> : <ChevronDown className="h-4 w-4 min-w-[16px]" />}
      </Button>
      {openFaq === item.id && (
        <div className="px-4 pb-3 text-sm text-muted-foreground leading-relaxed bg-muted/5">
          {item.answer[lang]}
        </div>
      )}
    </div>
  );

  // Filter FAQs
  const filteredFaqs = FAQ_ITEMS.filter((item) => {
    if (faqCategory !== "all" && item.category !== faqCategory) return false;
    if (faqSearch) {
      const q = faqSearch.toLowerCase();
      return item.question.ar.includes(q) || item.question.en.toLowerCase().includes(q) ||
        item.answer.ar.includes(q) || item.answer.en.toLowerCase().includes(q);
    }
    return true;
  });

  async function handleSubmitTicket() {
    const errors: Record<string, boolean> = {};
    if (!ticketForm.subject.trim()) errors.subject = true;
    if (!ticketForm.description.trim()) errors.description = true;
    if (Object.keys(errors).length > 0) {
      setTicketErrors(errors);
      return;
    }
    setTicketErrors({});
    setTicketLoading(true);
    try {
      await createSupportTicket(ticketForm);
      setTicketForm({ subject: "", description: "", category: "GENERAL_INQUIRY", priority: "MEDIUM" });
      setShowNewTicket(false);
      const tickets = await getMySupportTickets();
      setMyTickets(tickets);
    } catch (e: unknown) {
      toast.error(
        t("تعذّر إرسال التذكرة. يُرجى المحاولة مرة أخرى.", "We couldn't submit your ticket. Please try again."),
      );
      console.error(e);
    }
    setTicketLoading(false);
  }

  async function handleSubmitPermRequest() {
    if (!permForm.requestedRole || !permForm.reason.trim()) return;
    setPermLoading(true);
    try {
      await createPermissionRequest(permForm);
      setPermForm({ requestedRole: "", reason: "" });
      const reqs = await getMyPermissionRequests();
      setMyRequests(reqs);
    } catch (e: unknown) {
      toast.error(
        t("تعذّر إرسال طلب الصلاحيات. يُرجى المحاولة مرة أخرى.", "We couldn't submit your permission request. Please try again."),
      );
      console.error(e);
    }
    setPermLoading(false);
  }

  async function handleJoinReview(requestId: string, decision: "APPROVED_JOIN" | "DECLINED_JOIN") {
    setJoinReviewActionLoading(true);
    try {
      await reviewJoinRequest(requestId, decision, joinReviewNote || undefined);
      setJoinReviewingId(null);
      setJoinReviewNote("");
      const reqs = await getPendingJoinRequests();
      setPendingJoinRequests(reqs);
    } catch (e: unknown) {
      toast.error(
        t("تعذّر حفظ المراجعة. يُرجى المحاولة مرة أخرى.", "We couldn't save your review. Please try again."),
      );
      console.error(e);
    } finally {
      setJoinReviewActionLoading(false);
    }
  }

  async function handleCancelJoinRequest(requestId: string) {
    setCancellingJoinId(requestId);
    try {
      await cancelJoinRequest(requestId);
      toast.success(
        t("تم إلغاء طلب الانضمام بنجاح.", "Join request cancelled successfully."),
      );
      const updated = await getMyJoinRequests();
      setMyJoinRequests(updated);
    } catch (e: unknown) {
      toast.error(
        t("تعذّر إلغاء الطلب. يُرجى المحاولة مرة أخرى.", "We couldn't cancel this request. Please try again."),
      );
      console.error(e);
    } finally {
      setCancellingJoinId(null);
    }
  }

  async function handleReview(requestId: string, decision: "APPROVED" | "DECLINED") {
    setReviewActionLoading(true);
    try {
      await reviewPermissionRequest(requestId, decision, reviewNote || undefined);
      setReviewingId(null);
      setReviewNote("");
      const reqs = await getPendingPermissionRequests();
      setPendingRequests(reqs);
    } catch (e: unknown) {
      toast.error(
        t("تعذّر حفظ المراجعة. يُرجى المحاولة مرة أخرى.", "We couldn't save your review. Please try again."),
      );
      console.error(e);
    } finally {
      setReviewActionLoading(false);
    }
  }

  const tabIcons: Record<string, React.ElementType> = {
    overview: HelpCircle,
    faq: BookOpen,
    tickets: Ticket,
    permissions: ShieldCheck,
    "join-requests": Users,
    "org-admin": ShieldCheck,
  };

  const tabs: { key: Tab; label: { ar: string; en: string }; adminOnly?: boolean }[] = [
    { key: "overview", label: { ar: "نظرة عامة", en: "Overview" } },
    { key: "faq", label: { ar: "الأسئلة والأدلة", en: "FAQs & Guides" } },
    { key: "tickets", label: { ar: "تذاكري", en: "My Tickets" } },
    { key: "permissions", label: { ar: "طلب صلاحيات", en: "Request Permissions" } },
    { key: "join-requests", label: { ar: "طلباتي", en: "My Requests" } },
    ...(isOrgAdmin ? [{ key: "org-admin" as Tab, label: { ar: "إدارة المنظمة", en: "Org Management" }, adminOnly: true }] : []),
  ];

  const statusBadge = (status: string) => {
    const map: Record<string, { label: { ar: string; en: string }; variant: "default" | "info" | "warning" | "success" | "pending" | "error" }> = {
      OPEN:            { label: { ar: "مفتوحة",        en: "Open" },        variant: "default" },
      IN_PROGRESS:     { label: { ar: "قيد المعالجة",  en: "In Progress" }, variant: "info" },
      WAITING_ON_USER: { label: { ar: "بانتظار الرد",  en: "Waiting" },     variant: "warning" },
      RESOLVED:        { label: { ar: "تم الحل",       en: "Resolved" },    variant: "success" },
      CLOSED:          { label: { ar: "مغلقة",         en: "Closed" },      variant: "default" },
      PENDING:         { label: { ar: "قيد المراجعة",  en: "Pending" },     variant: "warning" },
      APPROVED:        { label: { ar: "تمت الموافقة",  en: "Approved" },    variant: "success" },
      DECLINED:        { label: { ar: "مرفوض",         en: "Declined" },    variant: "error" },
    };
    const entry = map[status] ?? { label: { ar: status, en: status }, variant: "default" as const };
    return <Badge variant={entry.variant} size="sm">{entry.label[lang]}</Badge>;
  };

  const priorityBadge = (priority: string) => {
    const map: Record<string, { label: { ar: string; en: string }; variant: "default" | "info" | "warning" | "error" }> = {
      LOW:    { label: { ar: "منخفضة", en: "Low" },    variant: "default" },
      MEDIUM: { label: { ar: "متوسطة", en: "Medium" }, variant: "info" },
      HIGH:   { label: { ar: "عالية",  en: "High" },   variant: "warning" },
      URGENT: { label: { ar: "عاجلة",  en: "Urgent" }, variant: "error" },
    };
    const entry = map[priority] ?? { label: { ar: priority, en: priority }, variant: "default" as const };
    return <Badge variant={entry.variant} size="sm">{entry.label[lang]}</Badge>;
  };

  const joinRequestStatusBadge = (status: string) => {
    const map: Record<string, { label: { ar: string; en: string }; variant: "default" | "warning" | "success" | "error" | "pending" }> = {
      PENDING_JOIN:   { label: { ar: "قيد المراجعة", en: "Pending" },   variant: "warning" },
      APPROVED_JOIN:  { label: { ar: "تمت الموافقة", en: "Approved" },  variant: "success" },
      DECLINED_JOIN:  { label: { ar: "مرفوض",        en: "Declined" },  variant: "error" },
      EXPIRED_JOIN:   { label: { ar: "انتهت الصلاحية", en: "Expired" }, variant: "default" },
      CANCELLED_JOIN: { label: { ar: "ملغى",          en: "Cancelled" }, variant: "default" },
    };
    const entry = map[status] ?? { label: { ar: status, en: status }, variant: "default" as const };
    return <Badge variant={entry.variant} size="sm">{entry.label[lang]}</Badge>;
  };

  const handleExportTickets = () => {
    const tickets = myTickets;
    exportToExcel({
      data: tickets,
      columns: [
        { header: t("رقم التذكرة", "Ticket #"), key: "ticketNumber", width: 15 },
        { header: t("الموضوع", "Subject"), key: "subject", width: 35 },
        { header: t("الحالة", "Status"), key: "status", width: 18 },
        { header: t("الأولوية", "Priority"), key: "priority", width: 15 },
        { header: t("الفئة", "Category"), key: "category", width: 20, render: (val: string) => { const c = CATEGORY_OPTIONS.find((o) => o.value === val); return c ? c.label[lang] : val ?? ""; } },
        { header: t("تاريخ الإنشاء", "Created Date"), key: "createdAt", width: 18, render: (val: Date) => val ? new Date(val).toLocaleDateString("en-CA") : "" },
      ],
      filename: t("سجل_التذاكر", "tickets_list"),
      lang,
      title: t("سجل التذاكر — معمارك", "Tickets List — Mimarek"),
    });
  };

  const categoryLabel = (cat: string) => {
    const c = CATEGORY_OPTIONS.find((o) => o.value === cat);
    return c ? c.label[lang] : cat;
  };

  // ─── Mobile search/filter state ─────────────────────────────────────────
  const [mobileSearch, setMobileSearch] = React.useState("");
  const [mobileNewTicketOpen, setMobileNewTicketOpen] = React.useState(false);

  const mobileFaqsByCategory = React.useMemo(() => {
    const q = mobileSearch.trim().toLowerCase();
    return FAQ_CATEGORIES.map((cat) => {
      const items = FAQ_ITEMS.filter((item) => {
        if (item.category !== cat.key) return false;
        if (!q) return true;
        return (
          item.question.ar.includes(q) ||
          item.question.en.toLowerCase().includes(q) ||
          item.answer.ar.includes(q) ||
          item.answer.en.toLowerCase().includes(q)
        );
      });
      return { cat, items };
    }).filter((g) => g.items.length > 0);
  }, [mobileSearch]);

  // Load tickets on mobile when panel is opened or for agents viewing stats
  React.useEffect(() => {
    if (isOrgAdmin) {
      getMySupportTickets().then(setMyTickets).catch(() => {});
    }
  }, [isOrgAdmin]);

  const mobileTicketStats = React.useMemo(() => {
    const open = myTickets.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS").length;
    const resolved = myTickets.filter((t) => t.status === "RESOLVED" || t.status === "CLOSED").length;
    return { open, resolved, total: myTickets.length };
  }, [myTickets]);

  // ─── DataTable columns (reference tables migrated from raw <table>) ──
  // Columns are defined inside the component so cell renderers close over
  // `lang` and any inline-review state. All four tables below disable
  // pagination and do not supply a searchPlaceholder — they're short
  // role/state-scoped lists, not data grids. The mobile-card transform
  // comes from the DataTable primitive's `mobileCard` prop (per
  // CLAUDE.md § 6.10 / § 6.14.3).

  const ticketColumns: ColumnDef<SupportTicketRow, unknown>[] = [
    {
      id: "ticketNumber",
      accessorKey: "ticketNumber",
      header: "#",
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.ticketNumber}</span>
      ),
    },
    {
      id: "subject",
      accessorKey: "subject",
      header: t("الموضوع", "Subject"),
      cell: ({ row }) => (
        <Link
          href={`/dashboard/help/tickets/${row.original.id}`}
          className="text-primary hover:underline font-medium"
        >
          {row.original.subject}
        </Link>
      ),
    },
    {
      id: "category",
      accessorKey: "category",
      header: t("الفئة", "Category"),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {categoryLabel(row.original.category)}
        </span>
      ),
    },
    {
      id: "priority",
      accessorKey: "priority",
      header: t("الأولوية", "Priority"),
      cell: ({ row }) => priorityBadge(row.original.priority),
      meta: { align: "center" },
    },
    {
      id: "status",
      accessorKey: "status",
      header: t("الحالة", "Status"),
      cell: ({ row }) => statusBadge(row.original.status),
      meta: { align: "center" },
    },
    {
      id: "messages",
      header: () => <MessageSquare className="h-3.5 w-3.5" aria-label={t("الرسائل", "Messages")} />,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground tabular-nums">
          {row.original._count?.messages ?? 0}
        </span>
      ),
      meta: { align: "center" },
      enableSorting: false,
    },
    {
      id: "createdAt",
      accessorKey: "createdAt",
      header: t("التاريخ", "Date"),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {new Date(row.original.createdAt).toLocaleDateString("en-CA")}
        </span>
      ),
    },
  ];

  const permHistoryColumns: ColumnDef<PermissionRequestRow, unknown>[] = [
    {
      id: "requestedRole",
      accessorKey: "requestedRole",
      header: t("الدور المطلوب", "Requested Role"),
      cell: ({ row }) => (
        <span className="font-medium">{row.original.requestedRole}</span>
      ),
    },
    {
      id: "reason",
      accessorKey: "reason",
      header: t("السبب", "Reason"),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground block max-w-[200px] truncate">
          {row.original.reason}
        </span>
      ),
    },
    {
      id: "status",
      accessorKey: "status",
      header: t("الحالة", "Status"),
      cell: ({ row }) => statusBadge(row.original.status),
      meta: { align: "center" },
    },
    {
      id: "reviewNote",
      accessorKey: "reviewNote",
      header: t("ملاحظة المراجع", "Review Note"),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.reviewNote ?? "—"}
        </span>
      ),
    },
    {
      id: "createdAt",
      accessorKey: "createdAt",
      header: t("التاريخ", "Date"),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {new Date(row.original.createdAt).toLocaleDateString("en-CA")}
        </span>
      ),
    },
  ];

  const pendingPermRequestColumns: ColumnDef<PendingPermissionRequestRow, unknown>[] = [
    {
      id: "user",
      header: t("المستخدم", "User"),
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.user?.name}</div>
          <div className="text-[10px] text-muted-foreground">{row.original.user?.email}</div>
        </div>
      ),
    },
    {
      id: "currentRole",
      header: t("الدور الحالي", "Current Role"),
      cell: ({ row }) => <span className="text-xs">{row.original.user?.role}</span>,
    },
    {
      id: "requestedRole",
      accessorKey: "requestedRole",
      header: t("الدور المطلوب", "Requested Role"),
      cell: ({ row }) => (
        <span className="text-xs font-bold text-secondary">{row.original.requestedRole}</span>
      ),
    },
    {
      id: "reason",
      accessorKey: "reason",
      header: t("السبب", "Reason"),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground block max-w-[200px]">
          {row.original.reason}
        </span>
      ),
    },
    {
      id: "createdAt",
      accessorKey: "createdAt",
      header: t("التاريخ", "Date"),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {new Date(row.original.createdAt).toLocaleDateString("en-CA")}
        </span>
      ),
    },
    {
      id: "action",
      header: t("إجراء", "Action"),
      enableSorting: false,
      cell: ({ row }) => {
        const req = row.original;
        if (reviewingId === req.id) {
          return (
            <div className="space-y-2">
              <input
                type="text"
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder={t("ملاحظة (اختياري)", "Note (optional)")}
                className="w-full border border-border rounded px-2 py-1 text-xs outline-none"
              />
              <div className="flex gap-1">
                <Button size="sm" variant="success" onClick={() => handleReview(req.id, "APPROVED")} disabled={reviewActionLoading} className="h-6 px-2 text-[10px]" style={{ display: "inline-flex" }}>
                  {reviewActionLoading ? <Loader2 className="h-3 w-3 me-1 animate-spin" /> : <CheckCircle2 className="h-3 w-3 me-1" />}{t("موافقة", "Approve")}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleReview(req.id, "DECLINED")} disabled={reviewActionLoading} className="h-6 px-2 text-[10px]" style={{ display: "inline-flex" }}>
                  {reviewActionLoading ? <Loader2 className="h-3 w-3 me-1 animate-spin" /> : <XCircle className="h-3 w-3 me-1" />}{t("رفض", "Decline")}
                </Button>
              </div>
            </div>
          );
        }
        return (
          <Button size="sm" variant="secondary" onClick={() => setReviewingId(req.id)} className="h-7 text-xs">
            {t("مراجعة", "Review")}
          </Button>
        );
      },
    },
  ];

  const pendingJoinRequestColumns: ColumnDef<PendingJoinRequestRow, unknown>[] = [
    {
      id: "user",
      header: t("المستخدم", "User"),
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.user?.name}</div>
          <div className="text-[10px] text-muted-foreground">{row.original.user?.email}</div>
        </div>
      ),
    },
    {
      id: "crNumber",
      accessorKey: "crNumber",
      header: t("رقم السجل", "CR Number"),
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.crNumber}</span>
      ),
    },
    {
      id: "reason",
      accessorKey: "reason",
      header: t("السبب", "Reason"),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground block max-w-[200px]">
          {row.original.reason ?? "—"}
        </span>
      ),
    },
    {
      id: "createdAt",
      accessorKey: "createdAt",
      header: t("التاريخ", "Date"),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {new Date(row.original.createdAt).toLocaleDateString("en-CA")}
        </span>
      ),
    },
    {
      id: "action",
      header: t("إجراء", "Action"),
      enableSorting: false,
      cell: ({ row }) => {
        const req = row.original;
        if (joinReviewingId === req.id) {
          return (
            <div className="space-y-2">
              <input
                type="text"
                value={joinReviewNote}
                onChange={(e) => setJoinReviewNote(e.target.value)}
                placeholder={t("ملاحظة (اختياري)", "Note (optional)")}
                className="w-full border border-border rounded px-2 py-1 text-xs outline-none"
              />
              <div className="flex gap-1">
                <Button size="sm" variant="success" onClick={() => handleJoinReview(req.id, "APPROVED_JOIN")} disabled={joinReviewActionLoading} className="h-6 px-2 text-[10px]" style={{ display: "inline-flex" }}>
                  {joinReviewActionLoading ? <Loader2 className="h-3 w-3 me-1 animate-spin" /> : <CheckCircle2 className="h-3 w-3 me-1" />}{t("موافقة", "Approve")}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleJoinReview(req.id, "DECLINED_JOIN")} disabled={joinReviewActionLoading} className="h-6 px-2 text-[10px]" style={{ display: "inline-flex" }}>
                  {joinReviewActionLoading ? <Loader2 className="h-3 w-3 me-1 animate-spin" /> : <XCircle className="h-3 w-3 me-1" />}{t("رفض", "Decline")}
                </Button>
              </div>
            </div>
          );
        }
        return (
          <Button size="sm" variant="secondary" onClick={() => setJoinReviewingId(req.id)} className="h-7 text-xs">
            {t("مراجعة", "Review")}
          </Button>
        );
      },
    },
  ];

  return (
    <>
    {/* ─── Mobile (< md) ──────────────────────────────────────────────── */}
    <div
      className="md:hidden -m-4 sm:-m-6 min-h-dvh flex flex-col bg-background"
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <AppBar
        title={t("المساعدة", "Help")}
        subtitle={t("الأسئلة والدعم", "FAQs & Support")}
        lang={lang}
      />

      <div className="flex-1 overflow-y-auto pb-[calc(theme(height.mobile-bottomnav)+env(safe-area-inset-bottom)+6rem)]">
        {/* Agent ticket stats */}
        {isOrgAdmin && (
          <div className="px-4 pt-4 grid grid-cols-2 gap-3">
            <MobileKPICard
              label={t("تذاكر مفتوحة", "Open Tickets")}
              value={<span className="tabular-nums">{mobileTicketStats.open}</span>}
              icon={Ticket}
              tone="amber"
            />
            <MobileKPICard
              label={t("تم الحل", "Resolved")}
              value={<span className="tabular-nums">{mobileTicketStats.resolved}</span>}
              icon={CheckCircle2}
              tone="green"
            />
          </div>
        )}

        {/* Search */}
        <div className="px-4 pt-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground start-3"
              aria-hidden="true"
            />
            <UIInput
              value={mobileSearch}
              onChange={(e) => setMobileSearch(e.target.value)}
              placeholder={t("ابحث في الأسئلة...", "Search FAQs...")}
              className="h-10 ps-9"
            />
          </div>
        </div>

        {/* Contact support CTA */}
        <div className="px-4 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setMobileNewTicketOpen(true)}
            className="w-full min-h-11 bg-primary/10 border-primary/20 rounded-xl p-4 justify-start gap-3 text-start h-auto hover:bg-primary/15 active:bg-primary/20"
            style={{ display: "inline-flex" }}
          >
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <LifeBuoy className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 text-start">
              <div className="text-sm font-semibold text-foreground">
                {t("تواصل مع الدعم الفني", "Contact Support")}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {t("افتح تذكرة جديدة وسيرد عليك فريقنا قريباً", "Open a new ticket and our team will reply shortly")}
              </div>
            </div>
            <ChevronRight
              className="h-5 w-5 shrink-0 text-primary rtl:scale-x-[-1]"
              aria-hidden="true"
            />
          </Button>
        </div>

        {/* FAQ categories */}
        <div className="px-4 pt-5 pb-4">
          <h2 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {t("الأسئلة الشائعة", "FAQs")}
          </h2>
          {mobileFaqsByCategory.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-6 text-center">
              <p className="text-sm text-muted-foreground">{t("لا توجد نتائج مطابقة.", "No matching FAQs.")}</p>
              <Button variant="outline" size="sm" className="mt-3" style={{ display: "inline-flex" }} onClick={() => setMobileNewTicketOpen(true)}>
                {t("افتح تذكرة", "Open a ticket")}
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card">
              <Accordion type="single" collapsible className="w-full">
                {mobileFaqsByCategory.map((group) => (
                  <AccordionItem
                    key={group.cat.key}
                    value={group.cat.key}
                    className="border-border last:border-b-0 px-4"
                  >
                    <AccordionTrigger className="min-h-11 text-sm font-semibold text-foreground hover:no-underline">
                      <span className="flex items-center gap-2">
                        {group.cat.label[lang]}
                        <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-muted px-1.5 text-[10px] font-bold text-muted-foreground tabular-nums">
                          {group.items.length}
                        </span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="px-0">
                      <div className="divide-y divide-border">
                        {group.items.map((item) => (
                          <details
                            key={item.id}
                            className="group py-2"
                          >
                            <summary className="min-h-11 flex items-center justify-between gap-2 cursor-pointer list-none text-sm text-foreground">
                              <span className="flex-1 leading-snug">
                                {item.question[lang]}
                              </span>
                              <ChevronDown
                                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                                aria-hidden="true"
                              />
                            </summary>
                            <div className="mt-2 text-xs text-muted-foreground leading-relaxed">
                              {item.answer[lang]}
                            </div>
                          </details>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          )}
        </div>

        {/* Permission request quick link — DataCard is its own surface (no card-in-card) */}
        <div className="px-4 pb-6">
          <div>
            <div>
              <DataCard
                title={t("طلب ترقية صلاحيات", "Request Permission Upgrade")}
                subtitle={
                  t(`دورك الحالي: ${userRole}`, `Current role: ${userRole}`)
                }
                icon={ShieldCheck}
                iconTone="amber"
                trailing={
                  <ChevronRight
                    className="h-4 w-4 text-muted-foreground rtl:scale-x-[-1]"
                    aria-hidden="true"
                  />
                }
                onClick={() => setActiveTab("permissions")}
                divider={false}
              />
            </div>
          </div>
        </div>
      </div>

      <FAB
        icon={Plus}
        label={t("تذكرة جديدة", "New ticket")}
        onClick={() => setMobileNewTicketOpen(true)}
      />

      {/* New ticket bottom sheet */}
      <BottomSheet
        open={mobileNewTicketOpen}
        onOpenChange={setMobileNewTicketOpen}
        title={t("تذكرة جديدة", "New Ticket")}
        description={t("صف المشكلة وسيتواصل فريق الدعم معك.", "Describe the issue and our support team will reply.")}
        footer={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="flex-1 min-h-11"
              style={{ display: "inline-flex" }}
              onClick={() => setMobileNewTicketOpen(false)}
              disabled={ticketLoading}
            >
              {t("إلغاء", "Cancel")}
            </Button>
            <Button
              className="flex-1 min-h-11 gap-1"
              style={{ display: "inline-flex" }}
              onClick={async () => {
                await handleSubmitTicket();
                if (!ticketErrors.subject && !ticketErrors.description) {
                  setMobileNewTicketOpen(false);
                }
              }}
              disabled={ticketLoading}
            >
              {ticketLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4 rtl:scale-x-[-1]" aria-hidden="true" />
              )}
              {ticketLoading
                ? t("جاري الإرسال...", "Submitting...")
                : t("إرسال", "Submit")}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {t("الموضوع", "Subject")}
              <span className="text-destructive ms-1">*</span>
            </label>
            <UIInput
              value={ticketForm.subject}
              onChange={(e) => {
                setTicketForm({ ...ticketForm, subject: e.target.value });
                if (ticketErrors.subject) setTicketErrors((prev) => ({ ...prev, subject: false }));
              }}
              placeholder={t("مثال: مشكلة في تسجيل الدخول", "e.g. Login issue")}
              className={ticketErrors.subject ? "border-destructive" : undefined}
            />
            {ticketErrors.subject && (
              <p className="mt-1 text-xs text-destructive">
                {t("هذا الحقل مطلوب", "This field is required")}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {t("الفئة", "Category")}
              </label>
              <SelectField
                aria-label={t("الفئة", "Category")}
                value={ticketForm.category}
                onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value })}
                className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label[lang]}</option>
                ))}
              </SelectField>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {t("الأولوية", "Priority")}
              </label>
              <SelectField
                aria-label={t("الأولوية", "Priority")}
                value={ticketForm.priority}
                onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value })}
                className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label[lang]}</option>
                ))}
              </SelectField>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {t("الوصف", "Description")}
              <span className="text-destructive ms-1">*</span>
            </label>
            <Textarea
              value={ticketForm.description}
              onChange={(e) => {
                setTicketForm({ ...ticketForm, description: e.target.value });
                if (ticketErrors.description) setTicketErrors((prev) => ({ ...prev, description: false }));
              }}
              placeholder={t("وصف المشكلة أو الطلب...", "Describe the issue or request...")}
              rows={4}
              className={ticketErrors.description ? "border-destructive" : undefined}
            />
            {ticketErrors.description && (
              <p className="mt-1 text-xs text-destructive">
                {t("هذا الحقل مطلوب", "This field is required")}
              </p>
            )}
          </div>
        </div>
      </BottomSheet>
    </div>

    {/* ─── Desktop (≥ md) ─ unchanged ───────────────────────────────── */}
    <div className="hidden md:block">
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* Header */}
      <PageHeader
        title={t("مركز المساعدة", "Help Center")}
        description={t("الأسئلة الشائعة، الدعم الفني، وطلب الصلاحيات", "FAQs, technical support, and permission requests")}
      />

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const Icon = tabIcons[tab.key] ?? HelpCircle;
          const isActive = activeTab === tab.key;
          return (
            <Button
              key={tab.key}
              variant={isActive ? "primary" : "subtle"}
              size="sm"
              onClick={() => setActiveTab(tab.key)}
              aria-pressed={isActive}
              className={cn(
                "gap-2 whitespace-nowrap rounded-full",
                isActive ? "shadow-md" : "text-muted-foreground"
              )}
              style={{ display: "inline-flex" }}
            >
              <Icon className="h-4 w-4" />
              {tab.label[lang]}
            </Button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Search hero */}
          <div className="bg-card rounded-lg border border-border p-6 md:p-8 text-center">
            <h2 className="text-lg font-bold text-foreground">{t("كيف يمكننا مساعدتك؟", "How can we help?")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("ابحث في الأسئلة والأدلة، أو تواصل مع الدعم.", "Search our FAQs and guides, or contact support.")}</p>
            <form
              onSubmit={(e) => { e.preventDefault(); goToFaq({ search: overviewSearch, category: "all" }); }}
              className="relative mx-auto mt-4 max-w-xl"
            >
              <Search className="h-[18px] w-[18px] absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                type="text"
                value={overviewSearch}
                onChange={(e) => setOverviewSearch(e.target.value)}
                placeholder={t("ابحث في المساعدة...", "Search help...")}
                aria-label={t("ابحث في المساعدة", "Search help")}
                className="w-full bg-background border border-border rounded-md py-2.5 ps-10 pe-4 text-sm focus:border-primary/30 focus:ring-0 outline-none"
              />
            </form>
          </div>

          {/* Popular questions */}
          <div>
            <h3 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{t("الأسئلة الأكثر شيوعاً", "Popular questions")}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {popularFaqs.map((item) => (
                <Button
                  key={item.id}
                  variant="ghost"
                  onClick={() => goToFaq({ category: item.category, openId: item.id })}
                  className="w-full justify-between gap-2 h-auto px-4 py-3 text-start text-sm font-medium text-foreground bg-card border border-border rounded-md hover:border-primary/30 hover:bg-muted/10 transition-colors"
                  style={{ display: "inline-flex" }}
                >
                  <span className="line-clamp-1">{item.question[lang]}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground icon-directional" aria-hidden="true" />
                </Button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              onClick={() => { setActiveTab("tickets"); setShowNewTicket(true); }}
              className="w-full bg-card p-6 rounded-md shadow-card h-auto justify-start flex-col items-start hover:shadow-lg hover:-translate-y-0.5 transition-all text-start"
              style={{ display: "inline-flex" }}
            >
              <LifeBuoy className="h-8 w-8 text-secondary mb-3" />
              <h3 className="font-bold text-foreground">{t("تواصل مع الدعم", "Contact Support")}</h3>
              <p className="text-xs text-muted-foreground mt-1">{t("افتح تذكرة وسيرد عليك فريقنا", "Open a ticket and our team will reply")}</p>
            </Button>
            <Button
              variant="outline"
              onClick={() => setActiveTab("faq")}
              className="w-full bg-card p-6 rounded-md shadow-card h-auto justify-start flex-col items-start hover:shadow-lg hover:-translate-y-0.5 transition-all text-start"
              style={{ display: "inline-flex" }}
            >
              <BookOpen className="h-8 w-8 text-info mb-3" />
              <h3 className="font-bold text-foreground">{t("الأسئلة والأدلة", "FAQs & Guides")}</h3>
              <p className="text-xs text-muted-foreground mt-1">{t("تصفّح كل الأسئلة وأدلة الاستخدام", "Browse all FAQs and usage guides")}</p>
            </Button>
            <Button
              variant="outline"
              onClick={() => setActiveTab("permissions")}
              className="w-full bg-card p-6 rounded-md shadow-card h-auto justify-start flex-col items-start hover:shadow-lg hover:-translate-y-0.5 transition-all text-start"
              style={{ display: "inline-flex" }}
            >
              <ShieldCheck className="h-8 w-8 text-warning mb-3" />
              <h3 className="font-bold text-foreground">{t("طلب صلاحيات", "Request Permissions")}</h3>
              <p className="text-xs text-muted-foreground mt-1">{t("اطلب ترقية صلاحياتك في النظام", "Request a role upgrade in the system")}</p>
            </Button>
          </div>
        </div>
      )}

      {activeTab === "faq" && (
        <div id="help-faq-section" className="space-y-6 scroll-mt-4">
          {/* Search */}
          <div className="relative">
            <Search className="h-[18px] w-[18px] absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={faqSearch}
              onChange={(e) => setFaqSearch(e.target.value)}
              placeholder={t("ابحث في الأسئلة الشائعة...", "Search FAQs...")}
              className="w-full bg-card border border-border rounded-md py-2.5 pe-10 ps-4 text-sm focus:border-primary/30 focus:ring-0 outline-none"
            />
          </div>

          {/* Category Pills */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            <Button
              size="sm"
              variant={faqCategory === "all" ? "primary" : "subtle"}
              onClick={() => setFaqCategory("all")}
              aria-pressed={faqCategory === "all"}
              className="rounded-full whitespace-nowrap"
              style={{ display: "inline-flex" }}
            >
              {t("الكل", "All")}
            </Button>
            {FAQ_CATEGORIES.map((cat) => (
              <Button
                key={cat.key}
                size="sm"
                variant={faqCategory === cat.key ? "primary" : "subtle"}
                onClick={() => setFaqCategory(cat.key)}
                aria-pressed={faqCategory === cat.key}
                className="rounded-full whitespace-nowrap"
                style={{ display: "inline-flex" }}
              >
                {cat.label[lang]}
              </Button>
            ))}
          </div>

          {/* FAQ Accordion */}
          {filteredFaqs.length === 0 ? (
            <div className="bg-card rounded-md border border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {lang === "ar"
                  ? `لا توجد نتائج${faqSearch ? ` لـ "${faqSearch}"` : ""}`
                  : `No results${faqSearch ? ` for "${faqSearch}"` : ""}`}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                style={{ display: "inline-flex" }}
                onClick={() => { setActiveTab("tickets"); setShowNewTicket(true); }}
              >
                {t("لم تجد ما تبحث عنه؟ افتح تذكرة", "Didn't find it? Open a ticket")}
              </Button>
            </div>
          ) : faqCategory === "all" && !faqSearch ? (
            // Grouped by category when browsing everything — avoids a long flat wall.
            <div className="space-y-5">
              {FAQ_CATEGORIES.map((cat) => {
                const items = filteredFaqs.filter((f) => f.category === cat.key);
                if (items.length === 0) return null;
                return (
                  <div key={cat.key}>
                    <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{cat.label[lang]}</h3>
                    <div className="bg-card rounded-md border border-border divide-y divide-border">
                      {items.map(renderFaqRow)}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-card rounded-md border border-border divide-y divide-border">
              {filteredFaqs.map(renderFaqRow)}
            </div>
          )}

          {/* Guides */}
          <div>
            <h2 className="text-lg font-bold text-foreground mb-4">{t("أدلة الاستخدام", "Usage Guides")}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {GUIDE_ITEMS.map((guide, idx) => (
                <div key={guide.id} className="bg-card rounded-md border border-border overflow-hidden flex flex-col">
                  <Button
                    variant="ghost"
                    onClick={() => setOpenGuide(openGuide === guide.id ? null : guide.id)}
                    className="w-full text-start p-4 h-auto justify-start items-start gap-3 hover:bg-muted/20 transition-colors rounded-none"
                    style={{ display: "inline-flex" }}
                  >
                    <span className="min-w-[32px] h-8 rounded-md bg-secondary/10 text-secondary flex items-center justify-center text-sm font-bold mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0 text-start">
                      <h3 className="font-bold text-foreground text-sm leading-snug">{guide.title[lang]}</h3>
                      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{guide.description[lang]}</p>
                    </div>
                    <span className={cn(
                      "min-w-[24px] h-6 w-6 rounded-full flex items-center justify-center transition-all mt-0.5",
                      openGuide === guide.id
                        ? "bg-secondary/15 text-secondary rotate-180"
                        : "bg-muted/50 text-muted-foreground"
                    )}>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </span>
                  </Button>
                  {openGuide === guide.id && (
                    <div className="px-4 pb-4 border-t border-border bg-muted/5">
                      <ol className="mt-3 space-y-2.5">
                        {guide.steps.map((step, i) => (
                          <li key={i} className="flex gap-2.5 text-xs text-muted-foreground">
                            <span className="min-w-[22px] h-[22px] rounded-full bg-secondary/10 text-secondary flex items-center justify-center text-[10px] font-bold shrink-0">
                              {i + 1}
                            </span>
                            <span className="pt-0.5 leading-relaxed">{step[lang]}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "tickets" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">{t("تذاكري", "My Tickets")}</h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" style={{ display: "inline-flex" }} onClick={handleExportTickets}>
                <Download className="h-4 w-4" />
                {t("تصدير التذاكر", "Export Tickets")}
              </Button>
              <Button size="sm" onClick={() => setShowNewTicket(!showNewTicket)}>
                {t("تذكرة جديدة", "New Ticket")}
              </Button>
            </div>
          </div>

          {/* New Ticket Form */}
          {showNewTicket && (
            <div className="bg-card p-4 rounded-md border border-border space-y-3">
              <div>
                <input
                  type="text"
                  value={ticketForm.subject}
                  onChange={(e) => { setTicketForm({ ...ticketForm, subject: e.target.value }); if (ticketErrors.subject) setTicketErrors((prev) => ({ ...prev, subject: false })); }}
                  placeholder={t("الموضوع", "Subject")}
                  className={`w-full border rounded-md px-3 py-2 text-sm focus:border-primary/30 outline-none ${ticketErrors.subject ? "border-destructive" : "border-border"}`}
                />
                {ticketErrors.subject && (
                  <p className="text-xs text-destructive mt-1">{t("هذا الحقل مطلوب", "This field is required")}</p>
                )}
              </div>
              <div className="flex gap-3">
                <SelectField aria-label={t("الفئة", "Category")} value={ticketForm.category} onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label[lang]}</option>)}
                </SelectField>
                <SelectField aria-label={t("الأولوية", "Priority")} value={ticketForm.priority} onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label[lang]}</option>)}
                </SelectField>
              </div>
              <div>
                <textarea
                  value={ticketForm.description}
                  onChange={(e) => { setTicketForm({ ...ticketForm, description: e.target.value }); if (ticketErrors.description) setTicketErrors((prev) => ({ ...prev, description: false })); }}
                  placeholder={t("وصف المشكلة أو الطلب...", "Describe the issue or request...")}
                  rows={4}
                  className={`w-full border rounded-md px-3 py-2 text-sm focus:border-primary/30 outline-none resize-none ${ticketErrors.description ? "border-destructive" : "border-border"}`}
                />
                {ticketErrors.description && (
                  <p className="text-xs text-destructive mt-1">{t("هذا الحقل مطلوب", "This field is required")}</p>
                )}
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setShowNewTicket(false)} disabled={ticketLoading} style={{ display: "inline-flex" }}>{t("إلغاء", "Cancel")}</Button>
                <Button variant="success" size="sm" onClick={handleSubmitTicket} disabled={ticketLoading} style={{ display: "inline-flex" }} className="gap-1">
                  {ticketLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  {ticketLoading ? (t("جاري الإرسال...", "Submitting...")) : (t("إرسال", "Submit"))}
                </Button>
              </div>
            </div>
          )}

          <DataTable
            columns={ticketColumns}
            data={myTickets}
            locale={lang}
            pagination={false}
            getRowId={(t) => t.id}
            emptyTitle={t("لا توجد تذاكر", "No tickets yet")}
            emptyDescription={t("ستظهر تذاكرك هنا عند إنشائها.", "Your support tickets will appear here once you create them.")}
            mobileCard={(ticket: SupportTicketRow) => (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <Link href={`/dashboard/help/tickets/${ticket.id}`} className="font-medium text-primary hover:underline block truncate">
                      {ticket.subject}
                    </Link>
                    <span className="font-mono text-[10px] text-muted-foreground">{ticket.ticketNumber}</span>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {statusBadge(ticket.status)}
                    {priorityBadge(ticket.priority)}
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{categoryLabel(ticket.category)}</span>
                  <span className="inline-flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    <span className="tabular-nums">{ticket._count?.messages ?? 0}</span>
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {new Date(ticket.createdAt).toLocaleDateString("en-CA")}
                </div>
              </div>
            )}
          />
        </div>
      )}

      {activeTab === "permissions" && (
        <div className="space-y-6">
          {/* Request Form */}
          <div className="bg-card p-4 rounded-md border border-border space-y-3">
            <h2 className="font-bold text-foreground">{t("طلب ترقية الصلاحيات", "Request Permission Upgrade")}</h2>
            <p className="text-xs text-muted-foreground">{t("دورك الحالي: ", "Your current role: ")}<span className="font-bold">{userRole}</span></p>
            <SelectField aria-label={t("الدور المطلوب", "Requested role")} value={permForm.requestedRole} onChange={(e) => setPermForm({ ...permForm, requestedRole: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <option value="">{t("اختر الدور المطلوب", "Select requested role")}</option>
              {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label[lang]} ({o.value})</option>)}
            </SelectField>
            <textarea
              value={permForm.reason}
              onChange={(e) => setPermForm({ ...permForm, reason: e.target.value })}
              placeholder={t("سبب الطلب...", "Reason for request...")}
              rows={3}
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:border-primary/30 outline-none resize-none"
            />
            <Button variant="success" size="sm" onClick={handleSubmitPermRequest} disabled={permLoading || !permForm.requestedRole || !permForm.reason.trim()}>
              <Send className="h-3.5 w-3.5 me-1" />
              {permLoading ? "..." : (t("إرسال الطلب", "Submit Request"))}
            </Button>
          </div>

          {/* Request History */}
          <div>
            <h3 className="font-bold text-foreground mb-2">{t("سجل الطلبات", "Request History")}</h3>
            <DataTable
              columns={permHistoryColumns}
              data={myRequests}
              locale={lang}
              pagination={false}
              getRowId={(r) => r.id}
              emptyTitle={t("لا توجد طلبات", "No requests yet")}
              emptyDescription={t("ستظهر طلبات الصلاحيات هنا.", "Your permission requests will appear here.")}
              mobileCard={(req: PermissionRequestRow) => (
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{req.requestedRole}</div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{req.reason}</p>
                    </div>
                    <div className="shrink-0">{statusBadge(req.status)}</div>
                  </div>
                  {req.reviewNote && (
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">{t("ملاحظة المراجع: ", "Review note: ")}</span>
                      {req.reviewNote}
                    </div>
                  )}
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(req.createdAt).toLocaleDateString("en-CA")}
                  </div>
                </div>
              )}
            />
          </div>
        </div>
      )}

      {/* My Join Requests Tab */}
      {activeTab === "join-requests" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">
              {t("طلبات الانضمام للمنشأة", "My Organization Join Requests")}
            </h2>
          </div>

          {myJoinRequests.length === 0 ? (
            <div className="bg-card rounded-md border border-border p-10 text-center space-y-3">
              <Users className="mx-auto h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
              <p className="font-medium text-foreground">
                {t("لا توجد طلبات انضمام", "No join requests yet")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("ستظهر هنا طلبات الانضمام التي أرسلتها إلى منشآت أخرى.", "Join requests you send to organizations will appear here.")}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {myJoinRequests.map((req) => {
                const orgName = lang === "ar"
                  ? (req.targetOrg?.nameArabic || req.targetOrg?.name || "—")
                  : (req.targetOrg?.nameEnglish || req.targetOrg?.name || "—");
                const isPending = req.status === "PENDING_JOIN";
                const submittedDate = req.createdAt
                  ? new Date(req.createdAt).toLocaleDateString("ar-SA-u-nu-latn", { year: "numeric", month: "long", day: "numeric" })
                  : "—";
                const expiryDate = req.expiresAt
                  ? new Date(req.expiresAt).toLocaleDateString("ar-SA-u-nu-latn", { year: "numeric", month: "long", day: "numeric" })
                  : null;

                return (
                  <div key={req.id} className="bg-card rounded-md border border-border p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm text-foreground">{orgName}</div>
                        {req.targetOrg?.nameArabic && req.targetOrg?.nameEnglish && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {lang === "ar" ? req.targetOrg.nameEnglish : req.targetOrg.nameArabic}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0">{joinRequestStatusBadge(req.status)}</div>
                    </div>

                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        <span className="font-medium text-foreground">
                          {t("تاريخ الإرسال: ", "Submitted: ")}
                        </span>
                        <span dir="ltr" className="tabular-nums">{submittedDate}</span>
                      </span>
                      {isPending && expiryDate && (
                        <span>
                          <span className="font-medium text-foreground">
                            {t("ينتهي: ", "Expires: ")}
                          </span>
                          <span dir="ltr" className="tabular-nums">{expiryDate}</span>
                        </span>
                      )}
                    </div>

                    {req.reviewNote && (
                      <p className="text-xs text-muted-foreground bg-muted/30 rounded px-3 py-2">
                        <span className="font-medium text-foreground">
                          {t("ملاحظة المراجع: ", "Review note: ")}
                        </span>
                        {req.reviewNote}
                      </p>
                    )}

                    {isPending && (
                      <div className="flex justify-end">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleCancelJoinRequest(req.id)}
                          disabled={cancellingJoinId === req.id}
                          style={{ display: "inline-flex" }}
                          className="gap-1.5"
                        >
                          {cancellingJoinId === req.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          {cancellingJoinId === req.id
                            ? (t("جاري الإلغاء...", "Cancelling..."))
                            : (t("إلغاء الطلب", "Cancel request"))}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Org Management Tab — visible to COMPANY_ADMIN (via help:manage_permissions) */}
      {activeTab === "org-admin" && isOrgAdmin && (
        <div className="space-y-6">
          {/* Pending Permission Requests */}
          <div>
            <h2 className="text-lg font-bold text-foreground mb-3">{t("طلبات الصلاحيات المعلقة", "Pending Permission Requests")}</h2>
            <DataTable
              columns={pendingPermRequestColumns}
              data={pendingRequests}
              locale={lang}
              pagination={false}
              getRowId={(r) => r.id}
              emptyTitle={t("لا توجد طلبات معلقة", "No pending requests")}
              emptyDescription={t("ستظهر هنا طلبات ترقية الصلاحيات التي تنتظر المراجعة.", "Permission-upgrade requests awaiting review will appear here.")}
              mobileCard={(req: PendingPermissionRequestRow) => (
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{req.user?.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{req.user?.email}</div>
                    </div>
                    <div className="text-end shrink-0 text-[11px]">
                      <span className="text-muted-foreground">{req.user?.role}</span>
                      <ChevronRight className="inline h-3 w-3 mx-1 icon-directional" />
                      <span className="font-bold text-secondary">{req.requestedRole}</span>
                    </div>
                  </div>
                  {req.reason && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{req.reason}</p>
                  )}
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(req.createdAt).toLocaleDateString("en-CA")}
                  </div>
                  <div className="pt-1">
                    {reviewingId === req.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={reviewNote}
                          onChange={(e) => setReviewNote(e.target.value)}
                          placeholder={t("ملاحظة (اختياري)", "Note (optional)")}
                          className="w-full border border-border rounded px-2 py-1 text-xs outline-none"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" variant="success" onClick={() => handleReview(req.id, "APPROVED")} disabled={reviewActionLoading} className="h-8 px-3 text-xs flex-1" style={{ display: "inline-flex" }}>
                            {reviewActionLoading ? <Loader2 className="h-3 w-3 me-1 animate-spin" /> : <CheckCircle2 className="h-3 w-3 me-1" />}{t("موافقة", "Approve")}
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleReview(req.id, "DECLINED")} disabled={reviewActionLoading} className="h-8 px-3 text-xs flex-1" style={{ display: "inline-flex" }}>
                            {reviewActionLoading ? <Loader2 className="h-3 w-3 me-1 animate-spin" /> : <XCircle className="h-3 w-3 me-1" />}{t("رفض", "Decline")}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => setReviewingId(req.id)} className="h-8 text-xs w-full">
                        {t("مراجعة", "Review")}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            />
          </div>

          {/* Pending Join Requests */}
          <div>
            <h2 className="text-lg font-bold text-foreground mb-3">{t("طلبات الانضمام المعلقة", "Pending Join Requests")}</h2>
            <DataTable
              columns={pendingJoinRequestColumns}
              data={pendingJoinRequests}
              locale={lang}
              pagination={false}
              getRowId={(r) => r.id}
              emptyTitle={t("لا توجد طلبات انضمام", "No pending join requests")}
              emptyDescription={t("ستظهر هنا طلبات الانضمام للمنظمة التي تنتظر المراجعة.", "Organization join requests awaiting review will appear here.")}
              mobileCard={(req: PendingJoinRequestRow) => (
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{req.user?.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{req.user?.email}</div>
                    </div>
                    <span className="font-mono text-[11px] text-muted-foreground shrink-0">{req.crNumber}</span>
                  </div>
                  {req.reason && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{req.reason}</p>
                  )}
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(req.createdAt).toLocaleDateString("en-CA")}
                  </div>
                  <div className="pt-1">
                    {joinReviewingId === req.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={joinReviewNote}
                          onChange={(e) => setJoinReviewNote(e.target.value)}
                          placeholder={t("ملاحظة (اختياري)", "Note (optional)")}
                          className="w-full border border-border rounded px-2 py-1 text-xs outline-none"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" variant="success" onClick={() => handleJoinReview(req.id, "APPROVED_JOIN")} disabled={joinReviewActionLoading} className="h-8 px-3 text-xs flex-1" style={{ display: "inline-flex" }}>
                            {joinReviewActionLoading ? <Loader2 className="h-3 w-3 me-1 animate-spin" /> : <CheckCircle2 className="h-3 w-3 me-1" />}{t("موافقة", "Approve")}
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleJoinReview(req.id, "DECLINED_JOIN")} disabled={joinReviewActionLoading} className="h-8 px-3 text-xs flex-1" style={{ display: "inline-flex" }}>
                            {joinReviewActionLoading ? <Loader2 className="h-3 w-3 me-1 animate-spin" /> : <XCircle className="h-3 w-3 me-1" />}{t("رفض", "Decline")}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => setJoinReviewingId(req.id)} className="h-8 text-xs w-full">
                        {t("مراجعة", "Review")}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            />
          </div>
        </div>
      )}

    </div>
    </div>
    </>
  );
}
