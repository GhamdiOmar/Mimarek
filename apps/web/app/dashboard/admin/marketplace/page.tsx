"use client";

import * as React from "react";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Shield,
  Store,
  Users,
  Loader2,
  Ban,
  AlertCircle,
} from "lucide-react";
import {
  Button,
  Badge,
  Card,
  DataTable,
  type ColumnDef,
  IconButton,
  EmptyState,
  Skeleton,
  ResponsiveDialog,
} from "@repo/ui";
import { PageHeader } from "@repo/ui/components/PageHeader";
import { DirectionalIcon } from "@repo/ui";
import { cn } from "@repo/ui/lib/utils";
import { useLanguage } from "../../../../components/LanguageProvider";
import {
  listListingsForModeration,
  moderateSuspendListing,
} from "../../../actions/marketplace";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type ModerationListing = {
  id: string;
  listingNumber: string;
  title: string | null;
  status: string;
  complianceStatus: string;
  publishedAt: string | null;
  createdAt: string;
  sellerOrg: { id: string; name: string; nameEnglish: string | null };
  _count: { inquiries: number };
};

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  UNDER_CONTRACT: "Under Contract",
  SOLD_TRANSFERRED: "Transferred",
  UNPUBLISHED: "Unpublished",
  EXPIRED: "Expired",
  SUSPENDED: "Suspended",
};

const STATUS_VARIANT: Record<string, "default" | "success" | "info" | "sold" | "warning" | "error"> = {
  DRAFT: "default",
  PUBLISHED: "success",
  UNDER_CONTRACT: "info",
  SOLD_TRANSFERRED: "sold",
  UNPUBLISHED: "warning",
  EXPIRED: "error",
  SUSPENDED: "error",
};

const COMPLIANCE_VARIANT: Record<string, "success" | "warning" | "error"> = {
  APPROVED: "success",
  PENDING_REVIEW: "warning",
  REJECTED: "error",
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AdminMarketplacePage() {
  const { lang } = useLanguage();

  const [listings, setListings] = React.useState<ModerationListing[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Suspend dialog
  const [suspendTarget, setSuspendTarget] = React.useState<ModerationListing | null>(null);
  const [suspendReason, setSuspendReason] = React.useState("");
  const [suspending, setSuspending] = React.useState(false);
  const [suspendError, setSuspendError] = React.useState<string | null>(null);

  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; message: string } | null>(null);

  async function loadListings() {
    try {
      const data = await listListingsForModeration();
      setListings(data as unknown as ModerationListing[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadListings();
  }, []);

  React.useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [feedback]);

  function openSuspend(listing: ModerationListing) {
    setSuspendTarget(listing);
    setSuspendReason("");
    setSuspendError(null);
  }

  async function handleSuspend() {
    if (!suspendTarget || !suspendReason.trim()) return;
    setSuspending(true);
    setSuspendError(null);
    try {
      await moderateSuspendListing(suspendTarget.id, suspendReason.trim());
      setListings((prev) =>
        prev.map((l) => l.id === suspendTarget.id ? { ...l, status: "SUSPENDED" } : l)
      );
      setFeedback({ type: "success", message: `Listing ${suspendTarget.listingNumber} suspended successfully.` });
      setSuspendTarget(null);
    } catch (err: unknown) {
      setSuspendError(err instanceof Error ? err.message : "Failed to suspend listing");
    } finally {
      setSuspending(false);
    }
  }

  // ── Columns ───────────────────────────────────────────────────────────────

  const columns: ColumnDef<ModerationListing>[] = [
    {
      accessorKey: "listingNumber",
      header: lang === "ar" ? "رقم القائمة" : "Listing #",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.listingNumber}
        </span>
      ),
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: "title",
      header: lang === "ar" ? "العنوان" : "Title",
      cell: ({ row }) => (
        <span className="text-sm font-medium text-foreground line-clamp-1">
          {row.original.title ?? "—"}
        </span>
      ),
      enableSorting: true,
      enableHiding: true,
    },
    {
      id: "sellerOrg",
      header: lang === "ar" ? "المنظمة البائعة" : "Seller Org",
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">
            {row.original.sellerOrg.nameEnglish ?? row.original.sellerOrg.name}
          </span>
          {row.original.sellerOrg.nameEnglish && (
            <span className="text-xs text-muted-foreground">
              {row.original.sellerOrg.name}
            </span>
          )}
        </div>
      ),
      enableSorting: false,
      enableHiding: true,
    },
    {
      accessorKey: "status",
      header: lang === "ar" ? "الحالة" : "Status",
      cell: ({ row }) => (
        <Badge variant={STATUS_VARIANT[row.original.status] ?? "default"} size="sm">
          {STATUS_LABELS[row.original.status] ?? row.original.status}
        </Badge>
      ),
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: "complianceStatus",
      header: lang === "ar" ? "الامتثال" : "Compliance",
      cell: ({ row }) => (
        <Badge variant={COMPLIANCE_VARIANT[row.original.complianceStatus] ?? "default"} size="sm">
          <Shield className="h-3 w-3" aria-hidden="true" />
          {row.original.complianceStatus}
        </Badge>
      ),
      enableSorting: true,
      enableHiding: true,
    },
    {
      id: "inquiries",
      header: lang === "ar" ? "الاستفسارات" : "Inquiries",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-sm text-foreground">
          <Users className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          {row.original._count.inquiries}
        </div>
      ),
      enableSorting: false,
      enableHiding: true,
      meta: { numeric: true },
    },
    {
      accessorKey: "publishedAt",
      header: lang === "ar" ? "تاريخ النشر" : "Published",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.publishedAt
            ? new Date(row.original.publishedAt).toLocaleDateString("en-GB")
            : "—"}
        </span>
      ),
      enableSorting: true,
      enableHiding: true,
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const listing = row.original;
        if (listing.status === "SUSPENDED") {
          return (
            <span className="text-xs text-muted-foreground italic">
              {lang === "ar" ? "موقوف" : "Suspended"}
            </span>
          );
        }
        if (listing.status === "SOLD_TRANSFERRED") {
          return null;
        }
        return (
          <div className="flex items-center gap-1">
            <IconButton
              icon={Ban}
              aria-label={lang === "ar" ? "إيقاف" : "Suspend"}
              onClick={() => openSuspend(listing)}
              className="text-destructive hover:text-destructive"
              size="sm"
            />
          </div>
        );
      },
    },
  ];

  // ── Mobile card ───────────────────────────────────────────────────────────

  function mobileCard(listing: ModerationListing) {
    return (
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-sm font-medium text-foreground line-clamp-1">
              {listing.title ?? "—"}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {listing.listingNumber}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {listing.status !== "SUSPENDED" && listing.status !== "SOLD_TRANSFERRED" && (
              <IconButton
                icon={Ban}
                aria-label={lang === "ar" ? "إيقاف" : "Suspend"}
                onClick={() => openSuspend(listing)}
                className="text-destructive hover:text-destructive"
                size="sm"
              />
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={STATUS_VARIANT[listing.status] ?? "default"} size="sm">
            {STATUS_LABELS[listing.status] ?? listing.status}
          </Badge>
          <Badge variant={COMPLIANCE_VARIANT[listing.complianceStatus] ?? "default"} size="sm">
            <Shield className="h-3 w-3" aria-hidden="true" />
            {listing.complianceStatus}
          </Badge>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{listing.sellerOrg.nameEnglish ?? listing.sellerOrg.name}</span>
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3" aria-hidden="true" />
            {listing._count.inquiries}
          </div>
        </div>
        {listing.publishedAt && (
          <span className="text-xs text-muted-foreground">
            {new Date(listing.publishedAt).toLocaleDateString("en-GB")}
          </span>
        )}
      </div>
    );
  }

  // ── Row class ────────────────────────────────────────────────────────────

  function rowClassName(listing: ModerationListing) {
    if (listing.status === "SUSPENDED") return "opacity-60";
    return undefined;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* Back link */}
      <div>
        <Link
          href="/dashboard/admin"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4 transition-colors"
        >
          <DirectionalIcon icon={ArrowLeft} className="w-4 h-4" />
          Back to Admin
        </Link>
      </div>

      {/* Header */}
      <PageHeader
        title="Marketplace Moderation"
        description="Review, monitor and moderate all marketplace listings across tenant organizations"
        actions={
          <Button variant="outline" size="sm" onClick={loadListings}>
            Refresh
          </Button>
        }
      />

      {/* Feedback */}
      {feedback && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium border",
            feedback.type === "success"
              ? "bg-success/10 text-success border-success/30"
              : "bg-destructive/10 text-destructive border-destructive/30"
          )}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          )}
          {feedback.message}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <EmptyState
          variant="default"
          icon={<Store className="h-12 w-12" aria-hidden="true" />}
          title="No listings to moderate"
          description="No marketplace listings exist yet across any tenant organizations."
        />
      ) : (
        <Card className="overflow-hidden">
          <DataTable
            columns={columns}
            data={listings}
            mobileCard={mobileCard}
            rowClassName={rowClassName}
            locale={lang === "ar" ? "ar" : "en"}
            pagination
            pageSize={10}
            getRowId={(r) => r.id}
            emptyTitle={lang === "ar" ? "لا توجد قوائم" : "No listings"}
            emptyDescription={lang === "ar" ? "لا توجد قوائم سوق للمراجعة." : "No marketplace listings to review."}
          />
        </Card>
      )}

      {/* Suspend confirm dialog */}
      <ResponsiveDialog
        open={!!suspendTarget}
        onOpenChange={(open) => { if (!open && !suspending) setSuspendTarget(null); }}
        title="Suspend Listing"
        description={`Suspend listing "${suspendTarget?.title ?? suspendTarget?.listingNumber}" from ${suspendTarget?.sellerOrg.nameEnglish ?? suspendTarget?.sellerOrg.name}? The seller will be notified with the reason.`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setSuspendTarget(null)} disabled={suspending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleSuspend}
              disabled={suspending || !suspendReason.trim()}
            >
              {suspending && <Loader2 className="h-4 w-4 animate-spin me-1.5" aria-hidden="true" />}
              Confirm Suspension
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-2">
          {suspendError && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {suspendError}
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Suspension reason (required — shown to seller)
            </label>
            <textarea
              aria-label="Suspension reason"
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              rows={3}
              placeholder="Enter a clear reason for suspension…"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>
        </div>
      </ResponsiveDialog>
    </div>
  );
}
