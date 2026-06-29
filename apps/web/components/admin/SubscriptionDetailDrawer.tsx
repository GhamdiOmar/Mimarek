"use client";

import * as React from "react";
import {
  Button,
  Badge,
  Input,
  SelectField,
  ResponsiveDialog,
  ConfirmDialog,
  SARAmount,
  SARAmountInput,
} from "@repo/ui";
import { useLanguage } from "../LanguageProvider";
import { sanitizeError } from "../../lib/error-sanitizer";
import { SUBSCRIPTION_STATUS_LABEL, SUBSCRIPTION_STATUS_VARIANT } from "../../lib/domain-labels";
import { UsageMeter } from "../entitlements";
import {
  adminChangeOrgPlan,
  adminSetCustomPrice,
  adminPauseSubscription,
  adminResumeSubscription,
  adminCancelSubscription,
  adminGetSubscriptionContext,
} from "../../app/actions/admin-subscriptions";

type Cycle = "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL";

export type AdminSubscriptionRow = {
  id: string;
  status: string;
  billingCycle: string;
  priceAtRenewal: number | string | null;
  plan: { id: string; nameEn: string; nameAr: string };
  organization: { id: string; name: string; nameArabic: string | null };
};

type PlanOpt = { id: string; nameEn: string; nameAr: string };
type UsageMetric = { key: string; labelAr: string; labelEn: string; current: number; limit: number | null };

const T = {
  ar: {
    title: "تفاصيل الاشتراك", desc: "إدارة خطة هذه المنشأة وسعرها ودورة حياة اشتراكها.",
    org: "المنشأة", status: "الحالة", price: "السعر الحالي",
    usage: "الاستخدام مقابل الخطة", plan: "الخطة", cycle: "دورة الفوترة",
    changePlan: "تغيير الخطة", applyChange: "تطبيق التغيير", customPrice: "سعر مخصص",
    reason: "السبب", setPrice: "تعيين السعر", controls: "إدارة الاشتراك",
    pause: "إيقاف مؤقت", resume: "استئناف", cancel: "إلغاء الاشتراك", close: "إغلاق",
    confirmTitle: "تأكيد الإلغاء",
    confirmDesc: "سيتم إلغاء اشتراك هذه المنشأة. يمكن إعادة الاشتراك لاحقًا.",
    keep: "تراجع", saved: "تم الحفظ بنجاح",
    reasonPh: "سبب السعر المخصص (مطلوب)",
    cycles: { MONTHLY: "شهري", QUARTERLY: "ربع سنوي", SEMI_ANNUAL: "نصف سنوي", ANNUAL: "سنوي" } as Record<Cycle, string>,
  },
  en: {
    title: "Subscription details", desc: "Manage this organization's plan, price, and subscription lifecycle.",
    org: "Organization", status: "Status", price: "Current price",
    usage: "Usage vs. plan", plan: "Plan", cycle: "Billing cycle",
    changePlan: "Change plan", applyChange: "Apply change", customPrice: "Custom price",
    reason: "Reason", setPrice: "Set price", controls: "Subscription controls",
    pause: "Pause", resume: "Resume", cancel: "Cancel subscription", close: "Close",
    confirmTitle: "Confirm cancellation",
    confirmDesc: "This organization's subscription will be canceled. They can resubscribe later.",
    keep: "Keep it", saved: "Saved successfully",
    reasonPh: "Reason for the custom price (required)",
    cycles: { MONTHLY: "Monthly", QUARTERLY: "Quarterly", SEMI_ANNUAL: "Semi-annual", ANNUAL: "Annual" } as Record<Cycle, string>,
  },
};

/**
 * Admin subscription detail + management drawer (pricing P3). §6.6: exactly ONE
 * primary action (Apply plan change); custom-price + lifecycle are secondary /
 * destructive, cancel is `ConfirmDialog`-guarded. Errors run through
 * `sanitizeError` so plan/limit denials surface as friendly bilingual copy.
 */
export function SubscriptionDetailDrawer({
  open,
  onOpenChange,
  subscription: sub,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  subscription: AdminSubscriptionRow;
  onChanged: () => void;
}) {
  const { lang } = useLanguage();
  const t = T[lang];

  const [plans, setPlans] = React.useState<PlanOpt[]>([]);
  const [usage, setUsage] = React.useState<UsageMetric[]>([]);
  const [planId, setPlanId] = React.useState(sub.plan.id);
  const [cycle, setCycle] = React.useState<Cycle>(sub.billingCycle as Cycle);
  const [price, setPrice] = React.useState<number | null>(sub.priceAtRenewal != null ? Number(sub.priceAtRenewal) : null);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [banner, setBanner] = React.useState<{ ok: boolean; msg: string } | null>(null);
  const [confirmCancel, setConfirmCancel] = React.useState(false);

  // Reset edit state when a different row is opened.
  React.useEffect(() => {
    setPlanId(sub.plan.id);
    setCycle(sub.billingCycle as Cycle);
    setPrice(sub.priceAtRenewal != null ? Number(sub.priceAtRenewal) : null);
    setReason("");
    setBanner(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub.id]);

  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      try {
        // Plan list (change-plan picker) + usage snapshot in ONE combined RPC —
        // one round-trip and one pooled query batch instead of two.
        const ctx = (await adminGetSubscriptionContext(sub.organization.id)) as {
          plans: PlanOpt[];
          usage: UsageMetric[];
        };
        if (!alive) return;
        setPlans(ctx.plans.map((x) => ({ id: x.id, nameEn: x.nameEn, nameAr: x.nameAr })));
        setUsage(ctx.usage);
      } catch (err) {
        if (alive) setBanner({ ok: false, msg: sanitizeError(err, lang) });
      }
    })();
    return () => {
      alive = false;
    };
    // lang intentionally excluded — it only feeds the error message; including it
    // re-runs the effect on language hydration and abandons the in-flight load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sub.organization.id]);

  async function run(action: string, fn: () => Promise<unknown>) {
    setBusy(action);
    setBanner(null);
    try {
      await fn();
      setBanner({ ok: true, msg: t.saved });
      onChanged();
    } catch (err) {
      setBanner({ ok: false, msg: sanitizeError(err, lang) });
    } finally {
      setBusy(null);
    }
  }

  // Only MONTHLY + ANNUAL are priced on the Plan model; include the row's own
  // cycle if it is something else (legacy data) so the select still resolves.
  const cycleOptions = Array.from(new Set<Cycle>(["MONTHLY", "ANNUAL", sub.billingCycle as Cycle]));
  const planChanged = planId !== sub.plan.id || cycle !== sub.billingCycle;
  const priceChanged = price != null && Number(price) !== Number(sub.priceAtRenewal ?? NaN);
  const orgName = lang === "ar" ? sub.organization.nameArabic ?? sub.organization.name : sub.organization.name;

  return (
    <>
      <ResponsiveDialog
        open={open}
        onOpenChange={onOpenChange}
        title={t.title}
        description={t.desc}
        contentClassName="sm:max-w-[560px]"
        footer={
          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t.close}
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          {banner && (
            <div
              role="status"
              className={`rounded-lg border px-3 py-2 text-sm ${
                banner.ok
                  ? "border-success/30 bg-success/10 text-success-strong"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
              }`}
            >
              {banner.msg}
            </div>
          )}

          {/* Read-only summary */}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div className="col-span-2">
              <dt className="text-xs font-medium text-muted-foreground">{t.org}</dt>
              <dd className="text-sm font-medium text-foreground">{orgName}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">{t.status}</dt>
              <dd className="mt-0.5">
                <Badge variant={SUBSCRIPTION_STATUS_VARIANT[sub.status] ?? "default"} size="sm">
                  {SUBSCRIPTION_STATUS_LABEL[sub.status]?.[lang] ?? sub.status}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">{t.price}</dt>
              <dd className="text-sm font-medium text-foreground">
                <SARAmount value={Number(sub.priceAtRenewal ?? 0)} />
              </dd>
            </div>
          </dl>

          {/* Usage meters */}
          {usage.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">{t.usage}</h3>
              <div className="space-y-3 rounded-xl border border-border bg-card p-4">
                {usage.map((u) => (
                  <UsageMeter key={u.key} current={u.current} limit={u.limit} label={lang === "ar" ? u.labelAr : u.labelEn} />
                ))}
              </div>
            </div>
          )}

          {/* Change plan — the single primary action (§6.6) */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">{t.changePlan}</h3>
            <SelectField aria-label={t.plan} value={planId} onChange={(e) => setPlanId(e.target.value)}>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {lang === "ar" ? p.nameAr : p.nameEn}
                </option>
              ))}
            </SelectField>
            <SelectField aria-label={t.cycle} value={cycle} onChange={(e) => setCycle(e.target.value as Cycle)}>
              {cycleOptions.map((c) => (
                <option key={c} value={c}>
                  {t.cycles[c]}
                </option>
              ))}
            </SelectField>
            <Button
              variant="primary"
              disabled={!planChanged || busy !== null}
              loading={busy === "plan"}
              onClick={() => run("plan", () => adminChangeOrgPlan(sub.id, planId, cycle))}
            >
              {t.applyChange}
            </Button>
          </div>

          {/* Custom price (secondary — requires a reason) */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">{t.customPrice}</h3>
            <SARAmountInput value={price} onChange={setPrice} locale={lang} aria-label={t.customPrice} />
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t.reasonPh} aria-label={t.reason} />
            <Button
              variant="secondary"
              disabled={!priceChanged || !reason.trim() || busy !== null}
              loading={busy === "price"}
              onClick={() => run("price", () => adminSetCustomPrice(sub.id, Number(price), reason))}
            >
              {t.setPrice}
            </Button>
          </div>

          {/* Lifecycle controls (secondary / destructive) */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">{t.controls}</h3>
            <div className="flex flex-wrap gap-2">
              {sub.status === "ACTIVE" && (
                <Button variant="secondary" disabled={busy !== null} loading={busy === "pause"} onClick={() => run("pause", () => adminPauseSubscription(sub.id))}>
                  {t.pause}
                </Button>
              )}
              {sub.status === "PAUSED" && (
                <Button variant="secondary" disabled={busy !== null} loading={busy === "resume"} onClick={() => run("resume", () => adminResumeSubscription(sub.id))}>
                  {t.resume}
                </Button>
              )}
              {sub.status !== "CANCELED" && (
                <Button variant="destructive" disabled={busy !== null} onClick={() => setConfirmCancel(true)}>
                  {t.cancel}
                </Button>
              )}
            </div>
          </div>
        </div>
      </ResponsiveDialog>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={t.confirmTitle}
        description={t.confirmDesc}
        confirmLabel={t.cancel}
        cancelLabel={t.keep}
        variant="destructive"
        onConfirm={() => run("cancel", () => adminCancelSubscription(sub.id))}
      />
    </>
  );
}
