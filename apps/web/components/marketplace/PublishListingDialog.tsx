"use client";

import * as React from "react";
import { Loader2, AlertCircle, CheckCircle2, Store } from "lucide-react";
import { Button, ResponsiveDialog, SelectField } from "@repo/ui";
import { useRouter } from "next/navigation";
import { useLanguage } from "../LanguageProvider";
import {
  validateMarketplaceEligibility,
  createMarketplaceDraft,
  publishMarketplaceListing,
  type EligibilityBlocker,
} from "../../app/actions/marketplace";

const BLOCKER_LABELS: Record<EligibilityBlocker, { ar: string; en: string }> = {
  NOT_OWNED: { ar: "الوحدة ليست ضمن مؤسستك", en: "Unit is not in your organization" },
  NOT_AVAILABLE: { ar: "الوحدة غير متاحة (محجوزة/مباعة/مؤجرة)", en: "Unit is not available (reserved/sold/rented)" },
  ACTIVE_LEASE: { ar: "يوجد عقد إيجار نشط على الوحدة", en: "Unit has an active lease" },
  ACTIVE_RESERVATION: { ar: "يوجد حجز نشط على الوحدة", en: "Unit has an active reservation" },
  ALREADY_LISTED: { ar: "الوحدة معروضة بالفعل في السوق", en: "Unit is already listed on the marketplace" },
  MISSING_ADDRESS: { ar: "بيانات المدينة/الحي ناقصة", en: "City/district data is missing" },
};

type UnitLike = {
  id: string;
  number: string;
  type: string;
  markupPrice?: number | string | null;
  price?: number | string | null;
};

export function PublishListingDialog({
  unit,
  open,
  onOpenChange,
}: {
  unit: UnitLike | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { lang } = useLanguage();
  const router = useRouter();
  const ar = lang === "ar";

  const [checking, setChecking] = React.useState(false);
  const [blockers, setBlockers] = React.useState<EligibilityBlocker[] | null>(null);
  const [title, setTitle] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [shortAddress, setShortAddress] = React.useState("");
  const [adLicense, setAdLicense] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [expiresInDays, setExpiresInDays] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  React.useEffect(() => {
    if (!open || !unit) return;
    setBlockers(null);
    setError(null);
    setSuccess(false);
    setTitle(`${unit.type} ${unit.number}`);
    setPrice(unit.markupPrice ? String(unit.markupPrice) : unit.price ? String(unit.price) : "");
    setShortAddress("");
    setAdLicense("");
    setDescription("");
    setExpiresInDays("");
    setChecking(true);
    (async () => {
      try {
        const result = await validateMarketplaceEligibility(unit.id);
        setBlockers(result.eligible ? [] : result.blockers);
      } catch (e) {
        setError(e instanceof Error ? e.message : ar ? "تعذّر التحقق من الأهلية" : "Eligibility check failed");
        setBlockers([]);
      } finally {
        setChecking(false);
      }
    })();
  }, [open, unit, ar]);

  async function handlePublish() {
    if (!unit) return;
    const code = shortAddress.trim().toUpperCase();
    if (!/^[A-Z]{4}\d{4}$/.test(code)) {
      setError(ar ? "العنوان الوطني المختصر غير صحيح (4 أحرف + 4 أرقام)" : "Invalid National Address short code (4 letters + 4 digits)");
      return;
    }
    if (!title.trim() || !price || Number(price) <= 0) {
      setError(ar ? "العنوان والسعر مطلوبان" : "Title and a valid price are required");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const draft = await createMarketplaceDraft(unit.id);
      await publishMarketplaceListing(draft.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        price: Number(price),
        shortAddress: code,
        adLicenseNumber: adLicense.trim() || undefined,
        expiresInDays: expiresInDays ? Number(expiresInDays) : undefined,
      });
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : ar ? "فشل نشر الإعلان" : "Failed to publish listing");
    } finally {
      setSubmitting(false);
    }
  }

  const hasBlockers = blockers != null && blockers.length > 0;
  const inputCls =
    "flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(o) => { if (!o && !submitting) onOpenChange(false); }}
      title={ar ? "نشر في السوق" : "Publish in Marketplace"}
      description={
        ar
          ? "اعرض هذه الوحدة لمؤسسات موثوقة أخرى داخل معمارك."
          : "List this unit for other verified organizations inside Mimarek."
      }
      footer={
        success ? (
          <Button variant="primary" onClick={() => { onOpenChange(false); router.push("/dashboard/marketplace/my-listings"); }}>
            {ar ? "عرض إعلاناتي" : "View my listings"}
          </Button>
        ) : hasBlockers || checking ? (
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {ar ? "إغلاق" : "Close"}
          </Button>
        ) : (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button variant="primary" onClick={handlePublish} disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin me-1.5" aria-hidden="true" />
              ) : (
                <Store className="h-4 w-4 me-1.5" aria-hidden="true" />
              )}
              {ar ? "نشر الإعلان" : "Publish listing"}
            </Button>
          </div>
        )
      }
    >
      {checking ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {ar ? "جارٍ التحقق من الأهلية…" : "Checking eligibility…"}
        </div>
      ) : success ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <CheckCircle2 className="h-10 w-10 text-success" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">
            {ar ? "تم نشر الإعلان في السوق" : "Listing published to the marketplace"}
          </p>
        </div>
      ) : hasBlockers ? (
        <div className="space-y-3 py-2">
          <p className="text-sm font-medium text-foreground">
            {ar ? "لا يمكن نشر هذه الوحدة:" : "This unit cannot be listed:"}
          </p>
          <ul className="space-y-2">
            {blockers!.map((b) => (
              <li key={b} className="flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                {ar ? BLOCKER_LABELS[b].ar : BLOCKER_LABELS[b].en}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="space-y-4 py-2">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </div>
          )}
          <div className="space-y-1">
            <label htmlFor="mkt-title" className="text-xs font-medium text-muted-foreground">
              {ar ? "عنوان الإعلان *" : "Listing title *"}
            </label>
            <input id="mkt-title" className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label htmlFor="mkt-price" className="text-xs font-medium text-muted-foreground">
              {ar ? "السعر (ر.س) *" : "Price (SAR) *"}
            </label>
            <input id="mkt-price" type="number" inputMode="decimal" dir="ltr" className={inputCls} value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label htmlFor="mkt-addr" className="text-xs font-medium text-muted-foreground">
              {ar ? "العنوان الوطني المختصر *" : "National Address short code *"}
            </label>
            <input
              id="mkt-addr"
              className={`${inputCls} font-mono uppercase`}
              dir="ltr"
              placeholder="RRRA2929"
              maxLength={8}
              value={shortAddress}
              onChange={(e) => setShortAddress(e.target.value.toUpperCase())}
            />
            <p className="text-[11px] text-muted-foreground">
              {ar ? "4 أحرف إنجليزية + 4 أرقام" : "4 letters + 4 digits"}
            </p>
          </div>
          <div className="space-y-1">
            <label htmlFor="mkt-license" className="text-xs font-medium text-muted-foreground">
              {ar ? "رقم رخصة الإعلان (اختياري — هيئة العقار)" : "Ad license number (optional — REGA)"}
            </label>
            <input id="mkt-license" className={inputCls} dir="ltr" value={adLicense} onChange={(e) => setAdLicense(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label htmlFor="mkt-desc" className="text-xs font-medium text-muted-foreground">
              {ar ? "الوصف (اختياري)" : "Description (optional)"}
            </label>
            <textarea
              id="mkt-desc"
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="mkt-exp" className="text-xs font-medium text-muted-foreground">
              {ar ? "تنتهي الصلاحية بعد (اختياري)" : "Expires after (optional)"}
            </label>
            <SelectField
              id="mkt-exp"
              className={inputCls}
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
            >
              <option value="">{ar ? "بدون انتهاء" : "No expiry"}</option>
              <option value="14">{ar ? "14 يومًا" : "14 days"}</option>
              <option value="30">{ar ? "30 يومًا" : "30 days"}</option>
              <option value="60">{ar ? "60 يومًا" : "60 days"}</option>
              <option value="90">{ar ? "90 يومًا" : "90 days"}</option>
            </SelectField>
          </div>
        </div>
      )}
    </ResponsiveDialog>
  );
}
