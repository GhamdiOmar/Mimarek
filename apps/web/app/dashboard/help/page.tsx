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
  Clock,
  MessageSquare,
  Download,
  Loader2,
  LifeBuoy,
  Plus,
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
  BottomSheet,
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
import { getPendingJoinRequests, reviewJoinRequest } from "../../actions/join-requests";

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

type Tab = "overview" | "faq" | "tickets" | "permissions" | "org-admin";

export default function HelpPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role ?? "USER";
  const isOrgAdmin = hasPermission(userRole, "help:manage_permissions");
  const { lang } = useLanguage();
  const [activeTab, setActiveTab] = React.useState<Tab>("overview");

  // FAQ state
  const [faqSearch, setFaqSearch] = React.useState("");
  const [faqCategory, setFaqCategory] = React.useState<FAQCategory | "all">("all");
  const [openFaq, setOpenFaq] = React.useState<string | null>(null);
  const [openGuide, setOpenGuide] = React.useState<string | null>(null);

  // Ticket state
  const [myTickets, setMyTickets] = React.useState<any[]>([]);
  const [showNewTicket, setShowNewTicket] = React.useState(false);
  const [ticketForm, setTicketForm] = React.useState({ subject: "", description: "", category: "GENERAL_INQUIRY", priority: "MEDIUM" });
  const [ticketLoading, setTicketLoading] = React.useState(false);
  const [ticketErrors, setTicketErrors] = React.useState<Record<string, boolean>>({});

  // Permission request state
  const [myRequests, setMyRequests] = React.useState<any[]>([]);
  const [permForm, setPermForm] = React.useState({ requestedRole: "", reason: "" });
  const [permLoading, setPermLoading] = React.useState(false);

  // Admin state
  const [pendingRequests, setPendingRequests] = React.useState<any[]>([]);
  const [pendingJoinRequests, setPendingJoinRequests] = React.useState<any[]>([]);
  const [reviewNote, setReviewNote] = React.useState("");
  const [reviewingId, setReviewingId] = React.useState<string | null>(null);
  const [reviewActionLoading, setReviewActionLoading] = React.useState(false);
  const [joinReviewingId, setJoinReviewingId] = React.useState<string | null>(null);
  const [joinReviewNote, setJoinReviewNote] = React.useState("");
  const [joinReviewActionLoading, setJoinReviewActionLoading] = React.useState(false);

  // Load data based on tab
  React.useEffect(() => {
    if (activeTab === "tickets") {
      getMySupportTickets().then(setMyTickets).catch(() => {});
    } else if (activeTab === "permissions") {
      getMyPermissionRequests().then(setMyRequests).catch(() => {});
    } else if (activeTab === "org-admin" && isOrgAdmin) {
      getPendingPermissionRequests().then(setPendingRequests).catch(() => {});
      getPendingJoinRequests().then(setPendingJoinRequests).catch(() => {});
    }
  }, [activeTab, isOrgAdmin]);

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
    } catch (e: any) {
      alert(e.message);
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
    } catch (e: any) {
      alert(e.message);
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
    } catch (e: any) {
      alert(e.message);
    } finally {
      setJoinReviewActionLoading(false);
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
    } catch (e: any) {
      alert(e.message);
    } finally {
      setReviewActionLoading(false);
    }
  }

  const tabIcons: Record<string, React.ElementType> = {
    overview: HelpCircle,
    faq: BookOpen,
    tickets: Ticket,
    permissions: ShieldCheck,
    "org-admin": ShieldCheck,
  };

  const tabs: { key: Tab; label: { ar: string; en: string }; adminOnly?: boolean }[] = [
    { key: "overview", label: { ar: "نظرة عامة", en: "Overview" } },
    { key: "faq", label: { ar: "الأسئلة والأدلة", en: "FAQs & Guides" } },
    { key: "tickets", label: { ar: "تذاكري", en: "My Tickets" } },
    { key: "permissions", label: { ar: "طلب صلاحيات", en: "Request Permissions" } },
    ...(isOrgAdmin ? [{ key: "org-admin" as Tab, label: { ar: "إدارة المنظمة", en: "Org Management" }, adminOnly: true }] : []),
  ];

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      OPEN: "bg-gray-100 text-gray-700",
      IN_PROGRESS: "bg-blue-50 text-blue-700",
      WAITING_ON_USER: "bg-amber-50 text-amber-700",
      RESOLVED: "bg-green-50 text-green-700",
      CLOSED: "bg-primary/10 text-primary",
      PENDING: "bg-amber-50 text-amber-700",
      APPROVED: "bg-green-50 text-green-700",
      DECLINED: "bg-red-50 text-red-700",
    };
    const labels: Record<string, { ar: string; en: string }> = {
      OPEN: { ar: "مفتوحة", en: "Open" },
      IN_PROGRESS: { ar: "قيد المعالجة", en: "In Progress" },
      WAITING_ON_USER: { ar: "بانتظار الرد", en: "Waiting" },
      RESOLVED: { ar: "تم الحل", en: "Resolved" },
      CLOSED: { ar: "مغلقة", en: "Closed" },
      PENDING: { ar: "قيد المراجعة", en: "Pending" },
      APPROVED: { ar: "تمت الموافقة", en: "Approved" },
      DECLINED: { ar: "مرفوض", en: "Declined" },
    };
    return (
      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", map[status] ?? "bg-gray-100 text-gray-600")}>
        {(labels[status] ?? { ar: status, en: status })[lang]}
      </span>
    );
  };

  const priorityBadge = (priority: string) => {
    const map: Record<string, string> = {
      LOW: "bg-gray-100 text-gray-600",
      MEDIUM: "bg-blue-50 text-blue-600",
      HIGH: "bg-orange-50 text-orange-600",
      URGENT: "bg-red-50 text-red-600",
    };
    const labels: Record<string, { ar: string; en: string }> = {
      LOW: { ar: "منخفضة", en: "Low" },
      MEDIUM: { ar: "متوسطة", en: "Medium" },
      HIGH: { ar: "عالية", en: "High" },
      URGENT: { ar: "عاجلة", en: "Urgent" },
    };
    return (
      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", map[priority] ?? "bg-gray-100")}>
        {(labels[priority] ?? { ar: priority, en: priority })[lang]}
      </span>
    );
  };

  const handleExportTickets = () => {
    const tickets = myTickets;
    exportToExcel({
      data: tickets,
      columns: [
        { header: lang === "ar" ? "رقم التذكرة" : "Ticket #", key: "ticketNumber", width: 15 },
        { header: lang === "ar" ? "الموضوع" : "Subject", key: "subject", width: 35 },
        { header: lang === "ar" ? "الحالة" : "Status", key: "status", width: 18 },
        { header: lang === "ar" ? "الأولوية" : "Priority", key: "priority", width: 15 },
        { header: lang === "ar" ? "الفئة" : "Category", key: "category", width: 20, render: (val: any) => { const c = CATEGORY_OPTIONS.find((o) => o.value === val); return c ? c.label[lang] : val ?? ""; } },
        { header: lang === "ar" ? "تاريخ الإنشاء" : "Created Date", key: "createdAt", width: 18, render: (val: any) => val ? new Date(val).toLocaleDateString("en-CA") : "" },
      ],
      filename: lang === "ar" ? "سجل_التذاكر" : "tickets_list",
      lang,
      title: lang === "ar" ? "سجل التذاكر — ميماريك" : "Tickets List — Mimaric",
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
    const open = myTickets.filter((t: any) => t.status === "OPEN" || t.status === "IN_PROGRESS").length;
    const resolved = myTickets.filter((t: any) => t.status === "RESOLVED" || t.status === "CLOSED").length;
    return { open, resolved, total: myTickets.length };
  }, [myTickets]);

  return (
    <>
    {/* ─── Mobile (< md) ──────────────────────────────────────────────── */}
    <div
      className="md:hidden -m-4 sm:-m-6 min-h-dvh flex flex-col bg-background"
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <AppBar
        title={lang === "ar" ? "المساعدة" : "Help"}
        subtitle={lang === "ar" ? "الأسئلة والدعم" : "FAQs & Support"}
        lang={lang}
      />

      <div className="flex-1 overflow-y-auto pb-[calc(theme(height.mobile-bottomnav)+env(safe-area-inset-bottom)+6rem)]">
        {/* Agent ticket stats */}
        {isOrgAdmin && (
          <div className="px-4 pt-4 grid grid-cols-2 gap-3">
            <MobileKPICard
              label={lang === "ar" ? "تذاكر مفتوحة" : "Open Tickets"}
              value={<span className="tabular-nums">{mobileTicketStats.open}</span>}
              icon={Ticket}
              tone="amber"
            />
            <MobileKPICard
              label={lang === "ar" ? "تم الحل" : "Resolved"}
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
              placeholder={lang === "ar" ? "ابحث في الأسئلة..." : "Search FAQs..."}
              className="h-10 ps-9"
            />
          </div>
        </div>

        {/* Contact support CTA */}
        <div className="px-4 pt-4">
          <button
            type="button"
            onClick={() => setMobileNewTicketOpen(true)}
            className="w-full min-h-11 bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center gap-3 text-start transition-colors hover:bg-primary/15 active:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]"
          >
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <LifeBuoy className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-foreground">
                {lang === "ar" ? "تواصل مع الدعم الفني" : "Contact Support"}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {lang === "ar"
                  ? "افتح تذكرة جديدة وسيرد عليك فريقنا قريباً"
                  : "Open a new ticket and our team will reply shortly"}
              </div>
            </div>
            <ChevronRight
              className="h-5 w-5 shrink-0 text-primary rtl:scale-x-[-1]"
              aria-hidden="true"
            />
          </button>
        </div>

        {/* FAQ categories */}
        <div className="px-4 pt-5 pb-4">
          <h2 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {lang === "ar" ? "الأسئلة الشائعة" : "FAQs"}
          </h2>
          {mobileFaqsByCategory.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              {lang === "ar" ? "لا توجد نتائج مطابقة." : "No matching FAQs."}
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

        {/* Permission request quick link */}
        <div className="px-4 pb-6">
          <div className="rounded-2xl border border-border bg-card">
            <div className="px-4">
              <DataCard
                title={lang === "ar" ? "طلب ترقية صلاحيات" : "Request Permission Upgrade"}
                subtitle={
                  lang === "ar"
                    ? `دورك الحالي: ${userRole}`
                    : `Current role: ${userRole}`
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
        label={lang === "ar" ? "تذكرة جديدة" : "New ticket"}
        onClick={() => setMobileNewTicketOpen(true)}
      />

      {/* New ticket bottom sheet */}
      <BottomSheet
        open={mobileNewTicketOpen}
        onOpenChange={setMobileNewTicketOpen}
        title={lang === "ar" ? "تذكرة جديدة" : "New Ticket"}
        description={lang === "ar" ? "صف المشكلة وسيتواصل فريق الدعم معك." : "Describe the issue and our support team will reply."}
        footer={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="flex-1 min-h-11"
              style={{ display: "inline-flex" }}
              onClick={() => setMobileNewTicketOpen(false)}
              disabled={ticketLoading}
            >
              {lang === "ar" ? "إلغاء" : "Cancel"}
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
                ? lang === "ar" ? "جاري الإرسال..." : "Submitting..."
                : lang === "ar" ? "إرسال" : "Submit"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {lang === "ar" ? "الموضوع" : "Subject"}
              <span className="text-destructive ms-1">*</span>
            </label>
            <UIInput
              value={ticketForm.subject}
              onChange={(e) => {
                setTicketForm({ ...ticketForm, subject: e.target.value });
                if (ticketErrors.subject) setTicketErrors((prev) => ({ ...prev, subject: false }));
              }}
              placeholder={lang === "ar" ? "مثال: مشكلة في تسجيل الدخول" : "e.g. Login issue"}
              className={ticketErrors.subject ? "border-destructive" : undefined}
            />
            {ticketErrors.subject && (
              <p className="mt-1 text-xs text-destructive">
                {lang === "ar" ? "هذا الحقل مطلوب" : "This field is required"}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {lang === "ar" ? "الفئة" : "Category"}
              </label>
              <select
                value={ticketForm.category}
                onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value })}
                className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label[lang]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {lang === "ar" ? "الأولوية" : "Priority"}
              </label>
              <select
                value={ticketForm.priority}
                onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value })}
                className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label[lang]}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {lang === "ar" ? "الوصف" : "Description"}
              <span className="text-destructive ms-1">*</span>
            </label>
            <Textarea
              value={ticketForm.description}
              onChange={(e) => {
                setTicketForm({ ...ticketForm, description: e.target.value });
                if (ticketErrors.description) setTicketErrors((prev) => ({ ...prev, description: false }));
              }}
              placeholder={lang === "ar" ? "وصف المشكلة أو الطلب..." : "Describe the issue or request..."}
              rows={4}
              className={ticketErrors.description ? "border-destructive" : undefined}
            />
            {ticketErrors.description && (
              <p className="mt-1 text-xs text-destructive">
                {lang === "ar" ? "هذا الحقل مطلوب" : "This field is required"}
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
        title={lang === "ar" ? "مركز المساعدة" : "Help Center"}
        description={lang === "ar" ? "الأسئلة الشائعة، الدعم الفني، وطلب الصلاحيات" : "FAQs, technical support, and permission requests"}
      />

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const Icon = tabIcons[tab.key] ?? HelpCircle;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all",
                activeTab === tab.key
                  ? "bg-primary text-white shadow-md"
                  : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label[lang]}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button onClick={() => { setActiveTab("tickets"); setShowNewTicket(true); }} className="bg-card p-6 rounded-md shadow-card border border-border hover:shadow-lg hover:-translate-y-0.5 transition-all text-start">
              <Ticket className="h-8 w-8 text-secondary mb-3" />
              <h3 className="font-bold text-foreground">{lang === "ar" ? "تقديم تذكرة" : "Submit Ticket"}</h3>
              <p className="text-xs text-muted-foreground mt-1">{lang === "ar" ? "أبلغ عن مشكلة أو اطلب ميزة جديدة" : "Report an issue or request a feature"}</p>
            </button>
            <button onClick={() => setActiveTab("permissions")} className="bg-card p-6 rounded-md shadow-card border border-border hover:shadow-lg hover:-translate-y-0.5 transition-all text-start">
              <ShieldCheck className="h-8 w-8 text-amber-500 mb-3" />
              <h3 className="font-bold text-foreground">{lang === "ar" ? "طلب صلاحيات" : "Request Permissions"}</h3>
              <p className="text-xs text-muted-foreground mt-1">{lang === "ar" ? "اطلب ترقية صلاحياتك في النظام" : "Request a role upgrade in the system"}</p>
            </button>
            <button onClick={() => setActiveTab("faq")} className="bg-card p-6 rounded-md shadow-card border border-border hover:shadow-lg hover:-translate-y-0.5 transition-all text-start">
              <BookOpen className="h-8 w-8 text-info mb-3" />
              <h3 className="font-bold text-foreground">{lang === "ar" ? "الأسئلة الشائعة" : "FAQs & Guides"}</h3>
              <p className="text-xs text-muted-foreground mt-1">{lang === "ar" ? "ابحث في الأسئلة الشائعة وأدلة الاستخدام" : "Browse FAQs and usage guides"}</p>
            </button>
          </div>

        </div>
      )}

      {activeTab === "faq" && (
        <div className="space-y-6">
          {/* Search */}
          <div className="relative">
            <Search className="h-[18px] w-[18px] absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={faqSearch}
              onChange={(e) => setFaqSearch(e.target.value)}
              placeholder={lang === "ar" ? "ابحث في الأسئلة الشائعة..." : "Search FAQs..."}
              className="w-full bg-card border border-border rounded-md py-2.5 pe-10 ps-4 text-sm focus:border-primary/30 focus:ring-0 outline-none"
            />
          </div>

          {/* Category Pills */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setFaqCategory("all")}
              className={cn("px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all", faqCategory === "all" ? "bg-primary text-white" : "bg-muted/50 text-muted-foreground hover:bg-muted")}
            >
              {lang === "ar" ? "الكل" : "All"}
            </button>
            {FAQ_CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setFaqCategory(cat.key)}
                className={cn("px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all", faqCategory === cat.key ? "bg-primary text-white" : "bg-muted/50 text-muted-foreground hover:bg-muted")}
              >
                {cat.label[lang]}
              </button>
            ))}
          </div>

          {/* FAQ Accordion */}
          <div className="bg-card rounded-md border border-border divide-y divide-border">
            {filteredFaqs.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">{lang === "ar" ? "لا توجد نتائج" : "No results found"}</div>
            ) : (
              filteredFaqs.map((item) => (
                <div key={item.id}>
                  <button
                    onClick={() => setOpenFaq(openFaq === item.id ? null : item.id)}
                    className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/10 transition-colors text-start"
                  >
                    <span>{item.question[lang]}</span>
                    {openFaq === item.id ? <ChevronUp className="h-4 w-4 min-w-[16px]" /> : <ChevronDown className="h-4 w-4 min-w-[16px]" />}
                  </button>
                  {openFaq === item.id && (
                    <div className="px-4 pb-3 text-sm text-muted-foreground leading-relaxed bg-muted/5">
                      {item.answer[lang]}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Guides */}
          <div>
            <h2 className="text-lg font-bold text-foreground mb-4">{lang === "ar" ? "أدلة الاستخدام" : "Usage Guides"}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {GUIDE_ITEMS.map((guide, idx) => (
                <div key={guide.id} className="bg-card rounded-md border border-border overflow-hidden flex flex-col">
                  <button
                    onClick={() => setOpenGuide(openGuide === guide.id ? null : guide.id)}
                    className="w-full text-start p-4 flex items-start gap-3 hover:bg-muted/20 transition-colors"
                  >
                    <span className="min-w-[32px] h-8 rounded-md bg-secondary/10 text-secondary flex items-center justify-center text-sm font-bold mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
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
                  </button>
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
            <h2 className="text-lg font-bold text-foreground">{lang === "ar" ? "تذاكري" : "My Tickets"}</h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" style={{ display: "inline-flex" }} onClick={handleExportTickets}>
                <Download className="h-4 w-4" />
                {lang === "ar" ? "تصدير التذاكر" : "Export Tickets"}
              </Button>
              <Button size="sm" onClick={() => setShowNewTicket(!showNewTicket)}>
                {lang === "ar" ? "تذكرة جديدة" : "New Ticket"}
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
                  placeholder={lang === "ar" ? "الموضوع" : "Subject"}
                  className={`w-full border rounded-md px-3 py-2 text-sm focus:border-primary/30 outline-none ${ticketErrors.subject ? "border-red-500" : "border-border"}`}
                />
                {ticketErrors.subject && (
                  <p className="text-xs text-red-500 mt-1">{lang === "ar" ? "هذا الحقل مطلوب" : "This field is required"}</p>
                )}
              </div>
              <div className="flex gap-3">
                <select value={ticketForm.category} onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label[lang]}</option>)}
                </select>
                <select value={ticketForm.priority} onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label[lang]}</option>)}
                </select>
              </div>
              <div>
                <textarea
                  value={ticketForm.description}
                  onChange={(e) => { setTicketForm({ ...ticketForm, description: e.target.value }); if (ticketErrors.description) setTicketErrors((prev) => ({ ...prev, description: false })); }}
                  placeholder={lang === "ar" ? "وصف المشكلة أو الطلب..." : "Describe the issue or request..."}
                  rows={4}
                  className={`w-full border rounded-md px-3 py-2 text-sm focus:border-primary/30 outline-none resize-none ${ticketErrors.description ? "border-red-500" : "border-border"}`}
                />
                {ticketErrors.description && (
                  <p className="text-xs text-red-500 mt-1">{lang === "ar" ? "هذا الحقل مطلوب" : "This field is required"}</p>
                )}
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setShowNewTicket(false)} disabled={ticketLoading} style={{ display: "inline-flex" }}>{lang === "ar" ? "إلغاء" : "Cancel"}</Button>
                <Button variant="success" size="sm" onClick={handleSubmitTicket} disabled={ticketLoading} style={{ display: "inline-flex" }} className="gap-1">
                  {ticketLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  {ticketLoading ? (lang === "ar" ? "جاري الإرسال..." : "Submitting...") : (lang === "ar" ? "إرسال" : "Submit")}
                </Button>
              </div>
            </div>
          )}

          {/*
            Tickets Table — kept as raw <table> rather than DataTable primitive.
            Per-user ticket history is a short-lived list (typically < 20 rows);
            sort/filter/pagination add cost without UX benefit. Revisit if a user
            accumulates hundreds of tickets. Same rationale applies to the three
            review-queue tables below (permissions history, pending permission
            requests, pending join requests) — the latter two also embed an
            inline review form in the Action column, which would require
            lifting state into DataTable cell renderers for no visible gain.
          */}
          <div className="bg-card rounded-md border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-muted-foreground text-[10px] uppercase">
                <tr>
                  <th className="px-3 py-2 text-start">#</th>
                  <th className="px-3 py-2 text-start">{lang === "ar" ? "الموضوع" : "Subject"}</th>
                  <th className="px-3 py-2 text-start">{lang === "ar" ? "الفئة" : "Category"}</th>
                  <th className="px-3 py-2 text-center">{lang === "ar" ? "الأولوية" : "Priority"}</th>
                  <th className="px-3 py-2 text-center">{lang === "ar" ? "الحالة" : "Status"}</th>
                  <th className="px-3 py-2 text-center"><MessageSquare className="h-3.5 w-3.5" /></th>
                  <th className="px-3 py-2 text-start">{lang === "ar" ? "التاريخ" : "Date"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {myTickets.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">{lang === "ar" ? "لا توجد تذاكر" : "No tickets yet"}</td></tr>
                ) : (
                  myTickets.map((ticket: any) => (
                    <tr key={ticket.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-3 py-2 font-mono text-xs">{ticket.ticketNumber}</td>
                      <td className="px-3 py-2">
                        <Link href={`/dashboard/help/tickets/${ticket.id}`} className="text-primary hover:underline font-medium">{ticket.subject}</Link>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{categoryLabel(ticket.category)}</td>
                      <td className="px-3 py-2 text-center">{priorityBadge(ticket.priority)}</td>
                      <td className="px-3 py-2 text-center">{statusBadge(ticket.status)}</td>
                      <td className="px-3 py-2 text-center text-xs text-muted-foreground">{ticket._count?.messages ?? 0}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(ticket.createdAt).toLocaleDateString("en-CA")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "permissions" && (
        <div className="space-y-6">
          {/* Request Form */}
          <div className="bg-card p-4 rounded-md border border-border space-y-3">
            <h2 className="font-bold text-foreground">{lang === "ar" ? "طلب ترقية الصلاحيات" : "Request Permission Upgrade"}</h2>
            <p className="text-xs text-muted-foreground">{lang === "ar" ? "دورك الحالي: " : "Your current role: "}<span className="font-bold">{userRole}</span></p>
            <select value={permForm.requestedRole} onChange={(e) => setPermForm({ ...permForm, requestedRole: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <option value="">{lang === "ar" ? "اختر الدور المطلوب" : "Select requested role"}</option>
              {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label[lang]} ({o.value})</option>)}
            </select>
            <textarea
              value={permForm.reason}
              onChange={(e) => setPermForm({ ...permForm, reason: e.target.value })}
              placeholder={lang === "ar" ? "سبب الطلب..." : "Reason for request..."}
              rows={3}
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:border-primary/30 outline-none resize-none"
            />
            <Button variant="success" size="sm" onClick={handleSubmitPermRequest} disabled={permLoading || !permForm.requestedRole || !permForm.reason.trim()}>
              <Send className="h-3.5 w-3.5 me-1" />
              {permLoading ? "..." : (lang === "ar" ? "إرسال الطلب" : "Submit Request")}
            </Button>
          </div>

          {/* Request History */}
          <div>
            <h3 className="font-bold text-foreground mb-2">{lang === "ar" ? "سجل الطلبات" : "Request History"}</h3>
            <div className="bg-card rounded-md border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-muted-foreground text-[10px] uppercase">
                  <tr>
                    <th className="px-3 py-2 text-start">{lang === "ar" ? "الدور المطلوب" : "Requested Role"}</th>
                    <th className="px-3 py-2 text-start">{lang === "ar" ? "السبب" : "Reason"}</th>
                    <th className="px-3 py-2 text-center">{lang === "ar" ? "الحالة" : "Status"}</th>
                    <th className="px-3 py-2 text-start">{lang === "ar" ? "ملاحظة المراجع" : "Review Note"}</th>
                    <th className="px-3 py-2 text-start">{lang === "ar" ? "التاريخ" : "Date"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {myRequests.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">{lang === "ar" ? "لا توجد طلبات" : "No requests yet"}</td></tr>
                  ) : (
                    myRequests.map((req: any) => (
                      <tr key={req.id}>
                        <td className="px-3 py-2 font-medium">{req.requestedRole}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground max-w-[200px] truncate">{req.reason}</td>
                        <td className="px-3 py-2 text-center">{statusBadge(req.status)}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{req.reviewNote ?? "—"}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(req.createdAt).toLocaleDateString("en-CA")}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Org Management Tab — visible to COMPANY_ADMIN (via help:manage_permissions) */}
      {activeTab === "org-admin" && isOrgAdmin && (
        <div className="space-y-6">
          {/* Pending Permission Requests */}
          <div>
            <h2 className="text-lg font-bold text-foreground mb-3">{lang === "ar" ? "طلبات الصلاحيات المعلقة" : "Pending Permission Requests"}</h2>
            <div className="bg-card rounded-md border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-muted-foreground text-[10px] uppercase">
                  <tr>
                    <th className="px-3 py-2 text-start">{lang === "ar" ? "المستخدم" : "User"}</th>
                    <th className="px-3 py-2 text-start">{lang === "ar" ? "الدور الحالي" : "Current Role"}</th>
                    <th className="px-3 py-2 text-start">{lang === "ar" ? "الدور المطلوب" : "Requested Role"}</th>
                    <th className="px-3 py-2 text-start">{lang === "ar" ? "السبب" : "Reason"}</th>
                    <th className="px-3 py-2 text-start">{lang === "ar" ? "التاريخ" : "Date"}</th>
                    <th className="px-3 py-2 text-center">{lang === "ar" ? "إجراء" : "Action"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pendingRequests.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">{lang === "ar" ? "لا توجد طلبات معلقة" : "No pending requests"}</td></tr>
                  ) : (
                    pendingRequests.map((req: any) => (
                      <tr key={req.id}>
                        <td className="px-3 py-2">
                          <div className="font-medium">{req.user?.name}</div>
                          <div className="text-[10px] text-muted-foreground">{req.user?.email}</div>
                        </td>
                        <td className="px-3 py-2 text-xs">{req.user?.role}</td>
                        <td className="px-3 py-2 text-xs font-bold text-secondary">{req.requestedRole}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground max-w-[200px]">{req.reason}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(req.createdAt).toLocaleDateString("en-CA")}</td>
                        <td className="px-3 py-2">
                          {reviewingId === req.id ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={reviewNote}
                                onChange={(e) => setReviewNote(e.target.value)}
                                placeholder={lang === "ar" ? "ملاحظة (اختياري)" : "Note (optional)"}
                                className="w-full border border-border rounded px-2 py-1 text-xs outline-none"
                              />
                              <div className="flex gap-1">
                                <Button size="sm" variant="success" onClick={() => handleReview(req.id, "APPROVED")} disabled={reviewActionLoading} className="h-6 px-2 text-[10px]" style={{ display: "inline-flex" }}>
                                  {reviewActionLoading ? <Loader2 className="h-3 w-3 me-1 animate-spin" /> : <CheckCircle2 className="h-3 w-3 me-1" />}{lang === "ar" ? "موافقة" : "Approve"}
                                </Button>
                                <Button size="sm" variant="danger" onClick={() => handleReview(req.id, "DECLINED")} disabled={reviewActionLoading} className="h-6 px-2 text-[10px]" style={{ display: "inline-flex" }}>
                                  {reviewActionLoading ? <Loader2 className="h-3 w-3 me-1 animate-spin" /> : <XCircle className="h-3 w-3 me-1" />}{lang === "ar" ? "رفض" : "Decline"}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button size="sm" variant="secondary" onClick={() => setReviewingId(req.id)} className="h-7 text-xs">
                              {lang === "ar" ? "مراجعة" : "Review"}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pending Join Requests */}
          <div>
            <h2 className="text-lg font-bold text-foreground mb-3">{lang === "ar" ? "طلبات الانضمام المعلقة" : "Pending Join Requests"}</h2>
            <div className="bg-card rounded-md border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-muted-foreground text-[10px] uppercase">
                  <tr>
                    <th className="px-3 py-2 text-start">{lang === "ar" ? "المستخدم" : "User"}</th>
                    <th className="px-3 py-2 text-start">{lang === "ar" ? "رقم السجل" : "CR Number"}</th>
                    <th className="px-3 py-2 text-start">{lang === "ar" ? "السبب" : "Reason"}</th>
                    <th className="px-3 py-2 text-start">{lang === "ar" ? "التاريخ" : "Date"}</th>
                    <th className="px-3 py-2 text-center">{lang === "ar" ? "إجراء" : "Action"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pendingJoinRequests.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">{lang === "ar" ? "لا توجد طلبات انضمام" : "No pending join requests"}</td></tr>
                  ) : (
                    pendingJoinRequests.map((req: any) => (
                      <tr key={req.id}>
                        <td className="px-3 py-2">
                          <div className="font-medium">{req.user?.name}</div>
                          <div className="text-[10px] text-muted-foreground">{req.user?.email}</div>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{req.crNumber}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground max-w-[200px]">{req.reason ?? "—"}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(req.createdAt).toLocaleDateString("en-CA")}</td>
                        <td className="px-3 py-2">
                          {joinReviewingId === req.id ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={joinReviewNote}
                                onChange={(e) => setJoinReviewNote(e.target.value)}
                                placeholder={lang === "ar" ? "ملاحظة (اختياري)" : "Note (optional)"}
                                className="w-full border border-border rounded px-2 py-1 text-xs outline-none"
                              />
                              <div className="flex gap-1">
                                <Button size="sm" variant="success" onClick={() => handleJoinReview(req.id, "APPROVED_JOIN")} disabled={joinReviewActionLoading} className="h-6 px-2 text-[10px]" style={{ display: "inline-flex" }}>
                                  {joinReviewActionLoading ? <Loader2 className="h-3 w-3 me-1 animate-spin" /> : <CheckCircle2 className="h-3 w-3 me-1" />}{lang === "ar" ? "موافقة" : "Approve"}
                                </Button>
                                <Button size="sm" variant="danger" onClick={() => handleJoinReview(req.id, "DECLINED_JOIN")} disabled={joinReviewActionLoading} className="h-6 px-2 text-[10px]" style={{ display: "inline-flex" }}>
                                  {joinReviewActionLoading ? <Loader2 className="h-3 w-3 me-1 animate-spin" /> : <XCircle className="h-3 w-3 me-1" />}{lang === "ar" ? "رفض" : "Decline"}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button size="sm" variant="secondary" onClick={() => setJoinReviewingId(req.id)} className="h-7 text-xs">
                              {lang === "ar" ? "مراجعة" : "Review"}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
    </div>
    </>
  );
}
