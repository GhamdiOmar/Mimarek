"use client";

import { useLanguage } from "../../../../../components/LanguageProvider";
import * as React from "react";
import {
  ArrowRight,
  Send,
  Clock,
  User,
  ShieldCheck,
  ChevronLeft,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { Button, AppBar, BottomSheet, Textarea, DirectionalIcon } from "@repo/ui";
import { cn } from "@repo/ui/lib/utils";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "../../../../../components/SimpleSessionProvider";
import { hasPermission } from "../../../../../lib/permissions";
import {
  getTicketWithMessages,
  addTicketMessage,
  updateTicketStatus,
} from "../../../../actions/support-tickets";

const STATUS_OPTIONS = [
  { value: "OPEN", label: { ar: "مفتوحة", en: "Open" } },
  { value: "IN_PROGRESS", label: { ar: "قيد المعالجة", en: "In Progress" } },
  { value: "WAITING_ON_USER", label: { ar: "بانتظار الرد", en: "Waiting on User" } },
  { value: "RESOLVED", label: { ar: "تم الحل", en: "Resolved" } },
  { value: "CLOSED", label: { ar: "مغلقة", en: "Closed" } },
];

const CATEGORY_LABELS: Record<string, { ar: string; en: string }> = {
  BUG_REPORT: { ar: "بلاغ خطأ", en: "Bug Report" },
  FEATURE_REQUEST: { ar: "طلب ميزة", en: "Feature Request" },
  ACCOUNT_ISSUE: { ar: "مشكلة حساب", en: "Account Issue" },
  BILLING: { ar: "فوترة", en: "Billing" },
  TECHNICAL_SUPPORT: { ar: "دعم فني", en: "Technical Support" },
  GENERAL_INQUIRY: { ar: "استفسار عام", en: "General Inquiry" },
};

const PRIORITY_LABELS: Record<string, { ar: string; en: string }> = {
  LOW: { ar: "منخفضة", en: "Low" },
  MEDIUM: { ar: "متوسطة", en: "Medium" },
  HIGH: { ar: "عالية", en: "High" },
  URGENT: { ar: "عاجلة", en: "Urgent" },
};

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params.id as string;
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role ?? "USER";
  const userId = (session?.user as any)?.id;
  const isAdmin = hasPermission(userRole, "help:manage_tickets");
  const { lang } = useLanguage();

  const [ticket, setTicket] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [replyText, setReplyText] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [updatingStatus, setUpdatingStatus] = React.useState(false);
  const [mobileActionsOpen, setMobileActionsOpen] = React.useState(false);

  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  async function loadTicket() {
    try {
      const t = await getTicketWithMessages(ticketId);
      setTicket(t);
      setError("");
    } catch (e: any) {
      setError(e.message || "Failed to load ticket");
    }
    setLoading(false);
  }

  React.useEffect(() => {
    loadTicket();
  }, [ticketId]);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.messages?.length]);

  async function handleSendMessage() {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      await addTicketMessage(ticketId, replyText.trim());
      setReplyText("");
      await loadTicket();
    } catch (e: any) {
      alert(e.message);
    }
    setSending(false);
  }

  async function handleStatusChange(status: string) {
    setUpdatingStatus(true);
    try {
      await updateTicketStatus(ticketId, status);
      await loadTicket();
    } catch (e: any) {
      alert(e.message);
    }
    setUpdatingStatus(false);
  }

  function statusBadge(status: string) {
    const map: Record<string, string> = {
      OPEN: "bg-gray-100 text-gray-700",
      IN_PROGRESS: "bg-blue-50 text-blue-700",
      WAITING_ON_USER: "bg-amber-50 text-amber-700",
      RESOLVED: "bg-green-50 text-green-700",
      CLOSED: "bg-primary/10 text-primary",
    };
    const labels: Record<string, { ar: string; en: string }> = {
      OPEN: { ar: "مفتوحة", en: "Open" },
      IN_PROGRESS: { ar: "قيد المعالجة", en: "In Progress" },
      WAITING_ON_USER: { ar: "بانتظار الرد", en: "Waiting" },
      RESOLVED: { ar: "تم الحل", en: "Resolved" },
      CLOSED: { ar: "مغلقة", en: "Closed" },
    };
    const label = labels[status] ?? { ar: status, en: status };
    return (
      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", map[status] ?? "bg-gray-100 text-gray-700")}>
        {lang === "ar" ? label.ar : label.en}
      </span>
    );
  }

  function priorityBadge(priority: string) {
    const map: Record<string, string> = {
      LOW: "bg-gray-100 text-gray-600",
      MEDIUM: "bg-blue-50 text-blue-700",
      HIGH: "bg-orange-50 text-orange-700",
      URGENT: "bg-red-50 text-red-700",
    };
    const label = PRIORITY_LABELS[priority] ?? { ar: priority, en: priority };
    return (
      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", map[priority] ?? "bg-gray-100 text-gray-600")}>
        {lang === "ar" ? label.ar : label.en}
      </span>
    );
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="p-6" dir={lang === "ar" ? "rtl" : "ltr"}>
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl text-center text-sm">
          {error || (lang === "ar" ? "التذكرة غير موجودة" : "Ticket not found")}
        </div>
        <div className="mt-4 text-center">
          <Link href="/dashboard/help" className="text-primary hover:underline text-sm">
            {lang === "ar" ? "← العودة لمركز المساعدة" : "← Back to Help Center"}
          </Link>
        </div>
      </div>
    );
  }

  const isClosed = ticket.status === "CLOSED" || ticket.status === "RESOLVED";
  const ticketRef = ticket.ticketNumber ?? ticket.ref ?? (ticketId ? ticketId.slice(0, 8) : "");

  async function handleSendMobileMessage(e?: React.FormEvent) {
    if (e) e.preventDefault();
    await handleSendMessage();
  }

  return (
    <>
    {/* ─── Mobile (< md) ──────────────────────────────────────────────── */}
    <div
      className="md:hidden -m-4 sm:-m-6 min-h-dvh flex flex-col bg-background"
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <AppBar
        centered
        title={
          <span className="font-mono text-sm font-semibold text-foreground tabular-nums">
            {ticketRef}
          </span>
        }
        subtitle={ticket.subject}
        onBack={() => router.push("/dashboard/help")}
        lang={lang}
        trailing={
          isAdmin ? (
            <button
              type="button"
              onClick={() => setMobileActionsOpen(true)}
              aria-label={lang === "ar" ? "المزيد" : "More"}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-foreground hover:bg-muted/60 active:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]"
            >
              <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
            </button>
          ) : undefined
        }
      />

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-[calc(140px+theme(height.mobile-bottomnav)+env(safe-area-inset-bottom))]">
        {/* Metadata card */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {statusBadge(ticket.status)}
            {priorityBadge(ticket.priority)}
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {lang === "ar"
                ? CATEGORY_LABELS[ticket.category]?.ar ?? ticket.category
                : CATEGORY_LABELS[ticket.category]?.en ?? ticket.category}
            </span>
          </div>
          <h1 className="text-base font-bold leading-snug text-foreground">
            {ticket.subject}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" aria-hidden="true" />
              {ticket.user?.name ?? ticket.user?.email}
            </span>
            <span className="flex items-center gap-1 tabular-nums">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {formatDate(ticket.createdAt)}
            </span>
            {ticket.assignee && (
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                {ticket.assignee.name ?? ticket.assignee.email}
              </span>
            )}
          </div>
          <div className="rounded-xl bg-muted/40 p-3 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {ticket.description}
          </div>
        </div>

        {/* Messages */}
        <div className="space-y-3">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {lang === "ar" ? "المحادثة" : "Conversation"}
            {ticket.messages?.length > 0 && (
              <span className="ms-2 tabular-nums">({ticket.messages.length})</span>
            )}
          </h2>

          {(!ticket.messages || ticket.messages.length === 0) && (
            <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              {lang === "ar"
                ? "لا توجد رسائل بعد. كن أول من يرد."
                : "No messages yet. Be the first to reply."}
            </div>
          )}

          {ticket.messages?.map((msg: any) => {
            const isOwn = msg.userId === userId;
            const isStaff = msg.isStaffReply;
            return (
              <div
                key={msg.id}
                className={cn(
                  "flex flex-col max-w-[85%]",
                  isOwn ? "ms-auto items-end" : "items-start"
                )}
              >
                <div
                  className={cn(
                    "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    isStaff
                      ? "bg-info/10 border border-info/20 text-foreground"
                      : isOwn
                        ? "bg-primary/10 border border-primary/20 text-foreground"
                        : "bg-card border border-border text-foreground"
                  )}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {msg.user?.name ?? msg.user?.email}
                    </span>
                    {isStaff && (
                      <span className="inline-flex items-center rounded-full bg-info/15 text-info px-1.5 py-0.5 text-[10px] font-semibold">
                        {lang === "ar" ? "فريق الدعم" : "Staff"}
                      </span>
                    )}
                  </div>
                  <div className="whitespace-pre-wrap">{msg.message}</div>
                  <div className="mt-1.5 text-[10px] text-muted-foreground tabular-nums">
                    {formatDate(msg.createdAt)}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Sticky composer */}
      {!isClosed ? (
        <form
          onSubmit={handleSendMobileMessage}
          className="fixed inset-x-0 bottom-[calc(theme(height.mobile-bottomnav)+env(safe-area-inset-bottom))] z-30 bg-card/95 backdrop-blur-md border-t border-border p-3"
        >
          <div className="flex items-end gap-2">
            <Textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={lang === "ar" ? "اكتب ردك هنا..." : "Type your reply..."}
              rows={1}
              className="flex-1 min-h-11 max-h-28 resize-none text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              disabled={sending}
            />
            <Button
              type="submit"
              aria-label={lang === "ar" ? "إرسال" : "Send"}
              disabled={!replyText.trim() || sending}
              className="h-11 w-11 p-0 shrink-0"
              style={{ display: "inline-flex" }}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4 rtl:scale-x-[-1]" aria-hidden="true" />
              )}
            </Button>
          </div>
        </form>
      ) : (
        <div className="fixed inset-x-0 bottom-[calc(theme(height.mobile-bottomnav)+env(safe-area-inset-bottom))] z-30 bg-card/95 backdrop-blur-md border-t border-border p-4 text-center text-sm text-muted-foreground">
          {lang === "ar"
            ? "هذه التذكرة مغلقة. لا يمكن إضافة ردود جديدة."
            : "This ticket is closed. No new replies can be added."}
        </div>
      )}

      {/* Admin actions sheet */}
      {isAdmin && (
        <BottomSheet
          open={mobileActionsOpen}
          onOpenChange={setMobileActionsOpen}
          title={lang === "ar" ? "إجراءات التذكرة" : "Ticket Actions"}
        >
          <div className="space-y-2 pb-2">
            {STATUS_OPTIONS.map((opt) => {
              const isActive = ticket.status === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={async () => {
                    if (isActive) {
                      setMobileActionsOpen(false);
                      return;
                    }
                    await handleStatusChange(opt.value);
                    setMobileActionsOpen(false);
                  }}
                  disabled={updatingStatus}
                  className={cn(
                    "w-full min-h-11 flex items-center justify-between rounded-xl border px-4 py-3 text-start text-sm transition-colors",
                    isActive
                      ? "bg-primary/10 border-primary/20 text-primary font-semibold"
                      : "bg-card border-border text-foreground hover:bg-muted/30"
                  )}
                >
                  <span>{lang === "ar" ? opt.label.ar : opt.label.en}</span>
                  {isActive && <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                </button>
              );
            })}
            {updatingStatus && (
              <div className="text-center text-xs text-muted-foreground pt-2">
                {lang === "ar" ? "جارٍ التحديث..." : "Updating..."}
              </div>
            )}
          </div>
        </BottomSheet>
      )}
    </div>

    {/* ─── Desktop (≥ md) ─ unchanged ───────────────────────────────── */}
    <div className="hidden md:block">
    <div className="p-4 md:p-6 space-y-4" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/help"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary transition-colors"
        >
          <DirectionalIcon icon={ChevronLeft} className="h-3.5 w-3.5" />
          {lang === "ar" ? "مركز المساعدة" : "Help Center"}
        </Link>
      </div>

      {/* Ticket Header */}
      <div className="bg-card rounded-xl border border-gray-100 p-5">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-gray-400">{ticket.ticketNumber}</span>
                {statusBadge(ticket.status)}
                {priorityBadge(ticket.priority)}
              </div>
              <h1 className="text-lg font-bold text-gray-900 leading-snug">{ticket.subject}</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {ticket.user?.name ?? ticket.user?.email}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDate(ticket.createdAt)}
            </span>
            <span className={cn(
              "px-2 py-0.5 rounded-full text-xs",
              "bg-gray-50 text-gray-600"
            )}>
              {lang === "ar"
                ? (CATEGORY_LABELS[ticket.category]?.ar ?? ticket.category)
                : (CATEGORY_LABELS[ticket.category]?.en ?? ticket.category)}
            </span>
            {ticket.assignee && (
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" />
                {lang === "ar" ? "المسؤول:" : "Assigned:"} {ticket.assignee.name ?? ticket.assignee.email}
              </span>
            )}
          </div>

          {/* Description */}
          <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {ticket.description}
          </div>
        </div>
      </div>

      {/* Admin Controls */}
      {isAdmin && (
        <div className="bg-card rounded-xl border border-gray-100 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-gray-500">
              {lang === "ar" ? "إجراءات المسؤول:" : "Admin Actions:"}
            </span>
            <select
              className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-card focus:ring-1 focus:ring-primary/20 focus:border-primary"
              value={ticket.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={updatingStatus}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {lang === "ar" ? opt.label.ar : opt.label.en}
                </option>
              ))}
            </select>
            {updatingStatus && (
              <span className="text-xs text-gray-400">
                {lang === "ar" ? "جارٍ التحديث..." : "Updating..."}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Messages Thread */}
      <div className="bg-card rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">
            {lang === "ar" ? "المحادثة" : "Conversation"}
            {ticket.messages?.length > 0 && (
              <span className="text-xs font-normal text-gray-400 ms-2">
                ({ticket.messages.length})
              </span>
            )}
          </h2>
        </div>

        <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
          {(!ticket.messages || ticket.messages.length === 0) && (
            <div className="text-center text-gray-400 text-sm py-8">
              {lang === "ar"
                ? "لا توجد رسائل بعد. كن أول من يرد."
                : "No messages yet. Be the first to reply."}
            </div>
          )}

          {ticket.messages?.map((msg: any) => {
            const isOwn = msg.userId === userId;
            const isStaff = msg.isStaffReply;

            return (
              <div
                key={msg.id}
                className={cn(
                  "flex flex-col max-w-[85%]",
                  isOwn ? (lang === "ar" ? "ms-auto" : "ms-auto") : ""
                )}
              >
                <div
                  className={cn(
                    "rounded-xl px-4 py-3 text-sm leading-relaxed",
                    isStaff
                      ? "bg-blue-50 border border-blue-100 text-gray-800"
                      : isOwn
                        ? "bg-primary/5 border border-primary/10 text-gray-800"
                        : "bg-gray-50 border border-gray-100 text-gray-800"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-gray-600">
                      {msg.user?.name ?? msg.user?.email}
                    </span>
                    {isStaff && (
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
                        {lang === "ar" ? "فريق الدعم" : "Staff"}
                      </span>
                    )}
                  </div>
                  <div className="whitespace-pre-wrap">{msg.message}</div>
                  <div className="text-[10px] text-gray-400 mt-1.5">
                    {formatDate(msg.createdAt)}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply Input */}
        {!isClosed ? (
          <div className="p-4 border-t border-gray-100">
            <div className="flex gap-2">
              <textarea
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary/20 focus:border-primary resize-none"
                rows={2}
                placeholder={lang === "ar" ? "اكتب ردك هنا..." : "Type your reply..."}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    handleSendMessage();
                  }
                }}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!replyText.trim() || sending}
                className="self-end"
               
              >
                <Send className={`h-4 w-4 ${lang === "ar" ? "rotate-180" : ""}`} />
                <span className="ms-1.5 text-sm">
                  {sending
                    ? (lang === "ar" ? "إرسال..." : "Sending...")
                    : (lang === "ar" ? "إرسال" : "Send")}
                </span>
              </Button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">
              {lang === "ar" ? "Ctrl+Enter للإرسال السريع" : "Ctrl+Enter to send"}
            </p>
          </div>
        ) : (
          <div className="p-4 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-400">
              {lang === "ar"
                ? "هذه التذكرة مغلقة. لا يمكن إضافة ردود جديدة."
                : "This ticket is closed. No new replies can be added."}
            </p>
          </div>
        )}
      </div>
    </div>
    </div>
    </>
  );
}
