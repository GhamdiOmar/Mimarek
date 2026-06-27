"use client";

import * as React from "react";
import {
  Store,
  Loader2,
  AlertCircle,
  Pencil,
  EyeOff,
  Handshake,
  Inbox,
  Users,
  ArrowRight,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ScrollText,
  CheckCircle2,
} from "lucide-react";
import {
  Button,
  Badge,
  Input,
  Card,
  PageIntro,
  ResponsiveDialog,
  EmptyState,
  Skeleton,
  DataTable,
  IconButton,
  DirectionalIcon,
  Field,
  type ColumnDef,
} from "@repo/ui";
import { useLanguage } from "../../../../components/LanguageProvider";
import { UploadDropzone } from "../../../../lib/uploadthing";
import {
  MARKETPLACE_LISTING_STATUS_LABEL as LISTING_STATUS_LABELS,
  MARKETPLACE_LISTING_STATUS_VARIANT as LISTING_STATUS_BADGE,
  MARKETPLACE_INQUIRY_STATUS_LABEL as INQUIRY_STATUS_LABELS,
} from "../../../../lib/domain-labels";
import {
  listMyMarketplaceListings,
  updateMarketplaceListing,
  unpublishMarketplaceListing,
  listIncomingMarketplaceInquiries,
  convertMarketplaceInquiryToDeal,
  settleMarketplaceTransfer,
  getMyOrgRegaAuthorization,
  submitOrgRegaAuthorization,
  submitDeedTransferProof,
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
  transfer: {
    id: string;
    status: string;
    deedProof: { status: string } | null;
  } | null;
};

type OrgRega = {
  id: string;
  regaLicenseNumber: string | null;
  status: string;
  isSeller: boolean;
  isBuyer: boolean;
  rejectedReason: string | null;
} | null;

// ─── Status config ────────────────────────────────────────────────────────────
// Listing + inquiry status labels/variants come from the canonical registry
// (lib/domain-labels.ts) — imported above. Do not re-declare locally (§6.11.4).

const INQUIRY_STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-info/15 text-info-strong",
  WITHDRAWN: "bg-muted text-muted-foreground",
  CONVERTED_TO_DEAL: "bg-success/15 text-success-strong",
  CLOSED_WON: "bg-success/15 text-success-strong",
  CLOSED_LOST: "bg-destructive/15 text-destructive",
};

const DEED_PROOF_STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  PENDING: { ar: "قيد المراجعة", en: "Pending review" },
  VERIFIED: { ar: "موثّق", en: "Verified" },
  REJECTED: { ar: "مرفوض", en: "Rejected" },
};

const DEED_PROOF_STATUS_VARIANT: Record<
  string,
  React.ComponentProps<typeof Badge>["variant"]
> = {
  PENDING: "warning",
  VERIFIED: "success",
  REJECTED: "error",
};

function formatSARLocal(amount: number | null, lang: "ar" | "en") {
  if (amount == null) return "—";
  return new Intl.NumberFormat(lang === "ar" ? "ar-SA-u-nu-latn" : "en-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0,
  }).format(amount);
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MyListingsPage() {
  const { lang } = useLanguage();
  const t = React.useCallback(
    (en: string, ar: string) => (lang === "ar" ? ar : en),
    [lang],
  );

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

  // Org REGA authorization
  const [rega, setRega] = React.useState<OrgRega>(null);
  const [loadingRega, setLoadingRega] = React.useState(true);
  const [regaDialogOpen, setRegaDialogOpen] = React.useState(false);
  const [regaLicense, setRegaLicense] = React.useState("");
  const [regaIsSeller, setRegaIsSeller] = React.useState(true);
  const [regaIsBuyer, setRegaIsBuyer] = React.useState(false);
  const [regaSubmitting, setRegaSubmitting] = React.useState(false);
  const [regaError, setRegaError] = React.useState<string | null>(null);

  // Deed-proof submission dialog
  const [proofTarget, setProofTarget] = React.useState<IncomingInquiry | null>(null);
  const [deedNumber, setDeedNumber] = React.useState("");
  const [ownerNationalId, setOwnerNationalId] = React.useState("");
  // SEC-016: the deed document is now an UPLOADED file (UploadThing). We track its
  // fileKey + display name; the admin verifier downloads it via an authorized
  // short-lived signed URL, never a raw bearer link.
  const [deedDocKey, setDeedDocKey] = React.useState("");
  const [deedDocName, setDeedDocName] = React.useState("");
  const [deedUploadError, setDeedUploadError] = React.useState<string | null>(null);
  const [rettCertRef, setRettCertRef] = React.useState("");
  const [proofSubmitting, setProofSubmitting] = React.useState(false);
  const [proofError, setProofError] = React.useState<string | null>(null);

  async function loadAll() {
    // allSettled, NOT all (H9): these three independent loads must not short-circuit
    // each other. With Promise.all, a single rejection (e.g. the REGA-auth or listings
    // fetch) blanks the inquiries grid too — which is exactly why the "Convert to Deal"
    // button could fail to render for an OPEN inquiry. Each result is applied on its own.
    const [l, i, r] = await Promise.allSettled([
      listMyMarketplaceListings(),
      listIncomingMarketplaceInquiries(),
      getMyOrgRegaAuthorization(),
    ]);
    if (l.status === "fulfilled") setListings(l.value as unknown as MyListing[]);
    else console.error("[my-listings] listings load failed:", l.reason);
    if (i.status === "fulfilled") setInquiries(i.value as unknown as IncomingInquiry[]);
    else console.error("[my-listings] inquiries load failed:", i.reason);
    if (r.status === "fulfilled") setRega(r.value as unknown as OrgRega);
    else console.error("[my-listings] REGA-auth load failed:", r.reason);
    setLoadingListings(false);
    setLoadingInquiries(false);
    setLoadingRega(false);
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

  // ── Org REGA authorization ─────────────────────────────────────────────────

  function openRegaDialog() {
    setRegaLicense(rega?.regaLicenseNumber ?? "");
    setRegaIsSeller(rega?.isSeller ?? true);
    setRegaIsBuyer(rega?.isBuyer ?? false);
    setRegaError(null);
    setRegaDialogOpen(true);
  }

  async function handleRegaSubmit() {
    setRegaSubmitting(true);
    setRegaError(null);
    try {
      const updated = await submitOrgRegaAuthorization({
        regaLicenseNumber: regaLicense.trim() || undefined,
        isSeller: regaIsSeller,
        isBuyer: regaIsBuyer,
      });
      setRega(updated as unknown as OrgRega);
      setRegaDialogOpen(false);
    } catch (err: unknown) {
      setRegaError(err instanceof Error ? err.message : t("Failed to submit authorization", "فشل إرسال الترخيص"));
    } finally {
      setRegaSubmitting(false);
    }
  }

  // ── Deed-proof submission ──────────────────────────────────────────────────

  function openProofDialog(inq: IncomingInquiry) {
    setProofTarget(inq);
    setDeedNumber("");
    setOwnerNationalId("");
    setDeedDocKey("");
    setDeedDocName("");
    setDeedUploadError(null);
    setRettCertRef("");
    setProofError(null);
  }

  async function handleProofSubmit() {
    if (!proofTarget?.transfer) return;
    setProofSubmitting(true);
    setProofError(null);
    try {
      await submitDeedTransferProof(proofTarget.transfer.id, {
        deedNumber: deedNumber.trim() || undefined,
        ownerNationalId: ownerNationalId.trim() || undefined,
        rettCertRef: rettCertRef.trim() || undefined,
      });
      // Reflect the now-PENDING proof on the matching inquiry.
      setInquiries((prev) =>
        prev.map((i) =>
          i.id === proofTarget.id && i.transfer
            ? { ...i, transfer: { ...i.transfer, deedProof: { status: "PENDING" } } }
            : i,
        ),
      );
      setProofTarget(null);
    } catch (err: unknown) {
      setProofError(err instanceof Error ? err.message : t("Failed to submit deed proof", "فشل إرسال سند الملكية"));
    } finally {
      setProofSubmitting(false);
    }
  }

  // ── Column definitions ────────────────────────────────────────────────────

  const listingColumns = React.useMemo<ColumnDef<MyListing>[]>(
    () => [
      {
        accessorKey: "listingNumber",
        header: lang === "ar" ? "رقم الإعلان" : "Listing #",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.listingNumber}
          </span>
        ),
      },
      {
        accessorKey: "title",
        header: lang === "ar" ? "العنوان" : "Title",
        cell: ({ row }) => (
          <span className="text-sm font-medium text-foreground line-clamp-1">
            {row.original.title ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: lang === "ar" ? "الحالة" : "Status",
        enableSorting: false,
        cell: ({ row }) => (
          <Badge
            variant={LISTING_STATUS_BADGE[row.original.status] ?? "default"}
            size="sm"
          >
            {lang === "ar"
              ? (LISTING_STATUS_LABELS[row.original.status]?.ar ?? row.original.status)
              : (LISTING_STATUS_LABELS[row.original.status]?.en ?? row.original.status)}
          </Badge>
        ),
      },
      {
        accessorKey: "price",
        header: lang === "ar" ? "السعر" : "Price",
        meta: { numeric: true },
        cell: ({ row }) => (
          <span className="text-sm font-semibold text-primary">
            {formatSARLocal(row.original.price, lang)}
          </span>
        ),
      },
      {
        id: "location",
        header: lang === "ar" ? "الموقع" : "Location",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm text-foreground">
            {[row.original.city, row.original.district].filter(Boolean).join("، ") || "—"}
          </span>
        ),
      },
      {
        id: "inquiries",
        accessorFn: (row) => row._count.inquiries,
        header: lang === "ar" ? "الاستفسارات" : "Inquiries",
        meta: { numeric: true },
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 text-sm text-foreground justify-end">
            <Users className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            {row.original._count.inquiries}
          </div>
        ),
      },
      {
        accessorKey: "publishedAt",
        header: lang === "ar" ? "تاريخ النشر" : "Published",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.publishedAt
              ? new Date(row.original.publishedAt).toLocaleDateString(
                  lang === "ar" ? "ar-SA-u-nu-latn" : "en-GB"
                )
              : "—"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <IconButton
              icon={Pencil}
              aria-label={lang === "ar" ? `تعديل ${row.original.listingNumber}` : `Edit ${row.original.listingNumber}`}
              tooltip={lang === "ar" ? "تعديل" : "Edit"}
              variant="ghost"
              size="icon"
              onClick={() => openEdit(row.original)}
              disabled={row.original.status === "SOLD_TRANSFERRED"}
            />
            {(row.original.status === "PUBLISHED" || row.original.status === "DRAFT") && (
              <IconButton
                icon={EyeOff}
                aria-label={lang === "ar" ? `إلغاء نشر ${row.original.listingNumber}` : `Unpublish ${row.original.listingNumber}`}
                tooltip={lang === "ar" ? "إلغاء النشر" : "Unpublish"}
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                onClick={() => openUnpublish(row.original)}
              />
            )}
          </div>
        ),
      },
    ],
    [lang]
  );

  const inquiryColumns = React.useMemo<ColumnDef<IncomingInquiry>[]>(
    () => [
      {
        id: "listing",
        header: lang === "ar" ? "الإعلان" : "Listing",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm font-medium text-foreground">
            {row.original.listing.title ?? row.original.listing.listingNumber}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: lang === "ar" ? "الحالة" : "Status",
        enableSorting: false,
        cell: ({ row }) => (
          <span
            className={[
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
              INQUIRY_STATUS_STYLES[row.original.status] ?? "bg-muted text-muted-foreground",
            ].join(" ")}
          >
            {lang === "ar"
              ? (INQUIRY_STATUS_LABELS[row.original.status]?.ar ?? row.original.status)
              : (INQUIRY_STATUS_LABELS[row.original.status]?.en ?? row.original.status)}
          </span>
        ),
      },
      {
        id: "transfer",
        header: lang === "ar" ? "التحويل" : "Transfer",
        enableSorting: false,
        cell: ({ row }) => {
          const tr = row.original.transfer;
          if (!tr) return <span className="text-xs text-muted-foreground">—</span>;
          const proof = tr.deedProof;
          return (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{tr.status}</span>
              {proof && (
                <Badge variant={DEED_PROOF_STATUS_VARIANT[proof.status] ?? "default"} size="sm">
                  <ScrollText className="h-3 w-3" aria-hidden="true" />
                  {DEED_PROOF_STATUS_LABELS[proof.status]?.[lang] ?? proof.status}
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "message",
        header: lang === "ar" ? "الرسالة" : "Message",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">
            {row.original.message ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: lang === "ar" ? "التاريخ" : "Date",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {new Date(row.original.createdAt).toLocaleDateString(
              lang === "ar" ? "ar-SA-u-nu-latn" : "en-GB"
            )}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const tr = row.original.transfer;
          const proofStatus = tr?.deedProof?.status ?? null;
          const needsProof =
            tr?.status === "PENDING_SETTLEMENT" &&
            (proofStatus === null || proofStatus === "REJECTED");
          return (
            <div className="flex items-center gap-1.5">
              {row.original.status === "OPEN" && (
                <Button variant="primary" size="sm" onClick={() => openConvert(row.original)}>
                  <DirectionalIcon icon={ArrowRight} className="h-3.5 w-3.5 me-1" aria-hidden="true" />
                  {t("Convert to Deal", "تحويل لصفقة")}
                </Button>
              )}
              {needsProof && (
                <Button variant="outline" size="sm" onClick={() => openProofDialog(row.original)}>
                  <ScrollText className="h-3.5 w-3.5 me-1" aria-hidden="true" />
                  {t("Submit deed proof", "تقديم سند الملكية")}
                </Button>
              )}
              {tr?.status === "READY" && (
                <Button variant="primary" size="sm" onClick={() => openSettle(row.original)}>
                  <Handshake className="h-3.5 w-3.5 me-1" aria-hidden="true" />
                  {t("Settle", "تسوية")}
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [lang, t]
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 p-4 md:p-6" dir={lang === "ar" ? "rtl" : "ltr"}>
      <Link
        href="/dashboard/marketplace"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {lang === "ar" ? "→ العودة إلى السوق" : "← Back to marketplace"}
      </Link>
      <PageIntro
        title={lang === "ar" ? "إعلاناتي في السوق" : "My Marketplace Listings"}
        description={
          lang === "ar"
            ? "إدارة إعلاناتك العقارية ومتابعة الاستفسارات الواردة"
            : "Manage your property listings and track incoming inquiries"
        }
      />

      {/* ── Org REGA authorization ────────────────────────────────────────── */}
      <section>
        {loadingRega ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <Card className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div
                  className={`rounded-lg p-2 shrink-0 ${
                    rega?.status === "VERIFIED"
                      ? "bg-success/10"
                      : rega?.status === "REJECTED"
                        ? "bg-destructive/10"
                        : "bg-warning/10"
                  }`}
                >
                  {rega?.status === "VERIFIED" ? (
                    <ShieldCheck className="h-5 w-5 text-success-strong" aria-hidden="true" />
                  ) : rega?.status === "REJECTED" ? (
                    <ShieldAlert className="h-5 w-5 text-destructive" aria-hidden="true" />
                  ) : (
                    <Shield className="h-5 w-5 text-warning-strong" aria-hidden="true" />
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm font-semibold text-foreground">
                      {t("REGA / FAL authorization", "ترخيص الهيئة العامة للعقار (فال)")}
                    </h2>
                    {!rega ? (
                      <Badge variant="default" size="sm">{t("Not submitted", "لم يُقدَّم")}</Badge>
                    ) : rega.status === "VERIFIED" ? (
                      <Badge variant="success" size="sm">
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                        {t("Verified", "موثّق")}
                      </Badge>
                    ) : rega.status === "REJECTED" ? (
                      <Badge variant="error" size="sm">{t("Rejected", "مرفوض")}</Badge>
                    ) : (
                      <Badge variant="warning" size="sm">
                        {t("Self-asserted (pending platform verification)", "إقرار ذاتي (بانتظار توثيق المنصة)")}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed max-w-prose">
                    {t(
                      "Cross-org ownership transfer requires a platform-verified REGA authorization for your organization.",
                      "يتطلب نقل الملكية بين المؤسسات ترخيص هيئة موثّقاً من المنصة لمؤسستك.",
                    )}
                  </p>
                  {rega && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pt-0.5">
                      {rega.regaLicenseNumber && (
                        <span className="font-mono text-foreground" dir="ltr">{rega.regaLicenseNumber}</span>
                      )}
                      {rega.isSeller && <Badge variant="outline" size="sm">{t("Seller", "بائع")}</Badge>}
                      {rega.isBuyer && <Badge variant="outline" size="sm">{t("Buyer", "مشترٍ")}</Badge>}
                    </div>
                  )}
                  {rega?.status === "REJECTED" && rega.rejectedReason && (
                    <p className="text-xs text-destructive">
                      {t("Reason:", "السبب:")} {rega.rejectedReason}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant={rega?.status === "VERIFIED" ? "outline" : "primary"}
                size="sm"
                className="shrink-0 min-h-[44px]"
                onClick={openRegaDialog}
              >
                {!rega
                  ? t("Submit REGA authorization", "تقديم ترخيص الهيئة")
                  : t("Update authorization", "تحديث الترخيص")}
              </Button>
            </div>
          </Card>
        )}
      </section>

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
          <DataTable
            columns={listingColumns}
            data={listings}
            getRowId={(r) => r.id}
            locale={lang === "ar" ? "ar" : "en"}
            pagination
            pageSize={10}
            emptyTitle={lang === "ar" ? "لا توجد إعلانات" : "No listings"}
            emptyDescription={lang === "ar" ? "لا توجد إعلانات تطابق هذه الفلاتر" : "No listings match the current filters"}
            rowClassName={(row) =>
              row.status === "SOLD_TRANSFERRED" ? "opacity-60" : undefined
            }
            mobileCard={(row) => (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {row.title ?? row.listingNumber}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">{row.listingNumber}</p>
                  </div>
                  <Badge
                    variant={LISTING_STATUS_BADGE[row.status] ?? "default"}
                    size="sm"
                    className="shrink-0"
                  >
                    {lang === "ar"
                      ? (LISTING_STATUS_LABELS[row.status]?.ar ?? row.status)
                      : (LISTING_STATUS_LABELS[row.status]?.en ?? row.status)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-primary">
                    {formatSARLocal(row.price, lang)}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" aria-hidden="true" />
                    {row._count.inquiries}
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 min-h-[44px]"
                    onClick={() => openEdit(row)}
                    disabled={row.status === "SOLD_TRANSFERRED"}
                  >
                    <Pencil className="h-3.5 w-3.5 me-1" aria-hidden="true" />
                    {lang === "ar" ? "تعديل" : "Edit"}
                  </Button>
                  {(row.status === "PUBLISHED" || row.status === "DRAFT") && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1 min-h-[44px]"
                      onClick={() => openUnpublish(row)}
                    >
                      <EyeOff className="h-3.5 w-3.5 me-1" aria-hidden="true" />
                      {lang === "ar" ? "إلغاء النشر" : "Unpublish"}
                    </Button>
                  )}
                </div>
              </div>
            )}
          />
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
          <DataTable
            columns={inquiryColumns}
            data={inquiries}
            getRowId={(r) => r.id}
            locale={lang === "ar" ? "ar" : "en"}
            pagination
            pageSize={10}
            emptyTitle={lang === "ar" ? "لا توجد استفسارات" : "No inquiries"}
            emptyDescription={lang === "ar" ? "لا توجد استفسارات تطابق هذه الفلاتر" : "No inquiries match the current filters"}
            mobileCard={(inq) => (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {inq.listing.title ?? inq.listing.listingNumber}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(inq.createdAt).toLocaleDateString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-GB")}
                    </p>
                  </div>
                  <span
                    className={[
                      "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium",
                      INQUIRY_STATUS_STYLES[inq.status] ?? "bg-muted text-muted-foreground",
                    ].join(" ")}
                  >
                    {lang === "ar"
                      ? (INQUIRY_STATUS_LABELS[inq.status]?.ar ?? inq.status)
                      : (INQUIRY_STATUS_LABELS[inq.status]?.en ?? inq.status)}
                  </span>
                </div>
                {inq.message && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{inq.message}</p>
                )}
                {inq.transfer?.deedProof && (
                  <Badge
                    variant={DEED_PROOF_STATUS_VARIANT[inq.transfer.deedProof.status] ?? "default"}
                    size="sm"
                    className="w-fit"
                  >
                    <ScrollText className="h-3 w-3" aria-hidden="true" />
                    {DEED_PROOF_STATUS_LABELS[inq.transfer.deedProof.status]?.[lang] ?? inq.transfer.deedProof.status}
                  </Badge>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  {inq.status === "OPEN" && (
                    <Button
                      variant="primary"
                      size="sm"
                      className="min-h-[44px]"
                      onClick={() => openConvert(inq)}
                    >
                      <DirectionalIcon icon={ArrowRight} className="h-3.5 w-3.5 me-1" aria-hidden="true" />
                      {t("Convert to Deal", "تحويل لصفقة")}
                    </Button>
                  )}
                  {inq.transfer?.status === "PENDING_SETTLEMENT" &&
                    (inq.transfer.deedProof === null || inq.transfer.deedProof.status === "REJECTED") && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-[44px]"
                        onClick={() => openProofDialog(inq)}
                      >
                        <ScrollText className="h-3.5 w-3.5 me-1" aria-hidden="true" />
                        {t("Submit deed proof", "تقديم سند الملكية")}
                      </Button>
                    )}
                  {inq.transfer?.status === "READY" && (
                    <Button
                      variant="primary"
                      size="sm"
                      className="min-h-[44px]"
                      onClick={() => openSettle(inq)}
                    >
                      <Handshake className="h-3.5 w-3.5 me-1" aria-hidden="true" />
                      {t("Settle & Transfer", "تسوية ونقل")}
                    </Button>
                  )}
                </div>
              </div>
            )}
          />
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
              variant="destructive"
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
            ? `هل تريد تسوية ونقل الوحدة للمشتري نهائياً؟ يتطلب ذلك عقد بيع موقّعاً وسند ملكية موثّقاً وترخيص هيئة موثّقاً لكلا المؤسستين وتفعيل نقل الملكية في المنصة. هذه العملية لا يمكن التراجع عنها.`
            : `Confirm settlement and final transfer of the unit to the buyer. This requires a signed sale contract, a verified deed proof, both organizations REGA-verified, and conveyance enabled on the platform. This action cannot be undone.`
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

      {/* ── REGA authorization submit dialog ─────────────────────────────── */}
      <ResponsiveDialog
        open={regaDialogOpen}
        onOpenChange={(open) => { if (!open && !regaSubmitting) setRegaDialogOpen(false); }}
        title={t("REGA / FAL Authorization", "ترخيص الهيئة العامة للعقار (فال)")}
        description={t(
          "Submit your organization's REGA ad-license / FAL number. Platform staff will verify it before you can complete cross-org transfers. Re-submitting resets verification.",
          "قدّم رقم ترخيص الإعلان (فال) لمؤسستك. سيوثّقه فريق المنصة قبل أن تتمكن من إتمام عمليات النقل بين المؤسسات. إعادة التقديم تُلغي التوثيق السابق.",
        )}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRegaDialogOpen(false)} disabled={regaSubmitting}>
              {t("Cancel", "إلغاء")}
            </Button>
            <Button
              variant="primary"
              onClick={handleRegaSubmit}
              disabled={regaSubmitting || (!regaIsSeller && !regaIsBuyer)}
            >
              {regaSubmitting && <Loader2 className="h-4 w-4 animate-spin me-1.5" aria-hidden="true" />}
              {t("Submit", "إرسال")}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-2">
          {regaError && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {regaError}
            </div>
          )}
          <Field
            label={t("REGA ad-license / FAL number", "رقم ترخيص الإعلان (فال)")}
            hint={t("As issued by the Real Estate General Authority.", "كما هو صادر عن الهيئة العامة للعقار.")}
          >
            {(field) => (
              <Input
                {...field}
                value={regaLicense}
                onChange={(e) => setRegaLicense(e.target.value)}
                placeholder={t("e.g. 1100xxxxxx", "مثال: 1100xxxxxx")}
                dir="ltr"
              />
            )}
          </Field>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">
              {t("Authorized to act as", "مخوّل للتصرف كـ")}
            </legend>
            <label htmlFor="mylist-rega-seller" className="flex items-center gap-2 text-sm text-foreground min-h-[44px]">
              <input
                id="mylist-rega-seller"
                type="checkbox"
                checked={regaIsSeller}
                onChange={(e) => setRegaIsSeller(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              {t("Seller (list & transfer out units)", "بائع (عرض ونقل الوحدات)")}
            </label>
            <label htmlFor="mylist-rega-buyer" className="flex items-center gap-2 text-sm text-foreground min-h-[44px]">
              <input
                id="mylist-rega-buyer"
                type="checkbox"
                checked={regaIsBuyer}
                onChange={(e) => setRegaIsBuyer(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              {t("Buyer (receive transferred units)", "مشترٍ (استلام الوحدات المنقولة)")}
            </label>
            {!regaIsSeller && !regaIsBuyer && (
              <p className="text-xs text-destructive">
                {t("Select at least one role.", "اختر دوراً واحداً على الأقل.")}
              </p>
            )}
          </fieldset>
        </div>
      </ResponsiveDialog>

      {/* ── Deed-proof submission dialog ─────────────────────────────────── */}
      <ResponsiveDialog
        open={!!proofTarget}
        onOpenChange={(open) => { if (!open && !proofSubmitting) setProofTarget(null); }}
        title={t("Submit Deed-Transfer Proof", "تقديم سند نقل الملكية")}
        description={t(
          "Provide the deed details for this transfer. The deed number and owner national-ID are encrypted at rest and reviewed by platform staff before the transfer becomes ready.",
          "أدخل بيانات الصك لهذا التحويل. يُشفَّر رقم الصك وهوية المالك عند التخزين ويراجعهما فريق المنصة قبل أن يصبح التحويل جاهزاً.",
        )}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setProofTarget(null)} disabled={proofSubmitting}>
              {t("Cancel", "إلغاء")}
            </Button>
            <Button
              variant="primary"
              onClick={handleProofSubmit}
              disabled={proofSubmitting || !deedNumber.trim() || !ownerNationalId.trim()}
            >
              {proofSubmitting && <Loader2 className="h-4 w-4 animate-spin me-1.5" aria-hidden="true" />}
              {t("Submit proof", "إرسال السند")}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-2">
          {proofError && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {proofError}
            </div>
          )}
          <Field label={t("Deed number", "رقم الصك")} required>
            {(field) => (
              <Input
                {...field}
                value={deedNumber}
                onChange={(e) => setDeedNumber(e.target.value)}
                placeholder={t("Deed number…", "رقم الصك…")}
                dir="ltr"
              />
            )}
          </Field>
          <Field label={t("Owner national ID", "هوية المالك")} required>
            {(field) => (
              <Input
                {...field}
                value={ownerNationalId}
                onChange={(e) => setOwnerNationalId(e.target.value)}
                placeholder={t("10 digits", "10 أرقام")}
                inputMode="numeric"
                dir="ltr"
              />
            )}
          </Field>
          <Field
            label={t("Deed document (optional)", "وثيقة الصك (اختياري)")}
            hint={t(
              "Upload the deed file (PDF or image, up to 8MB). Only platform staff can download it via a secure, expiring link.",
              "ارفع ملف الصك (PDF أو صورة، حتى 8 ميجابايت). يمكن لفريق المنصة فقط تنزيله عبر رابط آمن ينتهي بعد فترة قصيرة.",
            )}
          >
            {() =>
              deedDocKey ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-secondary/10 px-3 py-2">
                  <span className="flex items-center gap-2 text-sm text-foreground min-w-0">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-secondary" aria-hidden="true" />
                    <span className="truncate" dir="ltr">
                      {deedDocName || t("File uploaded", "تم رفع الملف")}
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDeedDocKey("");
                      setDeedDocName("");
                      setDeedUploadError(null);
                    }}
                  >
                    {t("Replace", "استبدال")}
                  </Button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <UploadDropzone
                    endpoint="deedProofUploader"
                    input={{ transferId: proofTarget?.transfer?.id ?? "" }}
                    onClientUploadComplete={(res) => {
                      // The key is written server-side (bound to the verified-owned
                      // transfer) in onUploadComplete; this only drives the "uploaded" UI.
                      const fileKey = res?.[0]?.serverData?.fileKey ?? "";
                      setDeedDocKey(fileKey);
                      setDeedDocName(res?.[0]?.name ?? "");
                      setDeedUploadError(fileKey ? null : t("Upload failed — please try again.", "فشل الرفع — حاول مرة أخرى."));
                    }}
                    onUploadError={(err) =>
                      setDeedUploadError(
                        err?.message || t("Upload failed — please try again.", "فشل الرفع — حاول مرة أخرى."),
                      )
                    }
                    appearance={{
                      container: "border-border",
                      button: "bg-primary text-primary-foreground text-xs px-3 py-1.5 rounded-md font-medium",
                      label: "text-sm text-foreground",
                      allowedContent: "text-xs text-muted-foreground",
                    }}
                  />
                  {deedUploadError && (
                    <p className="flex items-center gap-1.5 text-xs text-destructive">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {deedUploadError}
                    </p>
                  )}
                </div>
              )
            }
          </Field>
          <Field label={t("RETT certificate reference (optional)", "مرجع شهادة ضريبة التصرفات (اختياري)")}>
            {(field) => (
              <Input
                {...field}
                value={rettCertRef}
                onChange={(e) => setRettCertRef(e.target.value)}
                placeholder={t("ZATCA RETT reference…", "مرجع ضريبة التصرفات…")}
                dir="ltr"
              />
            )}
          </Field>
        </div>
      </ResponsiveDialog>
    </div>
  );
}
