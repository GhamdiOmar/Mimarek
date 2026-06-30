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
  Check,
  X,
  FileText,
  ScrollText,
  Gavel,
  Lock,
  Download,
  ExternalLink,
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
  Switch,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Field,
} from "@repo/ui";
import { PageHeader } from "@repo/ui/components/PageHeader";
import { DirectionalIcon } from "@repo/ui";
import { cn } from "@repo/ui/lib/utils";
import { useLanguage } from "../../../../components/LanguageProvider";
import { usePermissions } from "../../../../hooks/usePermissions";
import { sanitizeError } from "../../../../lib/error-sanitizer";
import {
  listListingsForModeration,
  moderateSuspendListing,
  moderateApproveListing,
  moderateRejectListing,
  listOrgRegaAuthorizations,
  verifyOrgRegaAuthorization,
  listPendingDeedProofs,
  getDeedProofForTransfer,
  verifyDeedTransferProof,
  getMarketplaceConveyanceConfig,
  setMarketplaceConveyanceEnabled,
} from "../../../actions/marketplace";
import Link from "next/link";
import {
  MARKETPLACE_LISTING_STATUS_LABEL as STATUS_LABELS,
  MARKETPLACE_LISTING_STATUS_VARIANT as STATUS_VARIANT,
} from "../../../../lib/domain-labels";

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

type RegaAuth = {
  id: string;
  organizationId: string;
  regaLicenseNumber: string | null;
  status: string;
  isSeller: boolean;
  isBuyer: boolean;
  verifiedAt: string | null;
  rejectedReason: string | null;
  updatedAt: string;
  organization: { id: string; name: string; nameEnglish: string | null };
};

type OrgRef = { id: string; name: string; nameEnglish: string | null };

type DeedProofQueueRow = {
  id: string;
  transferId: string;
  status: string;
  deedDocUrl: string | null;
  rettCertRef: string | null;
  submittedAt: string;
  transfer: {
    id: string;
    status: string;
    sellerOrg: OrgRef;
    buyerOrg: OrgRef;
    listing: { id: string; listingNumber: string; title: string | null };
  };
};

type DeedProofDetail = {
  id: string;
  transferId: string;
  status: string;
  deedNumber: string | null;
  ownerNationalId: string | null;
  /** SEC-016: when present, the deed is an uploaded file — download via the authorized signed-URL route. */
  deedDocKey: string | null;
  deedDocUrl: string | null;
  deedDocHash: string | null;
  rettCertRef: string | null;
  submittedAt: string | null;
};

type ConveyanceConfig = {
  marketplaceConveyanceEnabled: boolean;
  marketplaceLegalSignoffBy: string | null;
  marketplaceLegalSignoffAt: string | null;
  marketplaceLegalSignoffNote: string | null;
  regaPlatformFalLicense: string | null;
};

// ─── Config maps ───────────────────────────────────────────────────────────────

const COMPLIANCE_VARIANT: Record<string, "success" | "warning" | "error"> = {
  APPROVED: "success",
  PENDING_REVIEW: "warning",
  REJECTED: "error",
};

const REGA_STATUS_LABEL: Record<string, { ar: string; en: string }> = {
  SELF_ASSERTED: { ar: "إقرار ذاتي", en: "Self-asserted" },
  VERIFIED: { ar: "موثّق", en: "Verified" },
  REJECTED: { ar: "مرفوض", en: "Rejected" },
};

const REGA_STATUS_VARIANT: Record<
  string,
  React.ComponentProps<typeof Badge>["variant"]
> = {
  SELF_ASSERTED: "warning",
  VERIFIED: "success",
  REJECTED: "error",
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AdminMarketplacePage() {
  const { lang } = useLanguage();
  const { role } = usePermissions();
  const isSystemAdmin = role === "SYSTEM_ADMIN";
  // NOTE — local English-first facade: this file's `t(en, ar)` is the REVERSE of the
  // canonical `useLanguage().t(ar, en)`. All call sites below are written English-first
  // to match. Do NOT swap to `useLanguage().t` or run the F1 `t(ar,en)` codemod over this
  // file without swapping every call site, or every label flips language silently. Kept
  // English-first deliberately (self-consistent, zero-risk).
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);

  const [tab, setTab] = React.useState("listings");

  // ── Listings state ──────────────────────────────────────────────────────
  const [listings, setListings] = React.useState<ModerationListing[]>([]);
  const [loadingListings, setLoadingListings] = React.useState(true);

  // ── REGA authorizations state ───────────────────────────────────────────
  const [regaAuths, setRegaAuths] = React.useState<RegaAuth[]>([]);
  const [loadingRega, setLoadingRega] = React.useState(true);

  // ── Deed proofs queue state ─────────────────────────────────────────────
  const [deedProofs, setDeedProofs] = React.useState<DeedProofQueueRow[]>([]);
  const [loadingProofs, setLoadingProofs] = React.useState(true);

  // ── Conveyance config state ─────────────────────────────────────────────
  const [conveyance, setConveyance] = React.useState<ConveyanceConfig | null>(null);
  const [loadingConveyance, setLoadingConveyance] = React.useState(true);

  // ── Listing moderation dialogs ──────────────────────────────────────────
  const [suspendTarget, setSuspendTarget] = React.useState<ModerationListing | null>(null);
  const [suspendReason, setSuspendReason] = React.useState("");
  const [suspending, setSuspending] = React.useState(false);
  const [suspendError, setSuspendError] = React.useState<string | null>(null);

  const [approveTarget, setApproveTarget] = React.useState<ModerationListing | null>(null);
  const [approving, setApproving] = React.useState(false);
  const [approveError, setApproveError] = React.useState<string | null>(null);

  const [rejectTarget, setRejectTarget] = React.useState<ModerationListing | null>(null);
  const [rejectReason, setRejectReason] = React.useState("");
  const [rejecting, setRejecting] = React.useState(false);
  const [rejectError, setRejectError] = React.useState<string | null>(null);

  // ── REGA verify/reject dialog ───────────────────────────────────────────
  const [regaTarget, setRegaTarget] = React.useState<RegaAuth | null>(null);
  const [regaApprove, setRegaApprove] = React.useState(true);
  const [regaReason, setRegaReason] = React.useState("");
  const [regaSubmitting, setRegaSubmitting] = React.useState(false);
  const [regaError, setRegaError] = React.useState<string | null>(null);

  // ── Deed proof review dialog ────────────────────────────────────────────
  const [proofTarget, setProofTarget] = React.useState<DeedProofQueueRow | null>(null);
  const [proofDetail, setProofDetail] = React.useState<DeedProofDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [proofReason, setProofReason] = React.useState("");
  const [proofSubmitting, setProofSubmitting] = React.useState(false);
  const [proofError, setProofError] = React.useState<string | null>(null);

  // ── Conveyance toggle dialog ────────────────────────────────────────────
  const [conveyanceDialogOpen, setConveyanceDialogOpen] = React.useState(false);
  const [conveyancePendingEnabled, setConveyancePendingEnabled] = React.useState(false);
  const [conveyanceNote, setConveyanceNote] = React.useState("");
  const [conveyanceSubmitting, setConveyanceSubmitting] = React.useState(false);
  const [conveyanceError, setConveyanceError] = React.useState<string | null>(null);

  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; message: string } | null>(null);

  // ── Loaders ─────────────────────────────────────────────────────────────

  async function loadListings() {
    setLoadingListings(true);
    try {
      const data = await listListingsForModeration();
      setListings(data as unknown as ModerationListing[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingListings(false);
    }
  }

  async function loadRega() {
    setLoadingRega(true);
    try {
      const data = await listOrgRegaAuthorizations();
      setRegaAuths(data as unknown as RegaAuth[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRega(false);
    }
  }

  async function loadProofs() {
    setLoadingProofs(true);
    try {
      const data = await listPendingDeedProofs();
      setDeedProofs(data as unknown as DeedProofQueueRow[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingProofs(false);
    }
  }

  async function loadConveyance() {
    setLoadingConveyance(true);
    try {
      const data = await getMarketplaceConveyanceConfig();
      setConveyance(data as unknown as ConveyanceConfig | null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingConveyance(false);
    }
  }

  React.useEffect(() => {
    loadListings();
    loadRega();
    loadProofs();
    loadConveyance();
  }, []);

  React.useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);

  // ── Listing moderation handlers ─────────────────────────────────────────

  async function handleSuspend() {
    if (!suspendTarget || !suspendReason.trim()) return;
    setSuspending(true);
    setSuspendError(null);
    try {
      await moderateSuspendListing(suspendTarget.id, suspendReason.trim());
      setListings((prev) =>
        prev.map((l) => (l.id === suspendTarget.id ? { ...l, status: "SUSPENDED" } : l)),
      );
      setFeedback({ type: "success", message: t(`Listing ${suspendTarget.listingNumber} suspended.`, `تم تعليق الإعلان ${suspendTarget.listingNumber}.`) });
      setSuspendTarget(null);
      setSuspendReason("");
    } catch (err: unknown) {
      setSuspendError(sanitizeError(err, lang));
    } finally {
      setSuspending(false);
    }
  }

  async function handleApprove() {
    if (!approveTarget) return;
    setApproving(true);
    setApproveError(null);
    try {
      await moderateApproveListing(approveTarget.id);
      setListings((prev) =>
        prev.map((l) =>
          l.id === approveTarget.id
            ? { ...l, status: "PUBLISHED", complianceStatus: "APPROVED" }
            : l,
        ),
      );
      setFeedback({ type: "success", message: t(`Listing ${approveTarget.listingNumber} approved and published.`, `تم اعتماد الإعلان ${approveTarget.listingNumber} ونشره.`) });
      setApproveTarget(null);
    } catch (err: unknown) {
      setApproveError(sanitizeError(err, lang));
    } finally {
      setApproving(false);
    }
  }

  async function handleReject() {
    if (!rejectTarget || !rejectReason.trim()) return;
    setRejecting(true);
    setRejectError(null);
    try {
      await moderateRejectListing(rejectTarget.id, rejectReason.trim());
      setListings((prev) =>
        prev.map((l) =>
          l.id === rejectTarget.id
            ? { ...l, status: "REJECTED", complianceStatus: "REJECTED" }
            : l,
        ),
      );
      setFeedback({ type: "success", message: t(`Listing ${rejectTarget.listingNumber} rejected.`, `تم رفض الإعلان ${rejectTarget.listingNumber}.`) });
      setRejectTarget(null);
      setRejectReason("");
    } catch (err: unknown) {
      setRejectError(sanitizeError(err, lang));
    } finally {
      setRejecting(false);
    }
  }

  // ── REGA verify handler ─────────────────────────────────────────────────

  function openRega(auth: RegaAuth, approve: boolean) {
    setRegaTarget(auth);
    setRegaApprove(approve);
    setRegaReason("");
    setRegaError(null);
  }

  async function handleRega() {
    if (!regaTarget) return;
    if (!regaApprove && !regaReason.trim()) return;
    setRegaSubmitting(true);
    setRegaError(null);
    try {
      await verifyOrgRegaAuthorization(regaTarget.organizationId, {
        approve: regaApprove,
        reason: regaApprove ? undefined : regaReason.trim(),
      });
      setRegaAuths((prev) =>
        prev.map((a) =>
          a.id === regaTarget.id
            ? {
                ...a,
                status: regaApprove ? "VERIFIED" : "REJECTED",
                rejectedReason: regaApprove ? null : regaReason.trim(),
              }
            : a,
        ),
      );
      setFeedback({
        type: "success",
        message: regaApprove
          ? t("REGA authorization verified.", "تم توثيق ترخيص الهيئة.")
          : t("REGA authorization rejected.", "تم رفض ترخيص الهيئة."),
      });
      setRegaTarget(null);
    } catch (err: unknown) {
      setRegaError(sanitizeError(err, lang));
    } finally {
      setRegaSubmitting(false);
    }
  }

  // ── Deed proof review handlers ──────────────────────────────────────────

  async function openProof(row: DeedProofQueueRow) {
    setProofTarget(row);
    setProofDetail(null);
    setProofReason("");
    setProofError(null);
    setLoadingDetail(true);
    try {
      const detail = await getDeedProofForTransfer(row.transferId);
      setProofDetail(detail as unknown as DeedProofDetail | null);
    } catch (err: unknown) {
      setProofError(sanitizeError(err, lang));
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleProof(approve: boolean) {
    if (!proofTarget) return;
    if (!approve && !proofReason.trim()) {
      setProofError(t("A rejection reason is required.", "سبب الرفض مطلوب."));
      return;
    }
    setProofSubmitting(true);
    setProofError(null);
    try {
      await verifyDeedTransferProof(proofTarget.transferId, {
        approve,
        reason: approve ? undefined : proofReason.trim(),
      });
      // Verified/rejected proofs leave the PENDING queue.
      setDeedProofs((prev) => prev.filter((p) => p.id !== proofTarget.id));
      setFeedback({
        type: "success",
        message: approve
          ? t("Deed proof verified — transfer is now ready.", "تم توثيق سند الملكية — التحويل جاهز الآن.")
          : t("Deed proof rejected.", "تم رفض سند الملكية."),
      });
      setProofTarget(null);
    } catch (err: unknown) {
      setProofError(sanitizeError(err, lang));
    } finally {
      setProofSubmitting(false);
    }
  }

  // ── Conveyance toggle handlers ──────────────────────────────────────────

  function openConveyanceToggle(nextEnabled: boolean) {
    setConveyancePendingEnabled(nextEnabled);
    setConveyanceNote("");
    setConveyanceError(null);
    setConveyanceDialogOpen(true);
  }

  async function handleConveyanceToggle() {
    if (!conveyanceNote.trim()) {
      setConveyanceError(t("A legal sign-off note is required.", "ملاحظة الاعتماد القانوني مطلوبة."));
      return;
    }
    setConveyanceSubmitting(true);
    setConveyanceError(null);
    try {
      const updated = await setMarketplaceConveyanceEnabled({
        enabled: conveyancePendingEnabled,
        note: conveyanceNote.trim(),
      });
      setConveyance((prev) =>
        prev ? { ...prev, ...(updated as unknown as Partial<ConveyanceConfig>) } : prev,
      );
      setFeedback({
        type: "success",
        message: conveyancePendingEnabled
          ? t("Cross-org conveyance ENABLED.", "تم تفعيل نقل الملكية بين المؤسسات.")
          : t("Cross-org conveyance DISABLED.", "تم تعطيل نقل الملكية بين المؤسسات."),
      });
      setConveyanceDialogOpen(false);
    } catch (err: unknown) {
      setConveyanceError(sanitizeError(err, lang));
    } finally {
      setConveyanceSubmitting(false);
    }
  }

  // ── Listings columns ────────────────────────────────────────────────────

  const listingColumns: ColumnDef<ModerationListing>[] = [
    {
      accessorKey: "listingNumber",
      header: t("Listing #", "رقم القائمة"),
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
      header: t("Title", "العنوان"),
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
      header: t("Seller Org", "المنظمة البائعة"),
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">
            {row.original.sellerOrg.nameEnglish ?? row.original.sellerOrg.name}
          </span>
          {row.original.sellerOrg.nameEnglish && (
            <span className="text-xs text-muted-foreground">{row.original.sellerOrg.name}</span>
          )}
        </div>
      ),
      enableSorting: false,
      enableHiding: true,
    },
    {
      accessorKey: "status",
      header: t("Status", "الحالة"),
      cell: ({ row }) => (
        <Badge variant={STATUS_VARIANT[row.original.status] ?? "default"} size="sm">
          {STATUS_LABELS[row.original.status]?.[lang] ?? row.original.status}
        </Badge>
      ),
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: "complianceStatus",
      header: t("Compliance", "الامتثال"),
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
      header: t("Inquiries", "الاستفسارات"),
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
      id: "actions",
      header: "",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const listing = row.original;
        if (listing.status === "PENDING_REVIEW") {
          return (
            <div className="flex items-center justify-end gap-1.5">
              <Button variant="primary" size="sm" onClick={() => setApproveTarget(listing)}>
                <Check className="h-3.5 w-3.5 me-1" aria-hidden="true" />
                {t("Approve", "اعتماد")}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setRejectTarget(listing);
                  setRejectReason("");
                  setRejectError(null);
                }}
              >
                <X className="h-3.5 w-3.5 me-1" aria-hidden="true" />
                {t("Reject", "رفض")}
              </Button>
            </div>
          );
        }
        if (listing.status === "PUBLISHED") {
          return (
            <div className="flex items-center justify-end gap-1">
              <IconButton
                icon={Ban}
                aria-label={t("Suspend", "إيقاف")}
                onClick={() => {
                  setSuspendTarget(listing);
                  setSuspendReason("");
                  setSuspendError(null);
                }}
                className="text-destructive hover:text-destructive"
                variant="ghost"
              />
            </div>
          );
        }
        if (listing.status === "SUSPENDED") {
          return (
            <span className="text-xs text-muted-foreground italic">
              {t("Suspended", "موقوف")}
            </span>
          );
        }
        return null;
      },
    },
  ];

  function listingMobileCard(listing: ModerationListing) {
    return (
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-sm font-medium text-foreground line-clamp-1">
              {listing.title ?? "—"}
            </span>
            <span className="font-mono text-xs text-muted-foreground">{listing.listingNumber}</span>
          </div>
          <Badge variant={STATUS_VARIANT[listing.status] ?? "default"} size="sm" className="shrink-0">
            {STATUS_LABELS[listing.status]?.[lang] ?? listing.status}
          </Badge>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{listing.sellerOrg.nameEnglish ?? listing.sellerOrg.name}</span>
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3" aria-hidden="true" />
            {listing._count.inquiries}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {listing.status === "PENDING_REVIEW" && (
            <>
              <Button variant="primary" size="sm" className="flex-1 min-h-[44px]" onClick={() => setApproveTarget(listing)}>
                <Check className="h-3.5 w-3.5 me-1" aria-hidden="true" />
                {t("Approve", "اعتماد")}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="flex-1 min-h-[44px]"
                onClick={() => {
                  setRejectTarget(listing);
                  setRejectReason("");
                  setRejectError(null);
                }}
              >
                <X className="h-3.5 w-3.5 me-1" aria-hidden="true" />
                {t("Reject", "رفض")}
              </Button>
            </>
          )}
          {listing.status === "PUBLISHED" && (
            <Button
              variant="destructive"
              size="sm"
              className="flex-1 min-h-[44px]"
              onClick={() => {
                setSuspendTarget(listing);
                setSuspendReason("");
                setSuspendError(null);
              }}
            >
              <Ban className="h-3.5 w-3.5 me-1" aria-hidden="true" />
              {t("Suspend", "إيقاف")}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── REGA columns ────────────────────────────────────────────────────────

  const regaColumns: ColumnDef<RegaAuth>[] = [
    {
      id: "org",
      header: t("Organization", "المؤسسة"),
      cell: ({ row }) => (
        <span className="text-sm font-medium text-foreground">
          {row.original.organization.nameEnglish ?? row.original.organization.name}
        </span>
      ),
      enableSorting: false,
    },
    {
      accessorKey: "regaLicenseNumber",
      header: t("License #", "رقم الترخيص"),
      cell: ({ row }) => (
        <span className="font-mono text-xs text-foreground">
          {row.original.regaLicenseNumber ?? "—"}
        </span>
      ),
      enableSorting: false,
    },
    {
      id: "roles",
      header: t("Role", "الدور"),
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.isSeller && (
            <Badge variant="outline" size="sm">{t("Seller", "بائع")}</Badge>
          )}
          {row.original.isBuyer && (
            <Badge variant="outline" size="sm">{t("Buyer", "مشترٍ")}</Badge>
          )}
          {!row.original.isSeller && !row.original.isBuyer && (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
      ),
      enableSorting: false,
    },
    {
      accessorKey: "status",
      header: t("Status", "الحالة"),
      cell: ({ row }) => (
        <Badge variant={REGA_STATUS_VARIANT[row.original.status] ?? "default"} size="sm">
          {REGA_STATUS_LABEL[row.original.status]?.[lang] ?? row.original.status}
        </Badge>
      ),
      enableSorting: true,
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) =>
        row.original.status === "SELF_ASSERTED" ? (
          <div className="flex items-center justify-end gap-1.5">
            <Button variant="primary" size="sm" onClick={() => openRega(row.original, true)}>
              <Check className="h-3.5 w-3.5 me-1" aria-hidden="true" />
              {t("Verify", "توثيق")}
            </Button>
            <Button variant="destructive" size="sm" onClick={() => openRega(row.original, false)}>
              <X className="h-3.5 w-3.5 me-1" aria-hidden="true" />
              {t("Reject", "رفض")}
            </Button>
          </div>
        ) : null,
    },
  ];

  function regaMobileCard(auth: RegaAuth) {
    return (
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium text-foreground">
            {auth.organization.nameEnglish ?? auth.organization.name}
          </span>
          <Badge variant={REGA_STATUS_VARIANT[auth.status] ?? "default"} size="sm" className="shrink-0">
            {REGA_STATUS_LABEL[auth.status]?.[lang] ?? auth.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">{auth.regaLicenseNumber ?? "—"}</span>
          <div className="flex gap-1">
            {auth.isSeller && <Badge variant="outline" size="sm">{t("Seller", "بائع")}</Badge>}
            {auth.isBuyer && <Badge variant="outline" size="sm">{t("Buyer", "مشترٍ")}</Badge>}
          </div>
        </div>
        {auth.status === "SELF_ASSERTED" && (
          <div className="flex gap-2 pt-1">
            <Button variant="primary" size="sm" className="flex-1 min-h-[44px]" onClick={() => openRega(auth, true)}>
              <Check className="h-3.5 w-3.5 me-1" aria-hidden="true" />
              {t("Verify", "توثيق")}
            </Button>
            <Button variant="destructive" size="sm" className="flex-1 min-h-[44px]" onClick={() => openRega(auth, false)}>
              <X className="h-3.5 w-3.5 me-1" aria-hidden="true" />
              {t("Reject", "رفض")}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ── Deed proof columns ──────────────────────────────────────────────────

  const proofColumns: ColumnDef<DeedProofQueueRow>[] = [
    {
      id: "listing",
      header: t("Listing", "الإعلان"),
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground line-clamp-1">
            {row.original.transfer.listing.title ?? row.original.transfer.listing.listingNumber}
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.transfer.listing.listingNumber}
          </span>
        </div>
      ),
      enableSorting: false,
    },
    {
      id: "seller",
      header: t("Seller", "البائع"),
      cell: ({ row }) => (
        <span className="text-sm text-foreground">
          {row.original.transfer.sellerOrg.nameEnglish ?? row.original.transfer.sellerOrg.name}
        </span>
      ),
      enableSorting: false,
    },
    {
      id: "buyer",
      header: t("Buyer", "المشتري"),
      cell: ({ row }) => (
        <span className="text-sm text-foreground">
          {row.original.transfer.buyerOrg.nameEnglish ?? row.original.transfer.buyerOrg.name}
        </span>
      ),
      enableSorting: false,
    },
    {
      accessorKey: "submittedAt",
      header: t("Submitted", "تاريخ التقديم"),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {new Date(row.original.submittedAt).toLocaleDateString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-GB")}
        </span>
      ),
      enableSorting: true,
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="primary" size="sm" onClick={() => openProof(row.original)}>
            <ScrollText className="h-3.5 w-3.5 me-1" aria-hidden="true" />
            {t("Review", "مراجعة")}
          </Button>
        </div>
      ),
    },
  ];

  function proofMobileCard(row: DeedProofQueueRow) {
    return (
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-sm font-medium text-foreground line-clamp-1">
              {row.transfer.listing.title ?? row.transfer.listing.listingNumber}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {row.transfer.listing.listingNumber}
            </span>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {new Date(row.submittedAt).toLocaleDateString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-GB")}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{row.transfer.sellerOrg.nameEnglish ?? row.transfer.sellerOrg.name}</span>
          <DirectionalIcon icon={ArrowLeft} className="h-3 w-3" aria-hidden="true" />
          <span>{row.transfer.buyerOrg.nameEnglish ?? row.transfer.buyerOrg.name}</span>
        </div>
        <Button variant="primary" size="sm" className="min-h-[44px]" onClick={() => openProof(row)}>
          <ScrollText className="h-3.5 w-3.5 me-1" aria-hidden="true" />
          {t("Review deed proof", "مراجعة سند الملكية")}
        </Button>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6" dir={lang === "ar" ? "rtl" : "ltr"}>
      <div>
        <Link
          href="/dashboard/admin"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4 transition-colors"
        >
          <DirectionalIcon icon={ArrowLeft} className="w-4 h-4" />
          {t("Back to Admin", "العودة إلى لوحة الإدارة")}
        </Link>
      </div>

      <PageHeader
        title={t("Marketplace Moderation", "إدارة السوق")}
        description={t(
          "Review listings, verify REGA authorizations and deed proofs, and control cross-org conveyance",
          "مراجعة الإعلانات وتوثيق تراخيص الهيئة وسندات الملكية والتحكم في نقل الملكية بين المؤسسات",
        )}
      />

      {feedback && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium border",
            feedback.type === "success"
              ? "bg-success/10 text-success-strong border-success/30"
              : "bg-destructive/10 text-destructive border-destructive/30",
          )}
          role="status"
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          )}
          {feedback.message}
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="listings" className="gap-1.5">
            <Store className="h-4 w-4" aria-hidden="true" />
            {t("Listings", "الإعلانات")}
          </TabsTrigger>
          <TabsTrigger value="rega" className="gap-1.5">
            <Shield className="h-4 w-4" aria-hidden="true" />
            {t("REGA Authorizations", "تراخيص الهيئة")}
          </TabsTrigger>
          <TabsTrigger value="deeds" className="gap-1.5">
            <ScrollText className="h-4 w-4" aria-hidden="true" />
            {t("Deed Proofs", "سندات الملكية")}
          </TabsTrigger>
          <TabsTrigger value="conveyance" className="gap-1.5">
            <Gavel className="h-4 w-4" aria-hidden="true" />
            {t("Conveyance", "نقل الملكية")}
          </TabsTrigger>
        </TabsList>

        {/* ── Listings tab ───────────────────────────────────────────────── */}
        <TabsContent value="listings" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={loadListings}>
              {t("Refresh", "تحديث")}
            </Button>
          </div>
          {loadingListings ? (
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
              title={t("No listings to moderate", "لا توجد إعلانات للمراجعة")}
              description={t(
                "No marketplace listings exist yet across any tenant organizations.",
                "لا توجد إعلانات في السوق عبر أي مؤسسة حتى الآن.",
              )}
            />
          ) : (
            <Card className="overflow-hidden">
              <DataTable
                columns={listingColumns}
                data={listings}
                mobileCard={listingMobileCard}
                rowClassName={(l) => (l.status === "SUSPENDED" ? "opacity-60" : undefined)}
                locale={lang === "ar" ? "ar" : "en"}
                pagination
                pageSize={10}
                getRowId={(r) => r.id}
                emptyTitle={t("No listings", "لا توجد قوائم")}
                emptyDescription={t("No marketplace listings to review.", "لا توجد قوائم سوق للمراجعة.")}
              />
            </Card>
          )}
        </TabsContent>

        {/* ── REGA authorizations tab ────────────────────────────────────── */}
        <TabsContent value="rega" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={loadRega}>
              {t("Refresh", "تحديث")}
            </Button>
          </div>
          {loadingRega ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : regaAuths.length === 0 ? (
            <EmptyState
              variant="default"
              icon={<Shield className="h-12 w-12" aria-hidden="true" />}
              title={t("No REGA authorizations", "لا توجد تراخيص هيئة")}
              description={t(
                "No organization has submitted a REGA/FAL authorization yet.",
                "لم تقدّم أي مؤسسة ترخيص الهيئة العامة للعقار بعد.",
              )}
            />
          ) : (
            <Card className="overflow-hidden">
              <DataTable
                columns={regaColumns}
                data={regaAuths}
                mobileCard={regaMobileCard}
                locale={lang === "ar" ? "ar" : "en"}
                pagination
                pageSize={10}
                getRowId={(r) => r.id}
                emptyTitle={t("No authorizations", "لا توجد تراخيص")}
                emptyDescription={t("No REGA authorizations on file.", "لا توجد تراخيص هيئة مسجّلة.")}
              />
            </Card>
          )}
        </TabsContent>

        {/* ── Deed proofs tab ────────────────────────────────────────────── */}
        <TabsContent value="deeds" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={loadProofs}>
              {t("Refresh", "تحديث")}
            </Button>
          </div>
          {loadingProofs ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : deedProofs.length === 0 ? (
            <EmptyState
              variant="default"
              icon={<ScrollText className="h-12 w-12" aria-hidden="true" />}
              title={t("No deed proofs awaiting review", "لا توجد سندات بانتظار المراجعة")}
              description={t(
                "Deed-transfer proofs submitted by sellers will appear here for verification.",
                "ستظهر سندات نقل الملكية المقدّمة من البائعين هنا للتوثيق.",
              )}
            />
          ) : (
            <Card className="overflow-hidden">
              <DataTable
                columns={proofColumns}
                data={deedProofs}
                mobileCard={proofMobileCard}
                locale={lang === "ar" ? "ar" : "en"}
                pagination
                pageSize={10}
                getRowId={(r) => r.id}
                emptyTitle={t("No deed proofs", "لا توجد سندات")}
                emptyDescription={t("No pending deed proofs.", "لا توجد سندات معلّقة.")}
              />
            </Card>
          )}
        </TabsContent>

        {/* ── Conveyance legal-gate tab ──────────────────────────────────── */}
        <TabsContent value="conveyance" className="space-y-4">
          {loadingConveyance ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <Card className="p-5 space-y-5 border-destructive/30">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-destructive/10 p-2 shrink-0">
                  <Gavel className="h-5 w-5 text-destructive" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-base font-semibold text-foreground">
                    {t("Cross-Org Conveyance Kill-Switch", "مفتاح نقل الملكية بين المؤسسات")}
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t(
                      "When enabled, sellers can complete the legal transfer of unit ownership to a buyer organization on this platform. This is a legal action gated by REGA platform-FAL licensing, PDPL DPIA, and legal sign-off. Keep it OFF until all conditions are met.",
                      "عند التفعيل، يصبح بإمكان البائعين إتمام نقل ملكية الوحدة قانونياً إلى مؤسسة المشتري عبر المنصة. هذا إجراء قانوني مشروط بترخيص الهيئة العامة للعقار وتقييم أثر حماية البيانات والاعتماد القانوني. أبقِه معطّلاً حتى استيفاء كل الشروط.",
                    )}
                  </p>
                </div>
              </div>

              {/* Current state */}
              <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {t("Conveyance status", "حالة نقل الملكية")}
                    </span>
                    <Badge
                      variant={conveyance?.marketplaceConveyanceEnabled ? "success" : "default"}
                      size="sm"
                    >
                      {conveyance?.marketplaceConveyanceEnabled
                        ? t("Enabled", "مُفعّل")
                        : t("Disabled", "معطّل")}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isSystemAdmin && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("SYSTEM_ADMIN only", "مدير النظام فقط")}
                      </span>
                    )}
                    <Switch
                      checked={!!conveyance?.marketplaceConveyanceEnabled}
                      disabled={!isSystemAdmin}
                      onCheckedChange={(next) => openConveyanceToggle(next)}
                      aria-label={t("Toggle cross-org conveyance", "تبديل نقل الملكية بين المؤسسات")}
                    />
                  </div>
                </div>

                <dl className="grid gap-2 text-xs sm:grid-cols-2">
                  <div className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                    <dt className="text-muted-foreground">{t("Platform FAL license:", "ترخيص فال للمنصة:")}</dt>
                    <dd className="font-mono text-foreground">{conveyance?.regaPlatformFalLicense ?? "—"}</dd>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <dt className="text-muted-foreground">{t("Last sign-off by:", "آخر اعتماد بواسطة:")}</dt>
                    <dd className="text-foreground" dir="ltr">{conveyance?.marketplaceLegalSignoffBy ?? "—"}</dd>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <dt className="text-muted-foreground">{t("At:", "بتاريخ:")}</dt>
                    <dd className="text-foreground">
                      {conveyance?.marketplaceLegalSignoffAt
                        ? new Date(conveyance.marketplaceLegalSignoffAt).toLocaleString(
                            lang === "ar" ? "ar-SA-u-nu-latn" : "en-GB",
                          )
                        : "—"}
                    </dd>
                  </div>
                </dl>
                {conveyance?.marketplaceLegalSignoffNote && (
                  <p className="text-xs text-muted-foreground border-s-2 border-border ps-2">
                    <span className="font-medium text-foreground">{t("Note:", "ملاحظة:")}</span>{" "}
                    {conveyance.marketplaceLegalSignoffNote}
                  </p>
                )}
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Approve listing dialog ───────────────────────────────────────── */}
      <ResponsiveDialog
        open={!!approveTarget}
        onOpenChange={(open) => { if (!open && !approving) setApproveTarget(null); }}
        title={t("Approve Listing", "اعتماد الإعلان")}
        description={t(
          `Approve and publish "${approveTarget?.title ?? approveTarget?.listingNumber}"? The seller will be notified and the listing becomes visible to buyers.`,
          `اعتماد ونشر «${approveTarget?.title ?? approveTarget?.listingNumber}»؟ سيُخطَر البائع وسيصبح الإعلان مرئياً للمشترين.`,
        )}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setApproveTarget(null)} disabled={approving}>
              {t("Cancel", "إلغاء")}
            </Button>
            <Button variant="primary" onClick={handleApprove} disabled={approving}>
              {approving && <Loader2 className="h-4 w-4 animate-spin me-1.5" aria-hidden="true" />}
              {t("Approve & Publish", "اعتماد ونشر")}
            </Button>
          </div>
        }
      >
        {approveError && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {approveError}
          </div>
        )}
      </ResponsiveDialog>

      {/* ── Reject listing dialog ────────────────────────────────────────── */}
      <ResponsiveDialog
        open={!!rejectTarget}
        onOpenChange={(open) => { if (!open && !rejecting) setRejectTarget(null); }}
        title={t("Reject Listing", "رفض الإعلان")}
        description={t(
          `Reject "${rejectTarget?.title ?? rejectTarget?.listingNumber}"? The seller will be notified with the reason.`,
          `رفض «${rejectTarget?.title ?? rejectTarget?.listingNumber}»؟ سيُخطَر البائع بالسبب.`,
        )}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRejectTarget(null)} disabled={rejecting}>
              {t("Cancel", "إلغاء")}
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejecting || !rejectReason.trim()}>
              {rejecting && <Loader2 className="h-4 w-4 animate-spin me-1.5" aria-hidden="true" />}
              {t("Confirm Rejection", "تأكيد الرفض")}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-2">
          {rejectError && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {rejectError}
            </div>
          )}
          <Field label={t("Rejection reason (required — shown to seller)", "سبب الرفض (إلزامي — يظهر للبائع)")} required>
            {(field) => (
              <textarea
                {...field}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder={t("Enter a clear reason…", "أدخل سبباً واضحاً…")}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            )}
          </Field>
        </div>
      </ResponsiveDialog>

      {/* ── Suspend listing dialog ───────────────────────────────────────── */}
      <ResponsiveDialog
        open={!!suspendTarget}
        onOpenChange={(open) => { if (!open && !suspending) setSuspendTarget(null); }}
        title={t("Suspend Listing", "تعليق الإعلان")}
        description={t(
          `Suspend "${suspendTarget?.title ?? suspendTarget?.listingNumber}" from ${suspendTarget?.sellerOrg.nameEnglish ?? suspendTarget?.sellerOrg.name}? The seller will be notified with the reason.`,
          `تعليق «${suspendTarget?.title ?? suspendTarget?.listingNumber}» الخاص بـ${suspendTarget?.sellerOrg.name}؟ سيُخطَر البائع بالسبب.`,
        )}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setSuspendTarget(null)} disabled={suspending}>
              {t("Cancel", "إلغاء")}
            </Button>
            <Button variant="destructive" onClick={handleSuspend} disabled={suspending || !suspendReason.trim()}>
              {suspending && <Loader2 className="h-4 w-4 animate-spin me-1.5" aria-hidden="true" />}
              {t("Confirm Suspension", "تأكيد التعليق")}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-2">
          {suspendError && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {suspendError}
            </div>
          )}
          <Field label={t("Suspension reason (required — shown to seller)", "سبب التعليق (إلزامي — يظهر للبائع)")} required>
            {(field) => (
              <textarea
                {...field}
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                rows={3}
                placeholder={t("Enter a clear reason for suspension…", "أدخل سبباً واضحاً للتعليق…")}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            )}
          </Field>
        </div>
      </ResponsiveDialog>

      {/* ── REGA verify/reject dialog ────────────────────────────────────── */}
      <ResponsiveDialog
        open={!!regaTarget}
        onOpenChange={(open) => { if (!open && !regaSubmitting) setRegaTarget(null); }}
        title={regaApprove ? t("Verify REGA Authorization", "توثيق ترخيص الهيئة") : t("Reject REGA Authorization", "رفض ترخيص الهيئة")}
        description={
          regaApprove
            ? t(
                `Mark ${regaTarget?.organization.nameEnglish ?? regaTarget?.organization.name} as REGA-verified? They can then act as a verified seller/buyer in conveyance.`,
                `توثيق ${regaTarget?.organization.name} لدى الهيئة العامة للعقار؟ سيُمكِنهم ذلك من التصرف كبائع/مشترٍ موثّق في نقل الملكية.`,
              )
            : t(
                `Reject the REGA authorization for ${regaTarget?.organization.nameEnglish ?? regaTarget?.organization.name}?`,
                `رفض ترخيص الهيئة لـ${regaTarget?.organization.name}؟`,
              )
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRegaTarget(null)} disabled={regaSubmitting}>
              {t("Cancel", "إلغاء")}
            </Button>
            <Button
              variant={regaApprove ? "primary" : "destructive"}
              onClick={handleRega}
              disabled={regaSubmitting || (!regaApprove && !regaReason.trim())}
            >
              {regaSubmitting && <Loader2 className="h-4 w-4 animate-spin me-1.5" aria-hidden="true" />}
              {regaApprove ? t("Confirm Verify", "تأكيد التوثيق") : t("Confirm Rejection", "تأكيد الرفض")}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-2">
          {regaError && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {regaError}
            </div>
          )}
          {regaTarget?.regaLicenseNumber && (
            <p className="text-sm text-muted-foreground">
              {t("License #:", "رقم الترخيص:")}{" "}
              <span className="font-mono text-foreground">{regaTarget.regaLicenseNumber}</span>
            </p>
          )}
          {!regaApprove && (
            <Field label={t("Rejection reason (required)", "سبب الرفض (إلزامي)")} required>
              {(field) => (
                <textarea
                  {...field}
                  value={regaReason}
                  onChange={(e) => setRegaReason(e.target.value)}
                  rows={3}
                  placeholder={t("Enter a clear reason…", "أدخل سبباً واضحاً…")}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              )}
            </Field>
          )}
        </div>
      </ResponsiveDialog>

      {/* ── Deed proof review dialog ─────────────────────────────────────── */}
      <ResponsiveDialog
        open={!!proofTarget}
        onOpenChange={(open) => { if (!open && !proofSubmitting) setProofTarget(null); }}
        title={t("Review Deed-Transfer Proof", "مراجعة سند نقل الملكية")}
        description={t(
          "Verify the deed details below match the official record. Approving advances the transfer to READY for settlement.",
          "تأكّد من مطابقة بيانات السند أدناه للسجل الرسمي. الموافقة تنقل التحويل إلى حالة الجاهزية للتسوية.",
        )}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setProofTarget(null)} disabled={proofSubmitting}>
              {t("Cancel", "إلغاء")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleProof(false)}
              disabled={proofSubmitting || loadingDetail || !proofReason.trim()}
            >
              {t("Reject", "رفض")}
            </Button>
            <Button variant="primary" onClick={() => handleProof(true)} disabled={proofSubmitting || loadingDetail}>
              {proofSubmitting && <Loader2 className="h-4 w-4 animate-spin me-1.5" aria-hidden="true" />}
              {t("Verify", "توثيق")}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-2">
          {proofError && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {proofError}
            </div>
          )}
          {loadingDetail ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : proofDetail ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">{t("Deed number", "رقم الصك")}</span>
                  <span className="font-mono text-sm text-foreground" dir="ltr">
                    {proofDetail.deedNumber ?? "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">{t("Owner national ID", "هوية المالك")}</span>
                  <span className="font-mono text-sm text-foreground" dir="ltr">
                    {proofDetail.ownerNationalId ?? "—"}
                  </span>
                </div>
                {proofDetail.rettCertRef && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">{t("RETT cert ref", "مرجع شهادة ضريبة التصرفات")}</span>
                    <span className="font-mono text-sm text-foreground" dir="ltr">{proofDetail.rettCertRef}</span>
                  </div>
                )}
                {proofDetail.deedDocHash && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">{t("Doc SHA-256", "بصمة الملف")}</span>
                    <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[180px]" dir="ltr">
                      {proofDetail.deedDocHash}
                    </span>
                  </div>
                )}
              </div>
              {proofDetail.deedDocKey ? (
                /* SEC-016: the deed is an uploaded file. Download via the authorized
                   route, which authorizes the request then redirects to a short-lived
                   signed URL — never the raw permanent CDN URL. */
                <div className="flex flex-col gap-1">
                  <a
                    href={`/api/marketplace/deed/${proofDetail.transferId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline min-h-[44px]"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    {t(
                      "Download deed document (secure link — expires in 15 min)",
                      "تنزيل وثيقة الصك (رابط آمن — ينتهي خلال 15 دقيقة)",
                    )}
                  </a>
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "Uploaded file — opens in a new tab via a short-lived, authorized link.",
                      "ملف مرفوع — يفتح في تبويب جديد عبر رابط مُصرَّح به وقصير الأمد.",
                    )}
                  </p>
                </div>
              ) : proofDetail.deedDocUrl ? (
                /* Legacy (pre-SEC-016): deedDocUrl is seller-supplied. Warn the
                   verifier it is an external link they are about to open, and keep
                   rel="noopener noreferrer" + target="_blank" so the opened tab
                   can't reach back into this window. */
                <div className="flex flex-col gap-1">
                  <a
                    href={proofDetail.deedDocUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline min-h-[44px]"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    {t("Open deed document", "فتح وثيقة الصك")}
                  </a>
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "External link — seller-supplied, opens in a new tab. Verify the source before trusting it.",
                      "رابط خارجي — مُقدَّم من البائع ويفتح في تبويب جديد. تحقّق من المصدر قبل الاعتماد عليه.",
                    )}
                  </p>
                </div>
              ) : null}
              <p className="rounded-md bg-warning/10 px-3 py-2 text-xs text-warning-strong">
                {t(
                  "This view logs a PII access (READ_PII). Verify only against the official source.",
                  "يُسجَّل هذا العرض كاطّلاع على بيانات شخصية. تحقّق فقط مقابل المصدر الرسمي.",
                )}
              </p>
              <Field label={t("Rejection reason (required only when rejecting)", "سبب الرفض (إلزامي عند الرفض فقط)")}>
                {(field) => (
                  <textarea
                    {...field}
                    value={proofReason}
                    onChange={(e) => setProofReason(e.target.value)}
                    rows={2}
                    placeholder={t("Required if you reject…", "إلزامي عند الرفض…")}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                )}
              </Field>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("No deed proof details available.", "لا تتوفر بيانات سند الملكية.")}
            </p>
          )}
        </div>
      </ResponsiveDialog>

      {/* ── Conveyance toggle confirm dialog (SYSTEM_ADMIN only) ──────────── */}
      <ResponsiveDialog
        open={conveyanceDialogOpen}
        onOpenChange={(open) => { if (!open && !conveyanceSubmitting) setConveyanceDialogOpen(false); }}
        title={conveyancePendingEnabled
          ? t("Enable Cross-Org Conveyance", "تفعيل نقل الملكية بين المؤسسات")
          : t("Disable Cross-Org Conveyance", "تعطيل نقل الملكية بين المؤسسات")}
        description={
          conveyancePendingEnabled
            ? t(
                "Enabling cross-org conveyance is a LEGAL action. It opens the reserve-and-buy rail platform-wide. Only proceed with REGA platform-FAL licensing, a PDPL DPIA, and legal sign-off in place.",
                "تفعيل نقل الملكية بين المؤسسات إجراء قانوني. يفتح مسار الحجز والشراء على مستوى المنصة. لا تتابع إلا بوجود ترخيص الهيئة العامة للعقار وتقييم أثر حماية البيانات والاعتماد القانوني.",
              )
            : t(
                "Disabling conveyance immediately blocks all new settlements platform-wide.",
                "تعطيل نقل الملكية يوقف فوراً جميع عمليات التسوية الجديدة على مستوى المنصة.",
              )
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConveyanceDialogOpen(false)} disabled={conveyanceSubmitting}>
              {t("Cancel", "إلغاء")}
            </Button>
            <Button
              variant={conveyancePendingEnabled ? "destructive" : "primary"}
              onClick={handleConveyanceToggle}
              disabled={conveyanceSubmitting || !conveyanceNote.trim()}
            >
              {conveyanceSubmitting && <Loader2 className="h-4 w-4 animate-spin me-1.5" aria-hidden="true" />}
              {conveyancePendingEnabled
                ? t("I accept — Enable", "أوافق — تفعيل")
                : t("Disable", "تعطيل")}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-2">
          {conveyanceError && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {conveyanceError}
            </div>
          )}
          <div className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning-strong">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              {t(
                "Your email and timestamp are recorded as the legal sign-off for this change.",
                "يُسجَّل بريدك الإلكتروني والوقت كاعتماد قانوني لهذا التغيير.",
              )}
            </span>
          </div>
          <Field
            label={t("Legal sign-off note (required)", "ملاحظة الاعتماد القانوني (إلزامي)")}
            required
            hint={t(
              "Reference the approval, DPIA, or license that authorizes this change.",
              "أشِر إلى الموافقة أو تقييم أثر حماية البيانات أو الترخيص المخوِّل لهذا التغيير.",
            )}
          >
            {(field) => (
              <textarea
                {...field}
                value={conveyanceNote}
                onChange={(e) => setConveyanceNote(e.target.value)}
                rows={3}
                placeholder={t("e.g. Legal approval ref LGL-2026-… / DPIA complete", "مثال: مرجع الموافقة القانونية LGL-2026-… / تم تقييم الأثر")}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            )}
          </Field>
        </div>
      </ResponsiveDialog>
    </div>
  );
}
