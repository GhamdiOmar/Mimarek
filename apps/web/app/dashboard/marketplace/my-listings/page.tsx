"use client";

import * as React from "react";
import {
  Store,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Pencil,
  EyeOff,
  Handshake,
  Inbox,
  Users,
  ArrowRight,
} from "lucide-react";
import {
  Button,
  Badge,
  Input,
  Card,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  PageIntro,
  ResponsiveDialog,
  EmptyState,
  Skeleton,
} from "@repo/ui";
import { cn } from "@repo/ui/lib/utils";
import { useLanguage } from "../../../../components/LanguageProvider";
import {
  listMyMarketplaceListings,
  updateMarketplaceListing,
  unpublishMarketplaceListing,
  listIncomingMarketplaceInquiries,
  convertMarketplaceInquiryToDeal,
  settleMarketplaceTransfer,
} from "../../../actions/marketplace";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type MyListing = {
  id: string;
  listingNumber: string;
  title: string | null;
  status: string;
  price: number | null;
  city: string | null;
  district: string | null;
  propertyType: string | null;
  publishedAt: string | null;
  _count: { inquiries: number };
};

type IncomingInquiry = {
  id: string;
  status: string;
  message: string | null;
  createdAt: string;
  listing: { id: string; listingNumber: string; title: string | null };
  reservation: { id: string; status: string } | null;
  transfer: { id: string; status: string } | null;
};

// ─── Status config ────────────────────────────────────────────────────────────

const LISTING_STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  PUBLISHED: "bg-success/15 text-success",
  UNDER_CONTRACT: "bg-info/15 text-info",
  SOLD_TRANSFERRED: "bg-primary/15 text-primary",
  UNPUBLISHED: "bg-warning/15 text-warning",
  EXPIRED: "bg-destructive/15 text-destructive",
  SUSPENDED: "bg-destructive/15 text-destructive",
};

const LISTING_STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  DRAFT: { ar: "مسودة", en: "Draft" },
  PUBLISHED: { ar: "منشور", en: "Published" },
  UNDER_CONTRACT: { ar: "تحت التعاقد", en: "Under Contract" },
  SOLD_TRANSFERRED: { ar: "مُنقل", en: "Transferred" },
  UNPUBLISHED: { ar: "مُلغى النشر", en: "Unpublished" },
  EXPIRED: { ar: "منتهي الصلاحية", en: "Expired" },
  SUSPENDED: { ar: "موقوف", en: "Suspended" },
};

const INQUIRY_STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-info/15 text-info",
  WITHDRAWN: "bg-muted text-muted-foreground",
  CONVERTED_TO_DEAL: "bg-success/15 text-success",
  CLOSED_WON: "bg-success/15 text-success",
  CLOSED_LOST: "bg-destructive/15 text-destructive",
};

const INQUIRY_STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  OPEN: { ar: "مفتوح", en: "Open" },
  WITHDRAWN: { ar: "مسحوب", en: "Withdrawn" },
  CONVERTED_TO_DEAL: { ar: "صفقة نشطة", en: "Active Deal" },
  CLOSED_WON: { ar: "مكتمل", en: "Completed" },
  CLOSED_LOST: { ar: "مغلق", en: "Closed" },
};

function formatSARLocal(amount: number | null, lang: "ar" | "en") {
  if (amount == null) return "—";
  return new Intl.NumberFormat(lang === "ar" ? "ar-SA" : "en-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0,
  }).format(amount);
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MyListingsPage() {
  const { lang } = useLanguage();

  const [listings, setListings] = React.useState<MyListing[]>([]);
  const [loadingListings, setLoadingListings] = React.useState(true);
  const [inquiries, setInquiries] = React.useState<IncomingInquiry[]>([]);
  const [loadingInquiries, setLoadingInquiries] = React.useState(true);

  // Edit listing dialog
  const [editTarget, setEditTarget] = React.useState<MyListing | null>(null);
  const [editTitle, setEditTitle] = React.useState("");
  const [editPrice, setEditPrice] = React.useState("");
  const [editDescription, setEditDescription] = React.useState("");
  const [editing, setEditing] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);

  // Unpublish dialog
  const [unpublishTarget, setUnpublishTarget] = React.useState<MyListing | null>(null);
  const [unpublishReason, setUnpublishReason] = React.useState("");
  const [unpublishing, setUnpublishing] = React.useState(false);
  const [unpublishError, setUnpublishError] = React.useState<string | null>(null);

  // Convert to deal dialog
  const [convertTarget, setConvertTarget] = React.useState<IncomingInquiry | null>(null);
  const [converting, setConverting] = React.useState(false);
  const [convertError, setConvertError] = React.useState<string | null>(null);

  // Settle transfer dialog
  const [settleTarget, setSettleTarget] = React.useState<IncomingInquiry | null>(null);
  const [settling, setSettling] = React.useState(false);
  const [settleError, setSettleError] = React.useState<string | null>(null);

  async function loadAll() {
    try {
      const [l, i] = await Promise.all([
        listMyMarketplaceListings(),
        listIncomingMarketplaceInquiries(),
      ]);
      setListings(l as unknown as MyListing[]);
      setInquiries(i as unknown as IncomingInquiry[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingListings(false);
      setLoadingInquiries(false);
    }
  }

  React.useEffect(() => {
    loadAll();
  }, []);

  // ── Edit ──────────────────────────────────────────────────────────────────

  function openEdit(listing: MyListing) {
    setEditTarget(listing);
    setEditTitle(listing.title ?? "");
    setEditPrice(listing.price != null ? String(listing.price) : "");
    setEditDescription("");
    setEditError(null);
  }

  async function handleEdit() {
    if (!editTarget) return;
    setEditing(true);
    setEditError(null);
    try {
      await updateMarketplaceListing(editTarget.id, {
        title: editTitle.trim() || undefined,
        price: editPrice ? Number(editPrice) : undefined,
        description: editDescription.trim() || undefined,
      });
      setListings((prev) =>
        prev.map((l) =>
          l.id === editTarget.id
            ? { ...l, title: editTitle.trim() || l.title, price: editPrice ? Number(editPrice) : l.price }
            : l
        )
      );
      setEditTarget(null);
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : (lang === "ar" ? "فشل التعديل" : "Failed to update"));
    } finally {
      setEditing(false);
    }
  }

  // ── Unpublish ─────────────────────────────────────────────────────────────

  function openUnpublish(listing: MyListing) {
    setUnpublishTarget(listing);
    setUnpublishReason("");
    setUnpublishError(null);
  }

  async function handleUnpublish() {
    if (!unpublishTarget || !unpublishReason.trim()) return;
    setUnpublishing(true);
    setUnpublishError(null);
    try {
      await unpublishMarketplaceListing(unpublishTarget.id, unpublishReason.trim());
      setListings((prev) =>
        prev.map((l) => l.id === unpublishTarget.id ? { ...l, status: "UNPUBLISHED" } : l)
      );
      setUnpublishTarget(null);
    } catch (err: unknown) {
      setUnpublishError(err instanceof Error ? err.message : (lang === "ar" ? "فشل إلغاء النشر" : "Failed to unpublish"));
    } finally {
      setUnpublishing(false);
    }
  }

  // ── Convert to deal ───────────────────────────────────────────────────────

  function openConvert(inq: IncomingInquiry) {
    setConvertTarget(inq);
    setConvertError(null);
  }

  async function handleConvert() {
    if (!convertTarget) return;
    setConverting(true);
    setConvertError(null);
    try {
      await convertMarketplaceInquiryToDeal(convertTarget.id);
      setInquiries((prev) =>
        prev.map((i) => i.id === convertTarget.id ? { ...i, status: "CONVERTED_TO_DEAL" } : i)
      );
      setConvertTarget(null);
    } catch (err: unknown) {
      setConvertError(err instanceof Error ? err.message : (lang === "ar" ? "فشل التحويل" : "Failed to convert"));
    } finally {
      setConverting(false);
    }
  }

  // ── Settle transfer ───────────────────────────────────────────────────────

  function openSettle(inq: IncomingInquiry) {
    setSettleTarget(inq);
    setSettleError(null);
  }

  async function handleSettle() {
    if (!settleTarget?.transfer) return;
    setSettling(true);
    setSettleError(null);
    try {
      await settleMarketplaceTransfer(settleTarget.transfer.id);
      setInquiries((prev) =>
        prev.map((i) =>
          i.id === settleTarget.id && i.transfer
            ? { ...i, transfer: { ...i.transfer, status: "COMPLETED" } }
            : i
        )
      );
      setSettleTarget(null);
    } catch (err: unknown) {
      setSettleError(err instanceof Error ? err.message : (lang === "ar" ? "فشل تسوية التحويل" : "Failed to settle transfer"));
    } finally {
      setSettling(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 p-4 md:p-6" dir={lang === "ar" ? "rtl" : "ltr"}>
      <PageIntro
        title={lang === "ar" ? "إعلاناتي في السوق" : "My Marketplace Listings"}
        description={
          lang === "ar"
            ? "إدارة إعلاناتك العقارية ومتابعة الاستفسارات الواردة"
            : "Manage your property listings and track incoming inquiries"
        }
      />

      {/* ── My Listings section ──────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">
          {lang === "ar" ? "الإعلانات" : "Listings"}
        </h2>

        {loadingListings ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <EmptyState
            variant="first-time"
            icon={<Store className="h-12 w-12" aria-hidden="true" />}
            title={lang === "ar" ? "لا توجد إعلانات بعد" : "No listings yet"}
            description={
              lang === "ar"
                ? "يمكنك نشر وحداتك المتاحة في السوق العقاري لتصلك الاستفسارات"
                : "You can list your available units on the marketplace to receive inquiries"
            }
            action={
              <Button asChild variant="primary">
                <Link href="/dashboard/units">
                  {lang === "ar" ? "إدارة الوحدات" : "Manage Units"}
                </Link>
              </Button>
            }
          />
        ) : (
          <>
            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {listings.map((listing) => (
                <Card key={listing.id} className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {listing.title ?? listing.listingNumber}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">{listing.listingNumber}</p>
                      </div>
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          LISTING_STATUS_STYLES[listing.status] ?? "bg-muted text-muted-foreground"
                        )}
                      >
                        {lang === "ar"
                          ? (LISTING_STATUS_LABELS[listing.status]?.ar ?? listing.status)
                          : (LISTING_STATUS_LABELS[listing.status]?.en ?? listing.status)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-primary">
                        {formatSARLocal(listing.price, lang)}
                      </span>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="h-3.5 w-3.5" aria-hidden="true" />
                        {listing._count.inquiries}
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 min-h-[44px]"
                        onClick={() => openEdit(listing)}
                        disabled={listing.status === "SOLD_TRANSFERRED"}
                      >
                        <Pencil className="h-3.5 w-3.5 me-1" aria-hidden="true" />
                        {lang === "ar" ? "تعديل" : "Edit"}
                      </Button>
                      {(listing.status === "PUBLISHED" || listing.status === "DRAFT") && (
                        <Button
                          variant="danger"
                          size="sm"
                          className="flex-1 min-h-[44px]"
                          onClick={() => openUnpublish(listing)}
                        >
                          <EyeOff className="h-3.5 w-3.5 me-1" aria-hidden="true" />
                          {lang === "ar" ? "إلغاء النشر" : "Unpublish"}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block">
              <Card className="overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{lang === "ar" ? "رقم الإعلان" : "Listing #"}</TableHead>
                      <TableHead>{lang === "ar" ? "العنوان" : "Title"}</TableHead>
                      <TableHead>{lang === "ar" ? "الحالة" : "Status"}</TableHead>
                      <TableHead>{lang === "ar" ? "السعر" : "Price"}</TableHead>
                      <TableHead>{lang === "ar" ? "الموقع" : "Location"}</TableHead>
                      <TableHead>{lang === "ar" ? "الاستفسارات" : "Inquiries"}</TableHead>
                      <TableHead>{lang === "ar" ? "تاريخ النشر" : "Published"}</TableHead>
                      <TableHead>{lang === "ar" ? "إجراءات" : "Actions"}</TableHead>
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
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                              LISTING_STATUS_STYLES[listing.status] ?? "bg-muted text-muted-foreground"
                            )}
                          >
                            {lang === "ar"
                              ? (LISTING_STATUS_LABELS[listing.status]?.ar ?? listing.status)
                              : (LISTING_STATUS_LABELS[listing.status]?.en ?? listing.status)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-semibold text-primary">
                            {formatSARLocal(listing.price, lang)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-foreground">
                            {[listing.city, listing.district].filter(Boolean).join("، ") || "—"}
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
                              ? new Date(listing.publishedAt).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-GB")
                              : "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(listing)}
                              disabled={listing.status === "SOLD_TRANSFERRED"}
                              aria-label={lang === "ar" ? `تعديل ${listing.listingNumber}` : `Edit ${listing.listingNumber}`}
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                            </Button>
                            {(listing.status === "PUBLISHED" || listing.status === "DRAFT") && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openUnpublish(listing)}
                                aria-label={lang === "ar" ? `إلغاء نشر ${listing.listingNumber}` : `Unpublish ${listing.listingNumber}`}
                              >
                                <EyeOff className="h-4 w-4 text-destructive" aria-hidden="true" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          </>
        )}
      </section>

      {/* ── Incoming inquiries section ───────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">
          {lang === "ar" ? "الاستفسارات الواردة" : "Incoming Inquiries"}
        </h2>

        {loadingInquiries ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : inquiries.length === 0 ? (
          <EmptyState
            variant="default"
            icon={<Inbox className="h-10 w-10" aria-hidden="true" />}
            title={lang === "ar" ? "لا توجد استفسارات واردة" : "No incoming inquiries"}
            description={
              lang === "ar"
                ? "حين يُبدي مشترٍ اهتمامه بإعلانك ستجد استفسارهم هنا"
                : "When a buyer expresses interest in your listing, their inquiry will appear here"
            }
            compact
          />
        ) : (
          <>
            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {inquiries.map((inq) => (
                <Card key={inq.id} className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {inq.listing.title ?? inq.listing.listingNumber}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(inq.createdAt).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-GB")}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          INQUIRY_STATUS_STYLES[inq.status] ?? "bg-muted text-muted-foreground"
                        )}
                      >
                        {lang === "ar"
                          ? (INQUIRY_STATUS_LABELS[inq.status]?.ar ?? inq.status)
                          : (INQUIRY_STATUS_LABELS[inq.status]?.en ?? inq.status)}
                      </span>
                    </div>
                    {inq.message && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{inq.message}</p>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {inq.status === "OPEN" && (
                        <Button
                          variant="primary"
                          size="sm"
                          className="min-h-[44px]"
                          onClick={() => openConvert(inq)}
                        >
                          <ArrowRight className="h-3.5 w-3.5 me-1" aria-hidden="true" />
                          {lang === "ar" ? "تحويل لصفقة" : "Convert to Deal"}
                        </Button>
                      )}
                      {inq.transfer?.status === "PENDING_SETTLEMENT" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-[44px]"
                          onClick={() => openSettle(inq)}
                        >
                          <Handshake className="h-3.5 w-3.5 me-1" aria-hidden="true" />
                          {lang === "ar" ? "تسوية التحويل" : "Settle & Transfer"}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block">
              <Card className="overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{lang === "ar" ? "الإعلان" : "Listing"}</TableHead>
                      <TableHead>{lang === "ar" ? "الحالة" : "Status"}</TableHead>
                      <TableHead>{lang === "ar" ? "التحويل" : "Transfer"}</TableHead>
                      <TableHead>{lang === "ar" ? "الرسالة" : "Message"}</TableHead>
                      <TableHead>{lang === "ar" ? "التاريخ" : "Date"}</TableHead>
                      <TableHead>{lang === "ar" ? "إجراءات" : "Actions"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inquiries.map((inq) => (
                      <TableRow key={inq.id}>
                        <TableCell>
                          <span className="text-sm font-medium text-foreground">
                            {inq.listing.title ?? inq.listing.listingNumber}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                              INQUIRY_STATUS_STYLES[inq.status] ?? "bg-muted text-muted-foreground"
                            )}
                          >
                            {lang === "ar"
                              ? (INQUIRY_STATUS_LABELS[inq.status]?.ar ?? inq.status)
                              : (INQUIRY_STATUS_LABELS[inq.status]?.en ?? inq.status)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {inq.transfer ? (
                            <span className="text-xs text-muted-foreground">{inq.transfer.status}</span>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">
                            {inq.message ?? "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {new Date(inq.createdAt).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-GB")}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {inq.status === "OPEN" && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => openConvert(inq)}
                              >
                                <ArrowRight className="h-3.5 w-3.5 me-1" aria-hidden="true" />
                                {lang === "ar" ? "تحويل لصفقة" : "Convert to Deal"}
                              </Button>
                            )}
                            {inq.transfer?.status === "PENDING_SETTLEMENT" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openSettle(inq)}
                              >
                                <Handshake className="h-3.5 w-3.5 me-1" aria-hidden="true" />
                                {lang === "ar" ? "تسوية" : "Settle"}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          </>
        )}
      </section>

      {/* ── Edit listing dialog ────────────────────────────────────────── */}
      <ResponsiveDialog
        open={!!editTarget}
        onOpenChange={(open) => { if (!open && !editing) setEditTarget(null); }}
        title={lang === "ar" ? "تعديل الإعلان" : "Edit Listing"}
        description={
          lang === "ar"
            ? `تعديل بيانات الإعلان "${editTarget?.title ?? editTarget?.listingNumber}"`
            : `Edit listing "${editTarget?.title ?? editTarget?.listingNumber}"`
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditTarget(null)} disabled={editing}>
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button variant="primary" onClick={handleEdit} disabled={editing}>
              {editing && <Loader2 className="h-4 w-4 animate-spin me-1.5" aria-hidden="true" />}
              {lang === "ar" ? "حفظ التعديلات" : "Save Changes"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-2">
          {editError && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {editError}
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              {lang === "ar" ? "عنوان الإعلان" : "Listing Title"}
            </label>
            <Input
              aria-label={lang === "ar" ? "عنوان الإعلان" : "Listing title"}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder={lang === "ar" ? "عنوان الإعلان..." : "Listing title…"}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              {lang === "ar" ? "السعر (ر.س)" : "Price (SAR)"}
            </label>
            <Input
              aria-label={lang === "ar" ? "السعر" : "Price"}
              type="number"
              min={0}
              value={editPrice}
              onChange={(e) => setEditPrice(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              {lang === "ar" ? "الوصف (اختياري)" : "Description (optional)"}
            </label>
            <textarea
              aria-label={lang === "ar" ? "وصف الإعلان" : "Listing description"}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={3}
              placeholder={lang === "ar" ? "أضف وصفاً للإعلان..." : "Add a description…"}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>
        </div>
      </ResponsiveDialog>

      {/* ── Unpublish confirm dialog ─────────────────────────────────────── */}
      <ResponsiveDialog
        open={!!unpublishTarget}
        onOpenChange={(open) => { if (!open && !unpublishing) setUnpublishTarget(null); }}
        title={lang === "ar" ? "إلغاء نشر الإعلان" : "Unpublish Listing"}
        description={
          lang === "ar"
            ? `هل تريد إلغاء نشر الإعلان "${unpublishTarget?.title ?? unpublishTarget?.listingNumber}"؟`
            : `Are you sure you want to unpublish "${unpublishTarget?.title ?? unpublishTarget?.listingNumber}"?`
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setUnpublishTarget(null)} disabled={unpublishing}>
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              variant="danger"
              onClick={handleUnpublish}
              disabled={unpublishing || !unpublishReason.trim()}
            >
              {unpublishing && <Loader2 className="h-4 w-4 animate-spin me-1.5" aria-hidden="true" />}
              {lang === "ar" ? "تأكيد الإلغاء" : "Confirm Unpublish"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-2">
          {unpublishError && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {unpublishError}
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              {lang === "ar" ? "سبب الإلغاء (مطلوب)" : "Reason for unpublishing (required)"}
            </label>
            <textarea
              aria-label={lang === "ar" ? "سبب إلغاء النشر" : "Reason for unpublishing"}
              value={unpublishReason}
              onChange={(e) => setUnpublishReason(e.target.value)}
              rows={2}
              placeholder={lang === "ar" ? "أدخل سبباً..." : "Enter a reason…"}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>
        </div>
      </ResponsiveDialog>

      {/* ── Convert to deal confirm dialog ──────────────────────────────── */}
      <ResponsiveDialog
        open={!!convertTarget}
        onOpenChange={(open) => { if (!open && !converting) setConvertTarget(null); }}
        title={lang === "ar" ? "تحويل الاستفسار إلى صفقة" : "Convert Inquiry to Deal"}
        description={
          lang === "ar"
            ? `هل تريد تحويل هذا الاستفسار على "${convertTarget?.listing.title ?? convertTarget?.listing.listingNumber}" إلى صفقة نشطة؟ ستُحجز الوحدة ويُنشأ عقد مبدئي.`
            : `Convert this inquiry on "${convertTarget?.listing.title ?? convertTarget?.listing.listingNumber}" to an active deal? The unit will be reserved and a preliminary contract will be created.`
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConvertTarget(null)} disabled={converting}>
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button variant="primary" onClick={handleConvert} disabled={converting}>
              {converting && <Loader2 className="h-4 w-4 animate-spin me-1.5" aria-hidden="true" />}
              {lang === "ar" ? "تأكيد التحويل" : "Confirm Convert"}
            </Button>
          </div>
        }
      >
        {convertError && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {convertError}
          </div>
        )}
      </ResponsiveDialog>

      {/* ── Settle transfer confirm dialog ───────────────────────────────── */}
      <ResponsiveDialog
        open={!!settleTarget}
        onOpenChange={(open) => { if (!open && !settling) setSettleTarget(null); }}
        title={lang === "ar" ? "تسوية ونقل ملكية الوحدة" : "Settle & Transfer Unit"}
        description={
          lang === "ar"
            ? `هل تريد تسوية ونقل الوحدة للمشتري نهائياً؟ تأكد من وجود عقد بيع موقّع قبل المتابعة. هذه العملية لا يمكن التراجع عنها.`
            : `Confirm settlement and final transfer of the unit to the buyer. Ensure a signed sale contract exists before proceeding. This action cannot be undone.`
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setSettleTarget(null)} disabled={settling}>
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button variant="primary" onClick={handleSettle} disabled={settling}>
              {settling && <Loader2 className="h-4 w-4 animate-spin me-1.5" aria-hidden="true" />}
              {lang === "ar" ? "تأكيد التسوية" : "Confirm Settlement"}
            </Button>
          </div>
        }
      >
        {settleError && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {settleError}
          </div>
        )}
      </ResponsiveDialog>
    </div>
  );
}
