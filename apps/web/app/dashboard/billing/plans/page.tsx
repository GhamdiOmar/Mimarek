"use client";

import { useLanguage } from "../../../../components/LanguageProvider";
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  Crown,
  Sparkle,
  Building2,
  ArrowLeft,
  Tag,
  X,
  Loader2,
} from "lucide-react";
import { Button, AppBar, SARAmount, Skeleton, DirectionalIcon } from "@repo/ui";
import Link from "next/link";
import { getPlans, subscribeToPlan, getCurrentSubscription } from "../../../actions/billing";
import { validateCoupon } from "../../../actions/coupons";

export default function PlansPage() {
  const { lang } = useLanguage();
  const router = useRouter();
  const [plans, setPlans] = React.useState<any[]>([]);
  const [currentSub, setCurrentSub] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [subscribing, setSubscribing] = React.useState<string | null>(null);
  const [billingCycle, setBillingCycle] = React.useState<"MONTHLY" | "ANNUAL">("ANNUAL");

  // Coupon state
  const [couponCode, setCouponCode] = React.useState("");
  const [couponLoading, setCouponLoading] = React.useState(false);
  const [appliedCoupon, setAppliedCoupon] = React.useState<any>(null);
  const [couponError, setCouponError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function load() {
      try {
        const [p, sub] = await Promise.all([getPlans(), getCurrentSubscription()]);
        setPlans(p);
        setCurrentSub(sub);
      } catch (error) {
        console.error("Failed to load plans:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const t = translations[lang];

  async function handleValidateCoupon() {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponError(null);
    try {
      const result = await validateCoupon(couponCode.trim());
      if (result.valid && result.coupon) {
        setAppliedCoupon(result.coupon);
        setCouponError(null);
      } else {
        setAppliedCoupon(null);
        setCouponError(result.reason ?? t.couponInvalid);
      }
    } catch (error: any) {
      setCouponError(error.message ?? t.couponInvalid);
      setAppliedCoupon(null);
    } finally {
      setCouponLoading(false);
    }
  }

  function handleRemoveCoupon() {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError(null);
  }

  function calculateDiscount(price: number): { discountAmount: number; discountedPrice: number } {
    if (!appliedCoupon || price === 0) return { discountAmount: 0, discountedPrice: price };
    let discountAmount: number;
    if (appliedCoupon.type === "PERCENTAGE") {
      discountAmount = Math.round((price * appliedCoupon.value) / 100 * 100) / 100;
    } else {
      discountAmount = Math.min(appliedCoupon.value, price);
    }
    return { discountAmount, discountedPrice: Math.max(0, price - discountAmount) };
  }

  async function handleSubscribe(planId: string) {
    setSubscribing(planId);
    try {
      await subscribeToPlan({ planId, billingCycle, startTrial: true });
      // Reload data
      const sub = await getCurrentSubscription();
      setCurrentSub(sub);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setSubscribing(null);
    }
  }

  if (loading) {
    return (
      <>
        <div
          className="md:hidden -m-4 sm:-m-6 min-h-dvh flex flex-col bg-background"
          dir={lang === "ar" ? "rtl" : "ltr"}
        >
          <AppBar title={t.title} lang={lang} onBack={() => router.push("/dashboard/billing")} />
          <div className="flex-1 px-4 pt-4 space-y-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-60 w-full rounded-xl" />
            ))}
          </div>
        </div>
        <div className="hidden md:flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </>
    );
  }

  const planIcons = [Sparkle, Crown, Building2];

  return (
    <>
    {/* ─── Mobile (< md) ─────────────────────────────────────────────── */}
    <div
      className="md:hidden -m-4 sm:-m-6 min-h-dvh flex flex-col bg-background"
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <AppBar
        title={t.title}
        lang={lang}
        onBack={() => router.push("/dashboard/billing")}
      />

      <div className="flex-1 px-4 pt-4 pb-8 space-y-4">
        {/* Billing cycle toggle */}
        <div className="flex items-center gap-1 p-1 rounded-full bg-muted">
          <button
            onClick={() => setBillingCycle("MONTHLY")}
            className={`flex-1 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              billingCycle === "MONTHLY"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            {t.monthly}
          </button>
          <button
            onClick={() => setBillingCycle("ANNUAL")}
            className={`flex-1 px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
              billingCycle === "ANNUAL"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            {t.annual}
            <span className="text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded-full">
              {t.save20}
            </span>
          </button>
        </div>

        {/* Coupon input */}
        {appliedCoupon ? (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-success/40 bg-success/10">
            <Tag className="w-5 h-5 text-success flex-shrink-0" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-success">{appliedCoupon.code}</p>
              <p className="text-xs text-success/80">
                {appliedCoupon.type === "PERCENTAGE"
                  ? `${appliedCoupon.value}% ${t.discount}`
                  : `${appliedCoupon.value} ${t.sar} ${t.discount}`}
              </p>
            </div>
            <button
              onClick={handleRemoveCoupon}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-success hover:bg-success/10"
              aria-label={t.removeCoupon}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Tag className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <input
                type="text"
                value={couponCode}
                onChange={(e) => {
                  setCouponCode(e.target.value.toUpperCase());
                  setCouponError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleValidateCoupon();
                }}
                placeholder={t.couponPlaceholder}
                className="w-full h-11 ps-9 pe-3 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <Button
              variant="secondary"
              onClick={handleValidateCoupon}
              disabled={!couponCode.trim() || couponLoading}
              style={{ display: "inline-flex" }}
              className="h-11"
            >
              {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.applyCoupon}
            </Button>
          </div>
        )}
        {couponError && (
          <p className="text-xs text-destructive -mt-2">{couponError}</p>
        )}

        {/* Plan tiers stacked */}
        {plans.map((plan: any, index: number) => {
          const Icon = planIcons[index] ?? Crown;
          const isCurrentPlan = currentSub?.planId === plan.id;
          const price = billingCycle === "ANNUAL" ? Number(plan.priceAnnual) : Number(plan.priceMonthly);
          const monthlyEquiv = billingCycle === "ANNUAL" ? Math.round(price / 12) : price;
          const { discountAmount, discountedPrice } = calculateDiscount(price);
          const discountedMonthly = billingCycle === "ANNUAL"
            ? Math.round(discountedPrice / 12)
            : discountedPrice;
          const entitlements = plan.entitlements ?? [];

          return (
            <div
              key={plan.id}
              className={`bg-card border rounded-xl p-5 space-y-3 ${
                isCurrentPlan
                  ? "border-primary border-2 ring-2 ring-primary/20"
                  : "border-border"
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className="w-6 h-6 text-primary" aria-hidden="true" />
                <h3 className="text-lg font-bold text-foreground">
                  {lang === "ar" ? plan.nameAr : plan.nameEn}
                </h3>
              </div>

              <p className="text-xs text-muted-foreground">
                {lang === "ar" ? plan.descriptionAr : plan.descriptionEn}
              </p>

              <div className="pt-1">
                {price === 0 ? (
                  <p className="text-2xl font-bold text-foreground">{t.free}</p>
                ) : appliedCoupon && discountAmount > 0 ? (
                  <>
                    <SARAmount
                      value={monthlyEquiv}
                      size={12}
                      className="text-xs text-muted-foreground line-through tabular-nums"
                    />
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <SARAmount
                        value={discountedMonthly}
                        size={18}
                        className="text-2xl font-bold text-success tabular-nums"
                      />
                      <span className="text-sm text-muted-foreground">/{t.month}</span>
                    </div>
                    <p className="text-xs text-success mt-1">
                      {t.youSave}{" "}
                      <SARAmount
                        value={discountAmount}
                        size={11}
                        className="tabular-nums font-medium"
                      />
                    </p>
                  </>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <SARAmount
                      value={monthlyEquiv}
                      size={18}
                      className="text-2xl font-bold text-foreground tabular-nums"
                    />
                    <span className="text-sm text-muted-foreground">/{t.month}</span>
                  </div>
                )}
                {billingCycle === "ANNUAL" && price > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {t.billedAnnually}:{" "}
                    <SARAmount
                      value={appliedCoupon ? discountedPrice : price}
                      size={11}
                      className="tabular-nums"
                    />
                    /{t.year}
                  </p>
                )}
              </div>

              {/* Features */}
              {entitlements.length > 0 && (
                <ul className="space-y-2 pt-2 border-t border-border">
                  {entitlements.map((ent: any) => {
                    const granted =
                      ent.type === "BOOLEAN"
                        ? ent.value === "true"
                        : ent.type === "LIMIT"
                          ? ent.value !== "0"
                          : true;
                    return (
                      <li key={ent.featureKey} className="flex items-center gap-2 text-xs">
                        {granted ? (
                          <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" aria-hidden="true" />
                        ) : (
                          <XCircle className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" aria-hidden="true" />
                        )}
                        <span className={granted ? "text-foreground" : "text-muted-foreground/60"}>
                          {formatEntitlement(ent, lang)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* CTA */}
              {isCurrentPlan ? (
                <Button
                  variant="secondary"
                  className="w-full h-11"
                  disabled
                  style={{ display: "inline-flex" }}
                >
                  <CheckCircle2 className="w-4 h-4 me-2" />
                  {t.currentPlan}
                </Button>
              ) : (
                <Button
                  className="w-full h-11"
                  variant="primary"
                  disabled={!!subscribing}
                  onClick={() => handleSubscribe(plan.id)}
                  style={{ display: "inline-flex" }}
                >
                  {subscribing === plan.id ? (
                    <Loader2 className="h-4 w-4 animate-spin me-2" />
                  ) : null}
                  {price === 0 ? t.getStarted : t.startTrial}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>

    {/* ─── Desktop (≥ md) ─ unchanged ───────────────────────────────── */}
    <div className="hidden md:block">
    <div className="space-y-6" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* Back + Header */}
      <div>
        <Link href="/dashboard/billing" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4">
          <DirectionalIcon icon={ArrowLeft} className="w-4 h-4" />
          {t.backToBilling}
        </Link>
        <h1 className="text-2xl font-bold text-foreground">{t.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t.subtitle}</p>
      </div>

      {/* Billing Cycle Toggle */}
      <div className="inline-flex items-center justify-center gap-1 p-1.5 rounded-full bg-muted mx-auto">
        <button
          onClick={() => setBillingCycle("MONTHLY")}
          className={`px-6 py-2.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
            billingCycle === "MONTHLY"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t.monthly}
        </button>
        <button
          onClick={() => setBillingCycle("ANNUAL")}
          className={`px-6 py-2.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
            billingCycle === "ANNUAL"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t.annual}
          <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full whitespace-nowrap">
            {t.save20}
          </span>
        </button>
      </div>

      {/* Coupon Code Section */}
      <div className="max-w-md mx-auto" data-testid="coupon-section">
        {appliedCoupon ? (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
            <Tag className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-green-800 dark:text-green-300">
                {appliedCoupon.code}
              </p>
              <p className="text-xs text-green-600 dark:text-green-400">
                {appliedCoupon.type === "PERCENTAGE"
                  ? `${appliedCoupon.value}% ${t.discount}`
                  : `${appliedCoupon.value} ${t.sar} ${t.discount}`}
                {" — "}
                {lang === "ar" ? appliedCoupon.descriptionAr : appliedCoupon.descriptionEn}
              </p>
            </div>
            <button
              onClick={handleRemoveCoupon}
              className="p-1 rounded-md hover:bg-green-100 dark:hover:bg-green-800/40 text-green-600 dark:text-green-400"
              title={t.removeCoupon}
              aria-label={t.removeCoupon}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Tag className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={couponCode}
                onChange={(e) => {
                  setCouponCode(e.target.value.toUpperCase());
                  setCouponError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleValidateCoupon();
                }}
                placeholder={t.couponPlaceholder}
                className="w-full ps-9 pe-3 py-2 text-sm rounded-lg border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                data-testid="coupon-input"
              />
            </div>
            <Button
              variant="secondary"
              onClick={handleValidateCoupon}
              disabled={!couponCode.trim() || couponLoading}
             
              data-testid="apply-coupon-btn"
            >
              {couponLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
              ) : (
                t.applyCoupon
              )}
            </Button>
          </div>
        )}
        {couponError && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-2" data-testid="coupon-error">
            {couponError}
          </p>
        )}
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {plans.map((plan: any, index: number) => {
          const Icon = planIcons[index] ?? Crown;
          const isCurrentPlan = currentSub?.planId === plan.id;
          const price = billingCycle === "ANNUAL" ? Number(plan.priceAnnual) : Number(plan.priceMonthly);
          const monthlyEquiv = billingCycle === "ANNUAL" ? Math.round(price / 12) : price;
          const isPopular = index === 1; // Professional is middle/popular

          // Calculate coupon discount on the total price
          const { discountAmount, discountedPrice } = calculateDiscount(price);
          const discountedMonthly = billingCycle === "ANNUAL"
            ? Math.round(discountedPrice / 12)
            : discountedPrice;

          return (
            <div
              key={plan.id}
              className={`relative rounded-xl border bg-card shadow-sm overflow-hidden ${
                isPopular ? "border-primary ring-2 ring-primary/20" : ""
              }`}
            >
              {isPopular && (
                <div className="absolute top-0 inset-x-0 bg-primary text-primary-foreground text-xs text-center py-1 font-medium">
                  {t.mostPopular}
                </div>
              )}

              <div className={`p-6 ${isPopular ? "pt-10" : ""}`}>
                <Icon className="w-8 h-8 text-primary mb-3" />
                <h3 className="text-xl font-bold">
                  {lang === "ar" ? plan.nameAr : plan.nameEn}
                </h3>
                <p className="text-sm text-muted-foreground mt-1 min-h-[40px]">
                  {lang === "ar" ? plan.descriptionAr : plan.descriptionEn}
                </p>

                <div className="mt-4 mb-6">
                  {price === 0 ? (
                    <p className="text-3xl font-bold">{t.free}</p>
                  ) : (
                    <>
                      {appliedCoupon && discountAmount > 0 ? (
                        <>
                          <p className="text-sm text-muted-foreground line-through" data-testid="original-price">
                            {monthlyEquiv.toLocaleString(lang === "ar" ? "ar-SA" : "en-US")} {t.sar}/{t.month}
                          </p>
                          <p className="text-3xl font-bold text-green-700 dark:text-green-400" data-testid="discounted-price">
                            {discountedMonthly.toLocaleString(lang === "ar" ? "ar-SA" : "en-US")}
                            <span className="text-base font-normal text-muted-foreground"> {t.sar}/{t.month}</span>
                          </p>
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                            {t.youSave} {discountAmount.toLocaleString(lang === "ar" ? "ar-SA" : "en-US")} {t.sar}
                          </p>
                        </>
                      ) : (
                        <p className="text-3xl font-bold">
                          {monthlyEquiv.toLocaleString(lang === "ar" ? "ar-SA" : "en-US")}
                          <span className="text-base font-normal text-muted-foreground"> {t.sar}/{t.month}</span>
                        </p>
                      )}
                      {billingCycle === "ANNUAL" && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {t.billedAnnually}: {(appliedCoupon ? discountedPrice : price).toLocaleString(lang === "ar" ? "ar-SA" : "en-US")} {t.sar}/{t.year}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {isCurrentPlan ? (
                  <Button
                    variant="secondary"
                    className="w-full"
                    disabled
                   
                  >
                    <CheckCircle2 className="w-4 h-4 me-2" />
                    {t.currentPlan}
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    variant={isPopular ? "primary" : "secondary"}
                    disabled={!!subscribing}
                    onClick={() => handleSubscribe(plan.id)}
                   
                  >
                    {subscribing === plan.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current me-2" />
                    ) : null}
                    {price === 0 ? t.getStarted : t.startTrial}
                  </Button>
                )}
              </div>

              {/* Feature List */}
              <div className="border-t p-6 space-y-3">
                {plan.entitlements?.map((ent: any) => {
                  const granted = ent.type === "BOOLEAN" ? ent.value === "true" :
                    ent.type === "LIMIT" ? ent.value !== "0" : true;

                  return (
                    <div key={ent.featureKey} className="flex items-center gap-2 text-sm">
                      {granted ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                      )}
                      <span className={granted ? "" : "text-muted-foreground/60"}>
                        {formatEntitlement(ent, lang)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
    </div>
    </>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatEntitlement(ent: any, lang: "ar" | "en"): string {
  const labels: Record<string, { ar: string; en: string }> = {
    "projects.max": { ar: "مشاريع", en: "Projects" },
    "users.max": { ar: "مستخدمين", en: "Users" },
    "units.max": { ar: "وحدات", en: "Units" },
    "cmms.access": { ar: "نظام إدارة الصيانة", en: "CMMS Maintenance System" },
    "offplan.access": { ar: "نظام البيع على الخارطة", en: "Off-Plan Development" },
    "reports.export": { ar: "تصدير التقارير", en: "Export Reports" },
    "pii.encryption": { ar: "تشفير البيانات الشخصية", en: "PII Encryption" },
    "audit.access": { ar: "سجل المراجعة", en: "Audit Log" },
    "api.access": { ar: "الوصول لـ API", en: "API Access" },
    "custom.branding": { ar: "العلامة التجارية المخصصة", en: "Custom Branding" },
    "sla.priority": { ar: "أولوية الدعم", en: "Support Priority" },
  };

  const label = labels[ent.featureKey]?.[lang] ?? ent.featureKey;

  if (ent.type === "LIMIT") {
    const val = ent.value === "unlimited"
      ? (lang === "ar" ? "غير محدود" : "Unlimited")
      : ent.value;
    return `${val} ${label}`;
  }

  return label;
}

// ─── Translations ────────────────────────────────────────────────────────────

const translations = {
  ar: {
    title: "اختر خطتك",
    subtitle: "اختر الخطة المناسبة لأعمالك",
    backToBilling: "العودة للفوترة",
    monthly: "شهري",
    annual: "سنوي",
    save20: "وفر 20%",
    sar: "ر.س",
    month: "شهر",
    year: "سنة",
    free: "مجاني",
    billedAnnually: "يُفوتر سنوياً",
    currentPlan: "الخطة الحالية",
    getStarted: "ابدأ الآن",
    startTrial: "ابدأ تجربة مجانية",
    mostPopular: "الأكثر شيوعاً",
    couponPlaceholder: "أدخل رمز الكوبون",
    applyCoupon: "تطبيق",
    removeCoupon: "إزالة الكوبون",
    couponInvalid: "رمز الكوبون غير صالح",
    discount: "خصم",
    youSave: "توفر",
  },
  en: {
    title: "Choose Your Plan",
    subtitle: "Select the plan that fits your business",
    backToBilling: "Back to Billing",
    monthly: "Monthly",
    annual: "Annual",
    save20: "Save 20%",
    sar: "SAR",
    month: "month",
    year: "year",
    free: "Free",
    billedAnnually: "Billed annually",
    currentPlan: "Current Plan",
    getStarted: "Get Started",
    startTrial: "Start Free Trial",
    mostPopular: "Most Popular",
    couponPlaceholder: "Enter coupon code",
    applyCoupon: "Apply",
    removeCoupon: "Remove coupon",
    couponInvalid: "Invalid coupon code",
    discount: "off",
    youSave: "You save",
  },
};
