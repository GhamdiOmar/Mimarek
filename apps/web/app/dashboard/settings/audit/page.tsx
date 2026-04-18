"use client";

import { useLanguage } from "../../../../components/LanguageProvider";
import * as React from "react";
import {
  History,
  Filter,
  ChevronLeft,
  ChevronRight,
  FilePlus,
  FileText,
  FileEdit,
  Trash2,
  Eye,
  Download,
  LogIn,
  LogOut,
  KeyRound,
  type LucideIcon,
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
  ActivityTimeline,
  EmptyState,
  DirectionalIcon,
  type ActivityTimelineEvent,
  type ActivityTimelineTone,
} from "@repo/ui";
import { cn } from "@repo/ui/lib/utils";
import { getAuditLogs } from "../../../actions/audit";

type AuditLog = {
  id: string;
  userId: string;
  userEmail: string;
  userRole: string;
  action: string;
  resource: string;
  resourceId: string | null;
  metadata: any;
  ipAddress: string | null;
  createdAt: string;
};

const actionColors: Record<string, string> = {
  CREATE: "bg-green-500/10 text-green-500",
  READ: "bg-blue-500/10 text-blue-500",
  UPDATE: "bg-amber-500/10 text-amber-500",
  DELETE: "bg-red-500/10 text-red-500",
  READ_PII: "bg-purple-500/10 text-purple-500",
  EXPORT: "bg-indigo-500/10 text-indigo-500",
  LOGIN: "bg-cyan-500/10 text-cyan-500",
  LOGOUT: "bg-gray-500/10 text-gray-500",
  PASSWORD_CHANGE: "bg-orange-500/10 text-orange-500",
  PASSWORD_RESET: "bg-rose-500/10 text-rose-500",
};

const actionIcons: Record<string, LucideIcon> = {
  CREATE: FilePlus,
  READ: Eye,
  UPDATE: FileEdit,
  DELETE: Trash2,
  READ_PII: Eye,
  EXPORT: Download,
  LOGIN: LogIn,
  LOGOUT: LogOut,
  PASSWORD_CHANGE: KeyRound,
  PASSWORD_RESET: KeyRound,
};

const actionTones: Record<string, ActivityTimelineTone> = {
  CREATE: "success",
  READ: "info",
  UPDATE: "warning",
  DELETE: "destructive",
  READ_PII: "primary",
  EXPORT: "info",
  LOGIN: "info",
  LOGOUT: "default",
  PASSWORD_CHANGE: "warning",
  PASSWORD_RESET: "warning",
};

const labels = {
  ar: {
    title: "سجل التدقيق",
    subtitle: "تتبع جميع العمليات والوصول إلى البيانات",
    timestamp: "التاريخ",
    user: "المستخدم",
    action: "العملية",
    resource: "المورد",
    resourceId: "معرّف المورد",
    ip: "عنوان IP",
    noLogs: "لا توجد سجلات",
    noLogsDesc: "لم يتم تسجيل أي أحداث بعد.",
    filterAction: "تصفية حسب العملية",
    filterResource: "تصفية حسب المورد",
    all: "الكل",
    page: "صفحة",
    of: "من",
    prev: "السابق",
    next: "التالي",
    filters: "عوامل التصفية",
  },
  en: {
    title: "Audit log",
    subtitle: "Track all operations and data access",
    timestamp: "Timestamp",
    user: "User",
    action: "Action",
    resource: "Resource",
    resourceId: "Resource ID",
    ip: "IP Address",
    noLogs: "No audit events",
    noLogsDesc: "No events have been recorded yet.",
    filterAction: "Filter by action",
    filterResource: "Filter by resource",
    all: "All",
    page: "Page",
    of: "of",
    prev: "Previous",
    next: "Next",
    filters: "Filters",
  },
};

const ACTIONS = ["CREATE", "READ", "UPDATE", "DELETE", "READ_PII", "EXPORT", "LOGIN", "LOGOUT", "PASSWORD_CHANGE", "PASSWORD_RESET"];
const RESOURCES = ["Customer", "Contract", "Lease", "Reservation", "RentInstallment", "Unit", "Project", "User", "Organization", "Document", "MaintenanceRequest", "Auth"];

export default function AuditLogPage() {
  const { lang } = useLanguage();
  const [logs, setLogs] = React.useState<AuditLog[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [actionFilter, setActionFilter] = React.useState("");
  const [resourceFilter, setResourceFilter] = React.useState("");

  const t = labels[lang];

  const fetchLogs = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAuditLogs({
        page,
        pageSize: 50,
        action: actionFilter || undefined,
        resource: resourceFilter || undefined,
      });
      setLogs(result.logs);
      setTotalPages(result.totalPages);
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, resourceFilter]);

  React.useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString(lang === "ar" ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatRelative = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString(lang === "ar" ? "ar-SA" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const timelineEvents: ActivityTimelineEvent[] = logs.map((log) => ({
    key: log.id,
    icon: actionIcons[log.action] ?? FileText,
    tone: actionTones[log.action] ?? "default",
    label: (
      <span className="text-sm font-semibold text-foreground">
        {log.action} · <span className="font-normal text-muted-foreground">{log.resource}</span>
      </span>
    ),
    at: <span className="tabular-nums">{formatRelative(log.createdAt)}</span>,
    detail: (
      <div className="space-y-0.5">
        <div className="truncate">{log.userEmail}</div>
        <div className="text-[10px] text-muted-foreground/80 font-latin">
          {log.userRole}
          {log.ipAddress ? ` · ${log.ipAddress}` : ""}
          {log.resourceId ? ` · ${log.resourceId.slice(0, 8)}…` : ""}
        </div>
      </div>
    ),
  }));

  const FILTER_ACTIONS = ["", ...ACTIONS];

  return (
    <>
      {/* ─── Mobile (< md) ─────────────────────────────────────────────── */}
      <div
        className="md:hidden -m-4 sm:-m-6 min-h-dvh flex flex-col bg-background"
        dir={lang === "ar" ? "rtl" : "ltr"}
      >
        <AppBar title={t.title} subtitle={t.subtitle} lang={lang} />

        {/* Filter chips */}
        <div className="border-b border-border bg-card/50 px-4 py-3 space-y-3">
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {t.filters}
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {FILTER_ACTIONS.map((a) => {
              const isActive = actionFilter === a;
              const label = a || t.all;
              return (
                <button
                  key={a || "all"}
                  type="button"
                  onClick={() => {
                    setActionFilter(a);
                    setPage(1);
                  }}
                  className={cn(
                    "shrink-0 rounded-full px-3 h-9 text-xs font-medium transition-colors min-w-[44px]",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/70",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={resourceFilter}
              onChange={(e) => {
                setResourceFilter(e.target.value);
                setPage(1);
              }}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-xs text-foreground"
            >
              <option value="">{t.filterResource}: {t.all}</option>
              {RESOURCES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-4 py-4 pb-28">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground animate-pulse">
              {lang === "ar" ? "جاري التحميل..." : "Loading..."}
            </div>
          ) : logs.length === 0 ? (
            <EmptyState
              icon={<History className="h-12 w-12" />}
              title={t.noLogs}
              description={t.noLogsDesc}
            />
          ) : (
            <ActivityTimeline events={timelineEvents} />
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && !loading && logs.length > 0 && (
          <div className="sticky bottom-0 border-t border-border bg-card/95 backdrop-blur-md px-4 py-3 flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground tabular-nums">
              {t.page} {page} / {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                style={{ display: "inline-flex" }}
                className="min-h-[44px]"
              >
                <DirectionalIcon icon={ChevronLeft} className="h-3.5 w-3.5" />
                {t.prev}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                style={{ display: "inline-flex" }}
                className="min-h-[44px]"
              >
                {t.next}
                <DirectionalIcon icon={ChevronRight} className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Desktop (≥ md) ────────────────────────────────────────────── */}
      <div
        className={cn("hidden md:block p-6 max-w-full text-start")}
        dir={lang === "ar" ? "rtl" : "ltr"}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <History className="h-6 w-6 text-purple-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{t.title}</h1>
              <p className="text-xs text-muted-foreground">{t.subtitle}</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
              className="text-xs bg-surface border border-border rounded-md px-2 py-1.5"
            >
              <option value="">{t.filterAction}: {t.all}</option>
              {ACTIONS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <select
              value={resourceFilter}
              onChange={(e) => { setResourceFilter(e.target.value); setPage(1); }}
              className="text-xs bg-surface border border-border rounded-md px-2 py-1.5"
            >
              <option value="">{t.filterResource}: {t.all}</option>
              {RESOURCES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <Card className="overflow-hidden rounded-xl">
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead className="font-medium">{t.timestamp}</TableHead>
                <TableHead className="font-medium">{t.user}</TableHead>
                <TableHead className="font-medium">{t.action}</TableHead>
                <TableHead className="font-medium">{t.resource}</TableHead>
                <TableHead className="font-medium">{t.resourceId}</TableHead>
                <TableHead className="font-medium">{t.ip}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    <div className="animate-pulse">Loading...</div>
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">{t.noLogs}</TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-muted-foreground whitespace-nowrap">{formatDate(log.createdAt)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{log.userEmail}</div>
                      <div className="text-[10px] text-muted-foreground">{log.userRole}</div>
                    </TableCell>
                    <TableCell>
                      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold", actionColors[log.action] || "bg-gray-500/10 text-gray-500")}>
                        {log.action}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{log.resource}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-[10px]">{log.resourceId ? log.resourceId.slice(0, 12) + "..." : "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{log.ipAddress || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-muted-foreground">
              {t.page} {page} {t.of} {totalPages}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <DirectionalIcon icon={ChevronLeft} className="h-3.5 w-3.5" />
                {t.prev}
              </Button>
              <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                {t.next}
                <DirectionalIcon icon={ChevronRight} className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
