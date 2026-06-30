"use client";

import * as React from "react";
import {
  MapPin,
  BedDouble,
  Bath,
  Maximize2,
  Building2,
  Eye,
  Heart,
  Calendar,
  Shield,
  ArrowLeft,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileText,
} from "lucide-react";
import {
  Button,
  Card,
  ResponsiveDialog,
  Skeleton,
  DirectionalIcon,
} from "@repo/ui";
import { cn } from "@repo/ui/lib/utils";
import { useLanguage } from "../../../../components/LanguageProvider";
import { sanitizeError } from "../../../../lib/error-sanitizer";
import {
  getMarketplaceListingDetail,
  confirmMarketplaceInterest,
} from "../../../actions/marketplace";
import Link from "next/link";
import { useParams } from "next/navigation";
import { notFound } from "next/navigation";
import type { MarketplaceListingDetailVM } from "../../../../lib/marketplace/listing-view";

// ─── Labels ──────────────────────────────────────────────────────────────────

const PROPERTY_TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  APARTMENT: { ar: "شقة", en: "Apartment" },
  VILLA: { ar: "فيلا", en: "Villa" },
  OFFICE: { ar: "مكتب", en: "Office" },
  RETAIL: { ar: "محل تجاري", en: "Retail" },
  WAREHOUSE: { ar: "مستودع", en: "Warehouse" },
  PARKING: { ar: "موقف", en: "Parking" },
};

const COMPLIANCE_LABELS: Record<string, { ar: string; en: string; cls: string }> = {
  APPROVED: { ar: "موافق عليه", en: "Approved", cls: "bg-success/15 text-success-strong" },
  PENDING_REVIEW: { ar: "قيد المراجعة", en: "Pending Review", cls: "bg-warning/15 text-warning-strong" },
  REJECTED: { ar: "مرفوض", en: "Rejected", cls: "bg-destructive/15 text-destructive" },
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

export default function ListingDetailPage() {
  const { t, lang } = useLanguage();
  const params = useParams<{ listingId: string }>();
  const listingId = params.listingId;

  const [listing, setListing] = React.useState<MarketplaceListingDetailVM | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notFoundFlag, setNotFoundFlag] = React.useState(false);

  // Interest dialog
  const [interestOpen, setInterestOpen] = React.useState(false);
  const [interestMsg, setInterestMsg] = React.useState("");
  const [contactName, setContactName] = React.useState("");
  const [contactPhone, setContactPhone] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await getMarketplaceListingDetail(listingId);
        if (active) setListing(data as MarketplaceListingDetailVM);
      } catch (err: unknown) {
        if (!active) return;
        const msg = err instanceof Error ? err.message : "";
        if (msg.toLowerCase().includes("not found") || msg.toLowerCase().includes("no longer")) {
          setNotFoundFlag(true);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [listingId]);

  // Trigger Next.js not-found boundary
  React.useEffect(() => {
    if (notFoundFlag) notFound();
  }, [notFoundFlag]);

  async function handleExpressInterest() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await confirmMarketplaceInterest(listingId, {
        message: interestMsg.trim() || undefined,
        contactName: contactName.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
      });
      setSubmitSuccess(true);
    } catch (err: unknown) {
      setSubmitError(sanitizeError(err, lang));
    } finally {
      setSubmitting(false);
    }
  }

  function openInterestDialog() {
    setInterestMsg("");
    setContactName("");
    setContactPhone("");
    setSubmitError(null);
    setSubmitSuccess(false);
    setInterestOpen(true);
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6 max-w-3xl mx-auto" dir={lang === "ar" ? "rtl" : "ltr"}>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-10 w-44" />
      </div>
    );
  }

  if (!listing) return null;

  // Google Maps URL
  const mapQuery = [listing.shortAddress, listing.district, listing.city].filter(Boolean).join(", ");
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;

  const complianceInfo = COMPLIANCE_LABELS[listing.complianceStatus] ?? {
    ar: listing.complianceStatus,
    en: listing.complianceStatus,
    cls: "bg-muted text-muted-foreground",
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-3xl mx-auto" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* Back link */}
      <Link
        href="/dashboard/marketplace"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <DirectionalIcon icon={ArrowLeft} className="h-4 w-4" aria-hidden="true" />
        {t("العودة إلى السوق", "Back to marketplace")}
      </Link>

      {/* Title row */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-xs text-muted-foreground mb-1">{listing.listingNumber}</p>
          <h1 className="text-2xl font-bold text-foreground">
            {listing.title ?? listing.listingNumber}
          </h1>
          {listing.sellerOrgName && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" aria-hidden="true" />
              {listing.sellerOrgName}
            </p>
          )}
        </div>
        <div className="text-start sm:text-end shrink-0">
          <p className="text-2xl font-bold text-primary">{formatSARLocal(listing.price, lang)}</p>
        </div>
      </div>

      {/* Key facts grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {listing.city && (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
            <MapPin className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="text-xs text-muted-foreground">{t("الموقع", "Location")}</p>
              <p className="text-sm font-medium text-foreground">
                {[listing.city, listing.district].filter(Boolean).join("، ")}
              </p>
            </div>
          </div>
        )}
        {listing.propertyType && (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
            <Building2 className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="text-xs text-muted-foreground">{t("نوع العقار", "Property Type")}</p>
              <p className="text-sm font-medium text-foreground">
                {lang === "ar"
                  ? (PROPERTY_TYPE_LABELS[listing.propertyType]?.ar ?? listing.propertyType)
                  : (PROPERTY_TYPE_LABELS[listing.propertyType]?.en ?? listing.propertyType)}
              </p>
            </div>
          </div>
        )}
        {listing.area != null && (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
            <Maximize2 className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="text-xs text-muted-foreground">{t("المساحة", "Area")}</p>
              <p className="text-sm font-medium text-foreground">
                <span className="number-ltr tabular-nums">{listing.area}</span> {t("م²", "m²")}
              </p>
            </div>
          </div>
        )}
        {listing.bedrooms != null && (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
            <BedDouble className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="text-xs text-muted-foreground">{t("غرف النوم", "Bedrooms")}</p>
              <p className="text-sm font-medium text-foreground"><span className="number-ltr tabular-nums">{listing.bedrooms}</span></p>
            </div>
          </div>
        )}
        {listing.bathrooms != null && (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
            <Bath className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="text-xs text-muted-foreground">{t("الحمامات", "Bathrooms")}</p>
              <p className="text-sm font-medium text-foreground"><span className="number-ltr tabular-nums">{listing.bathrooms}</span></p>
            </div>
          </div>
        )}
        {listing.buildingAge != null && (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
            <Calendar className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="text-xs text-muted-foreground">{t("عمر المبنى", "Building Age")}</p>
              <p className="text-sm font-medium text-foreground">
                <span className="number-ltr tabular-nums">{listing.buildingAge}</span> {t("سنة", "yrs")}
              </p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
          <Eye className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="text-xs text-muted-foreground">{t("المشاهدات", "Views")}</p>
            <p className="text-sm font-medium text-foreground"><span className="number-ltr tabular-nums">{listing.viewCount}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
          <Heart className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="text-xs text-muted-foreground">{t("المهتمون", "Interested")}</p>
            <p className="text-sm font-medium text-foreground">{listing.interestCount}</p>
          </div>
        </div>
      </div>

      {/* Description */}
      {listing.description && (
        <Card className="p-4 space-y-2">
          <h2 className="text-sm font-semibold text-foreground">
            {t("الوصف", "Description")}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {listing.description}
          </p>
        </Card>
      )}

      {/* National Address + compliance */}
      <Card className="p-4 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">
          {t("العنوان الوطني والامتثال", "National Address & Compliance")}
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          {listing.shortAddress && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
              <span className="font-mono text-sm text-foreground">{listing.shortAddress}</span>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline min-h-[44px] px-1"
                aria-label={t("فتح في خرائط جوجل", "Open in Google Maps")}
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                {t("خرائط جوجل", "Google Maps")}
              </a>
            </div>
          )}
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
              complianceInfo.cls
            )}
          >
            <Shield className="h-3.5 w-3.5" aria-hidden="true" />
            {lang === "ar" ? complianceInfo.ar : complianceInfo.en}
          </span>
        </div>
        {listing.adLicenseNumber && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {t("رقم ترخيص الإعلان (فال):", "REGA Ad License:")}{" "}
              <span className="font-mono text-foreground" dir="ltr">{listing.adLicenseNumber}</span>
            </span>
          </div>
        )}
        {listing.publishedAt && (
          <p className="text-xs text-muted-foreground">
            {t("تاريخ النشر:", "Published:")}{" "}
            {new Date(listing.publishedAt).toLocaleDateString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-GB")}
          </p>
        )}
      </Card>

      {/* CTA */}
      <div className="flex gap-3">
        <Button
          variant="primary"
          size="lg"
          className="min-h-[44px]"
          onClick={openInterestDialog}
        >
          <Heart className="h-5 w-5 me-2" aria-hidden="true" />
          {t("إبداء الاهتمام", "Express Interest")}
        </Button>
        <Button asChild variant="outline" size="lg" className="min-h-[44px]">
          <Link href="/dashboard/marketplace">
            {t("العودة", "Back")}
          </Link>
        </Button>
      </div>

      {/* Interest dialog */}
      <ResponsiveDialog
        open={interestOpen}
        onOpenChange={(open) => { if (!open && !submitting) setInterestOpen(false); }}
        title={t("إبداء الاهتمام بهذا الإعلان", "Express Interest in This Listing")}
        description={
          t("سيتم إشعار البائع باهتمامك. يمكنك إضافة رسالة واختيارية ومعلومات التواصل.", "The seller will be notified of your interest. You may add an optional message and contact details.")
        }
        footer={
          submitSuccess ? (
            <Button variant="primary" onClick={() => setInterestOpen(false)}>
              {t("إغلاق", "Close")}
            </Button>
          ) : (
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setInterestOpen(false)}
                disabled={submitting}
              >
                {t("إلغاء", "Cancel")}
              </Button>
              <Button
                variant="primary"
                onClick={handleExpressInterest}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin me-1.5" aria-hidden="true" />
                ) : (
                  <Heart className="h-4 w-4 me-1.5" aria-hidden="true" />
                )}
                {t("تأكيد الاهتمام", "Confirm Interest")}
              </Button>
            </div>
          )
        }
      >
        {submitSuccess ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 className="h-10 w-10 text-success" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">
              {t("تم إرسال استفسارك بنجاح!", "Your inquiry was sent successfully!")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("سيتم التواصل معك من قِبل البائع قريباً.", "The seller will contact you soon.")}
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {submitError && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                {submitError}
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                {t("رسالة (اختياري)", "Message (optional)")}
              </label>
              <textarea
                aria-label={t("رسالة للبائع", "Message to seller")}
                value={interestMsg}
                onChange={(e) => setInterestMsg(e.target.value)}
                rows={3}
                placeholder={t("أضف أي تفاصيل إضافية...", "Add any additional details…")}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                {t("اسم جهة التواصل (اختياري)", "Contact name (optional)")}
              </label>
              <input
                type="text"
                aria-label={t("اسم جهة التواصل", "Contact name")}
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder={t("الاسم...", "Name…")}
                className="flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                {t("رقم الهاتف *", "Phone number *")}
              </label>
              <input
                type="tel"
                aria-label={t("رقم الهاتف", "Phone number")}
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder={t("05xxxxxxxx", "05xxxxxxxx")}
                required
                className="flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">
                {t("مطلوب — رقم جوال سعودي للتواصل", "Required — Saudi mobile number for callback")}
              </p>
            </div>
          </div>
        )}
      </ResponsiveDialog>
    </div>
  );
}
