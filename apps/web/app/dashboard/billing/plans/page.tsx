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
  Loader2,
} from "lucide-react";
import { Button, AppBar, SARAmount, Skeleton, ActionLink } from "@repo/ui";
import { PageHeader } from "@repo/ui/components/PageHeader";
import Link from "next/link";
import { subscribeToPlan, getCurrentSubscription, getPlans } from "../../../actions/billing";
import { toast } from "sonner";

// ─── Serialized DTOs (Decimal → string, Date → string over the RSC boundary) ──

type EntitlementDTO = {
  featureKey: string;
  type: "BOOLEAN" | "LIMIT" | "METERED";
  value: string;
};

type PlanDTO = {
  id: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  priceMonthly: number | string;
  priceAnnual: number | string;
  entitlements?: EntitlementDTO[];
};

type CurrentSubscriptionDTO = { planId: string } | null;

export default function PlansPage() {
  const { lang } = useLanguage();
  const router = useRouter();
  const [plans, setPlans] = React.useState<PlanDTO[]>([]);
  const [currentSub, setCurrentSub] = React.useState<CurrentSubscriptionDTO>(null);
  const [loading, setLoading] = React.useState(true);
  const [subscribing, setSubscribing] = React.useState<string | null>(null);
  const [billingCycle, setBillingCycle] = React.useState<"MONTHLY" | "ANNUAL">("ANNUAL");

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

  async function handleSubscribe(planId: string) {
    setSubscribing(planId);
    try {
      await subscribeToPlan({ planId, billingCycle, startTrial: true });
      // Reload data
      const sub = await getCurrentSubscription();
      setCurrentSub(sub);
    } catch (error: unknown) {
      toast.error(
        lang === "ar"
          ? "تعذّر الاشتراك في الخطة. يُرجى المحاولة مرة أخرى."
          : "We couldn't start your subscription. Please try again.",
      );
      console.error(error);
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
          <Button
            variant={billingCycle === "MONTHLY" ? "subtle" : "ghost"}
            size="sm"
            onClick={() => setBillingCycle("MONTHLY")}
            className={`flex-1 rounded-full text-sm font-medium transition-colors ${
              billingCycle === "MONTHLY"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
            style={{ display: "inline-flex" }}
          >
            {t.monthly}
          </Button>
          <Button
            variant={billingCycle === "ANNUAL" ? "subtle" : "ghost"}
            size="sm"
            onClick={() => setBillingCycle("ANNUAL")}
            className={`flex-1 rounded-full text-sm font-medium transition-colors gap-1.5 ${
              billingCycle === "ANNUAL"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
            style={{ display: "inline-flex" }}
          >
            {t.annual}
            <span className="text-[10px] bg-success/10 text-success-strong px-1.5 py-0.5 rounded-full">
              {t.save20}
            </span>
          </Button>
        </div>

        {/* Plan tiers stacked */}
        {plans.map((plan, index) => {
          const Icon = planIcons[index] ?? Crown;
          const isCurrentPlan = currentSub?.planId === plan.id;
          const price = billingCycle === "ANNUAL" ? Number(plan.priceAnnual) : Number(plan.priceMonthly);
          const monthlyEquiv = billingCycle === "ANNUAL" ? Math.round(price / 12) : price;
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
                      value={price}
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
                  {entitlements.map((ent) => {
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
        <ActionLink
          asChild
          leadingIcon={ArrowLeft}
          directional
          className="text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <Link href="/dashboard/billing">{t.backToBilling}</Link>
        </ActionLink>
        <PageHeader title={t.title} description={t.subtitle} />
      </div>

      {/* Billing Cycle Toggle */}
      <div className="inline-flex items-center justify-center gap-1 p-1.5 rounded-full bg-muted mx-auto">
        <Button
          variant={billingCycle === "MONTHLY" ? "subtle" : "ghost"}
          size="sm"
          onClick={() => setBillingCycle("MONTHLY")}
          className={`rounded-full text-sm font-medium whitespace-nowrap px-6 py-2.5 ${
            billingCycle === "MONTHLY"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          style={{ display: "inline-flex" }}
        >
          {t.monthly}
        </Button>
        <Button
          variant={billingCycle === "ANNUAL" ? "subtle" : "ghost"}
          size="sm"
          onClick={() => setBillingCycle("ANNUAL")}
          className={`rounded-full text-sm font-medium whitespace-nowrap gap-2 px-6 py-2.5 ${
            billingCycle === "ANNUAL"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          style={{ display: "inline-flex" }}
        >
          {t.annual}
          <span className="text-xs bg-success/15 text-success-strong px-2 py-0.5 rounded-full whitespace-nowrap">
            {t.save20}
          </span>
        </Button>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {plans.map((plan, index) => {
          const Icon = planIcons[index] ?? Crown;
          const isCurrentPlan = currentSub?.planId === plan.id;
          const price = billingCycle === "ANNUAL" ? Number(plan.priceAnnual) : Number(plan.priceMonthly);
          const monthlyEquiv = billingCycle === "ANNUAL" ? Math.round(price / 12) : price;
          const isPopular = index === 1; // Professional is middle/popular

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
                      <p className="text-3xl font-bold">
                        {monthlyEquiv.toLocaleString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-US")}
                        <span className="text-base font-normal text-muted-foreground"> {t.sar}/{t.month}</span>
                      </p>
                      {billingCycle === "ANNUAL" && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {t.billedAnnually}: {price.toLocaleString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-US")} {t.sar}/{t.year}
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
                {plan.entitlements?.map((ent) => {
                  const granted = ent.type === "BOOLEAN" ? ent.value === "true" :
                    ent.type === "LIMIT" ? ent.value !== "0" : true;

                  return (
                    <div key={ent.featureKey} className="flex items-center gap-2 text-sm">
                      {granted ? (
                        <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
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

function formatEntitlement(ent: EntitlementDTO, lang: "ar" | "en"): string {
  const labels: Record<string, { ar: string; en: string }> = {
    "users.max": { ar: "مستخدمين", en: "Users" },
    "units.max": { ar: "وحدات", en: "Units" },
    "cmms.access": { ar: "نظام إدارة الصيانة", en: "CMMS Maintenance System" },
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
  },
};
