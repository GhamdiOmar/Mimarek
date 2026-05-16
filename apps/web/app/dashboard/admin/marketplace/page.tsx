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
  Card,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
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

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  PUBLISHED: "bg-success/15 text-success",
  UNDER_CONTRACT: "bg-info/15 text-info",
  SOLD_TRANSFERRED: "bg-primary/15 text-primary",
  UNPUBLISHED: "bg-warning/15 text-warning",
  EXPIRED: "bg-destructive/15 text-destructive",
  SUSPENDED: "bg-destructive/15 text-destructive",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  UNDER_CONTRACT: "Under Contract",
  SOLD_TRANSFERRED: "Transferred",
  UNPUBLISHED: "Unpublished",
  EXPIRED: "Expired",
  SUSPENDED: "Suspended",
};

const COMPLIANCE_STYLES: Record<string, string> = {
  APPROVED: "bg-success/15 text-success",
  PENDING_REVIEW: "bg-warning/15 text-warning",
  REJECTED: "bg-destructive/15 text-destructive",
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Listing #</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Seller Org</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Compliance</TableHead>
                <TableHead>Inquiries</TableHead>
                <TableHead>Published</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listings.map((listing) => (
                <TableRow key={listing.id}>
                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">
                      {listing.listingNumber}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium text-foreground line-clamp-1">
                      {listing.title ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-foreground">
                        {listing.sellerOrg.nameEnglish ?? listing.sellerOrg.name}
                      </span>
                      {listing.sellerOrg.nameEnglish && (
                        <span className="text-xs text-muted-foreground">
                          {listing.sellerOrg.name}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                        STATUS_STYLES[listing.status] ?? "bg-muted text-muted-foreground"
                      )}
                    >
                      {STATUS_LABELS[listing.status] ?? listing.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                        COMPLIANCE_STYLES[listing.complianceStatus] ?? "bg-muted text-muted-foreground"
                      )}
                    >
                      <Shield className="h-3 w-3" aria-hidden="true" />
                      {listing.complianceStatus}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm text-foreground">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                      {listing._count.inquiries}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {listing.publishedAt
                        ? new Date(listing.publishedAt).toLocaleDateString("en-GB")
                        : "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {listing.status !== "SUSPENDED" && listing.status !== "SOLD_TRANSFERRED" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openSuspend(listing)}
                        aria-label={`Suspend listing ${listing.listingNumber}`}
                      >
                        <Ban className="h-4 w-4 text-destructive" aria-hidden="true" />
                        <span className="ms-1.5 text-destructive">Suspend</span>
                      </Button>
                    )}
                    {listing.status === "SUSPENDED" && (
                      <span className="text-xs text-muted-foreground italic">Suspended</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
              variant="danger"
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
