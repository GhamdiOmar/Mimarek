"use client";

import { useLanguage } from "../../../components/LanguageProvider";
import * as React from "react";
import {
  Building2,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
} from "lucide-react";
import { Button, Input, AppBar, DirectionalIcon } from "@repo/ui";
import { cn } from "@repo/ui/lib/utils";
import { useRouter } from "next/navigation";
import { updateOrganization } from "../../actions/organization";
import { createUnit } from "../../actions/units";
import { KSA_CITIES } from "../../../lib/ksa-cities";

// ─── Constants ────────────────────────────────────────────────────────────────

const selectClass =
  "w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const orgTypeOptions = [
  { value: "BROKERAGE", ar: "وساطة عقارية", en: "Brokerage" },
  { value: "PROPERTY_MANAGEMENT", ar: "إدارة أملاك", en: "Property Management" },
  { value: "DEVELOPER", ar: "تطوير عقاري", en: "Developer" },
  { value: "MIXED", ar: "متنوع", en: "Mixed" },
];

const unitTypeOptions = [
  { value: "APARTMENT", ar: "شقة", en: "Apartment" },
  { value: "VILLA", ar: "فيلا", en: "Villa" },
  { value: "OFFICE", ar: "مكتب", en: "Office" },
  { value: "RETAIL", ar: "محل تجاري", en: "Retail" },
  { value: "WAREHOUSE", ar: "مستودع", en: "Warehouse" },
  { value: "LAND", ar: "أرض", en: "Land" },
  { value: "BUILDING", ar: "مبنى", en: "Building" },
  { value: "FLOOR", ar: "طابق", en: "Floor" },
  { value: "STUDIO", ar: "استوديو", en: "Studio" },
  { value: "ROOM", ar: "غرفة", en: "Room" },
  { value: "OTHER", ar: "أخرى", en: "Other" },
];

const steps = [
  { id: "company", label: { ar: "المنشأة", en: "Company" } },
  { id: "property", label: { ar: "العقار", en: "Property" } },
  { id: "done", label: { ar: "تم", en: "Done" } },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const { lang } = useLanguage();
  const router = useRouter();
  const [currentStep, setCurrentStep] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  // ─── Step 1: Company Info ───────────────────────────────────────────────────

  const [companyName, setCompanyName] = React.useState("");
  const [orgType, setOrgType] = React.useState("");

  const handleSaveCompany = async () => {
    if (!companyName.trim()) {
      setError(lang === "ar" ? "يرجى إدخال اسم المنشأة" : "Please enter your company name");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await updateOrganization({ name: companyName.trim() });
      goNext();
    } catch {
      setError(lang === "ar" ? "فشل في حفظ البيانات. يرجى المحاولة مجدداً." : "Failed to save. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ─── Step 2: Add First Property ─────────────────────────────────────────────

  const [unitForm, setUnitForm] = React.useState({
    number: "",
    type: "",
    city: "",
    price: "",
  });

  const setUnit = (key: string, val: string) =>
    setUnitForm((prev) => ({ ...prev, [key]: val }));

  const handleSaveUnit = async () => {
    if (!unitForm.number.trim()) {
      setError(lang === "ar" ? "يرجى إدخال رقم الوحدة" : "Please enter a unit number");
      return;
    }
    if (!unitForm.type) {
      setError(lang === "ar" ? "يرجى اختيار نوع الوحدة" : "Please select a unit type");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await createUnit({
        number: unitForm.number.trim(),
        type: unitForm.type as any,
        price: unitForm.price ? Number(unitForm.price) : undefined,
        status: "AVAILABLE" as any,
      });
      goNext();
    } catch (err: any) {
      setError(
        err?.message?.includes("limit")
          ? lang === "ar"
            ? "لقد وصلت إلى الحد الأقصى للوحدات في خطتك الحالية. يرجى ترقية اشتراكك."
            : "You've reached the unit limit for your plan. Please upgrade."
          : lang === "ar"
            ? "فشل في إضافة الوحدة. يرجى المحاولة مجدداً."
            : "Failed to add property. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSkipUnit = () => {
    setError("");
    goNext();
  };

  // ─── Navigation ─────────────────────────────────────────────────────────────

  const goNext = () => {
    setError("");
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const goPrev = () => {
    setError("");
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const currentStepId = steps[currentStep]?.id;
  const currentStepObj = steps[currentStep];
  const isLast = currentStep === steps.length - 1;
  const progressPct = ((currentStep) / (steps.length - 1)) * 100;

  const handleMobilePrimary = () => {
    if (currentStepId === "company") return handleSaveCompany();
    if (currentStepId === "property") return handleSaveUnit();
    if (currentStepId === "done") return router.push("/dashboard/crm");
  };

  const primaryLabel = React.useMemo(() => {
    if (currentStepId === "company") {
      return lang === "ar" ? "حفظ ومتابعة" : "Save & Continue";
    }
    if (currentStepId === "property") {
      return lang === "ar" ? "إضافة ومتابعة" : "Add & Continue";
    }
    return lang === "ar" ? "الذهاب إلى CRM" : "Go to CRM";
  }, [currentStepId, lang]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
    {/* ─── Mobile (< md) ──────────────────────────────────────────────── */}
    <div
      dir={lang === "ar" ? "rtl" : "ltr"}
      className="md:hidden -m-4 sm:-m-6 min-h-dvh flex flex-col bg-background"
    >
      <AppBar
        title={currentStepObj ? currentStepObj.label[lang] : (lang === "ar" ? "إعداد الحساب" : "Setup")}
        subtitle={
          lang === "ar"
            ? `الخطوة ${currentStep + 1} من ${steps.length}`
            : `Step ${currentStep + 1} of ${steps.length}`
        }
        lang={lang}
      />

      {/* Progress bar */}
      <div className="h-1 w-full bg-muted">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5 pb-[calc(theme(height.mobile-bottomnav)+env(safe-area-inset-bottom)+7rem)]">
        {error && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {currentStepId === "company" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {lang === "ar" ? "معلومات المنشأة" : "Company Info"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {lang === "ar"
                  ? "أدخل اسم منشأتك ونوع نشاطها."
                  : "Enter your company name and business type."}
              </p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {lang === "ar" ? "اسم المنشأة" : "Company Name"}
                  <span className="text-destructive ms-1">*</span>
                </label>
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder={lang === "ar" ? "مثال: شركة الأفق العقارية" : "e.g. Al Ufuq Real Estate"}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {lang === "ar" ? "نوع النشاط" : "Business Type"}
                </label>
                <select
                  value={orgType}
                  onChange={(e) => setOrgType(e.target.value)}
                  className="w-full h-11 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">{lang === "ar" ? "اختر نوع النشاط..." : "Select business type..."}</option>
                  {orgTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {lang === "ar" ? opt.ar : opt.en}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {currentStepId === "property" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {lang === "ar" ? "إضافة أول عقار" : "Add First Property"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {lang === "ar"
                  ? "أضف أول وحدة عقارية في منصتك."
                  : "Add your first property unit to the platform."}
              </p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {lang === "ar" ? "رقم الوحدة" : "Unit Number"}
                  <span className="text-destructive ms-1">*</span>
                </label>
                <Input
                  value={unitForm.number}
                  onChange={(e) => setUnit("number", e.target.value)}
                  placeholder={lang === "ar" ? "مثال: A-101" : "e.g. A-101"}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {lang === "ar" ? "نوع الوحدة" : "Unit Type"}
                  <span className="text-destructive ms-1">*</span>
                </label>
                <select
                  value={unitForm.type}
                  onChange={(e) => setUnit("type", e.target.value)}
                  className="w-full h-11 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">{lang === "ar" ? "اختر النوع..." : "Select type..."}</option>
                  {unitTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt[lang]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {lang === "ar" ? "المدينة" : "City"}
                </label>
                <select
                  value={unitForm.city}
                  onChange={(e) => setUnit("city", e.target.value)}
                  className="w-full h-11 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">{lang === "ar" ? "اختر المدينة..." : "Select city..."}</option>
                  {KSA_CITIES.map((city) => (
                    <option key={city.value} value={city.value}>
                      {lang === "ar" ? city.labelAr : city.labelEn}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {lang === "ar" ? "السعر (ريال)" : "Price (SAR)"}
                </label>
                <Input
                  value={unitForm.price}
                  onChange={(e) =>
                    setUnit("price", e.target.value.replace(/[^\d.]/g, ""))
                  }
                  placeholder={lang === "ar" ? "مثال: 500000" : "e.g. 500000"}
                  dir="ltr"
                  className="h-11 font-latin tabular-nums"
                  type="number"
                  min="0"
                  inputMode="numeric"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleSkipUnit}
              disabled={loading}
              className="w-full min-h-11 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {lang === "ar" ? "تخطي هذه الخطوة" : "Skip this step"}
            </button>
          </div>
        )}

        {currentStepId === "done" && (
          <div className="flex flex-col items-center justify-center py-10 space-y-5 animate-in fade-in duration-300">
            <div className="h-20 w-20 rounded-full bg-success/15 flex items-center justify-center">
              <Check className="h-10 w-10 text-success" aria-hidden="true" />
            </div>
            <div className="text-center space-y-2 max-w-sm">
              <h2 className="text-xl font-bold text-foreground">
                {lang === "ar" ? "تم إعداد حسابك بنجاح!" : "Your account is ready!"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {lang === "ar"
                  ? "يمكنك الآن الانتقال إلى لوحة التحكم وإدارة عملائك وعقاراتك."
                  : "You can now go to the dashboard and manage your customers and properties."}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Sticky bottom CTA bar */}
      <div
        className="fixed inset-x-0 z-30 bg-card/95 backdrop-blur-md border-t border-border p-4"
        style={{
          bottom: "calc(var(--height-mobile-bottomnav, 4rem) + env(safe-area-inset-bottom))",
          paddingBottom: "1rem",
        }}
      >
        <div className="flex items-center gap-2">
          {currentStep > 0 && !isLast && (
            <Button
              variant="outline"
              className="min-h-11 gap-2"
              style={{ display: "inline-flex" }}
              onClick={goPrev}
              disabled={loading}
            >
              <DirectionalIcon icon={ArrowLeft} className="h-4 w-4" aria-hidden="true" />
              {lang === "ar" ? "السابق" : "Back"}
            </Button>
          )}
          <Button
            className="flex-1 min-h-11 gap-2"
            style={{ display: "inline-flex" }}
            onClick={handleMobilePrimary}
            disabled={loading}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {primaryLabel}
            {!isLast && !loading && <DirectionalIcon icon={ArrowRight} className="h-4 w-4" aria-hidden="true" />}
          </Button>
        </div>
      </div>
    </div>

    {/* ─── Desktop (≥ md) ─ unchanged ───────────────────────────────── */}
    <div className="hidden md:block">
    <div
      dir={lang === "ar" ? "rtl" : "ltr"}
      className="min-h-screen bg-muted/30"
    >
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8 animate-in fade-in duration-500">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-primary">
            {lang === "ar" ? "إعداد حسابك" : "Set Up Your Account"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lang === "ar"
              ? "أكمل الخطوات التالية لتفعيل حسابك على ميماريك."
              : "Complete the following steps to activate your Mimaric account."}
          </p>
        </div>

        {/* Stepper */}
        <div className="relative h-1 bg-muted rounded-full mx-8">
          <div
            className="absolute h-full bg-secondary rounded-full transition-all duration-500"
            style={{
              width: `${(currentStep / (steps.length - 1)) * 100}%`,
              [lang === "ar" ? "right" : "left"]: 0,
            }}
          />
          <div className="absolute top-1/2 -translate-y-1/2 w-full flex justify-between">
            {steps.map((step, i) => (
              <div key={step.id} className="relative flex flex-col items-center">
                <div
                  className={cn(
                    "h-9 w-9 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all duration-300",
                    i < currentStep
                      ? "bg-success border-success text-white"
                      : i === currentStep
                        ? "bg-secondary border-secondary text-white"
                        : "bg-card border-border text-muted-foreground"
                  )}
                >
                  {i < currentStep ? (
                    <Check className="h-[18px] w-[18px]" />
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={cn(
                    "absolute top-12 whitespace-nowrap text-[10px] font-bold uppercase tracking-widest",
                    i === currentStep
                      ? "text-primary"
                      : i < currentStep
                        ? "text-success"
                        : "text-muted-foreground"
                  )}
                >
                  {step.label[lang]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="pt-10">
          <div className="bg-card rounded-xl border border-border shadow-sm p-8 min-h-[400px]">
            {/* Error Banner */}
            {error && (
              <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
                {error}
              </div>
            )}

            {/* ─── Step 1: Company Info ─── */}
            {currentStepId === "company" && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-primary">
                    {lang === "ar" ? "معلومات المنشأة" : "Company Info"}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {lang === "ar"
                      ? "أدخل اسم منشأتك ونوع نشاطها."
                      : "Enter your company name and business type."}
                  </p>
                </div>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {lang === "ar" ? "اسم المنشأة" : "Company Name"}
                      <span className="text-destructive ms-1">*</span>
                    </label>
                    <Input
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder={lang === "ar" ? "مثال: شركة الأفق العقارية" : "e.g. Al Ufuq Real Estate"}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {lang === "ar" ? "نوع النشاط" : "Business Type"}
                    </label>
                    <select
                      value={orgType}
                      onChange={(e) => setOrgType(e.target.value)}
                      className={selectClass}
                    >
                      <option value="">{lang === "ar" ? "اختر نوع النشاط..." : "Select business type..."}</option>
                      {orgTypeOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.ar} / {opt.en}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end pt-6 border-t border-border">
                  <Button
                    onClick={handleSaveCompany}
                    disabled={loading}
                    className="gap-2 px-8"
                    style={{ display: "inline-flex" }}
                  >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {lang === "ar" ? "حفظ ومتابعة" : "Save & Continue"}
                    <DirectionalIcon icon={ArrowRight} className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* ─── Step 2: Add First Property ─── */}
            {currentStepId === "property" && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-primary">
                    {lang === "ar" ? "إضافة أول عقار" : "Add First Property"}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {lang === "ar"
                      ? "أضف أول وحدة عقارية في منصتك."
                      : "Add your first property unit to the platform."}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {lang === "ar" ? "رقم الوحدة" : "Unit Number"}
                      <span className="text-destructive ms-1">*</span>
                    </label>
                    <Input
                      value={unitForm.number}
                      onChange={(e) => setUnit("number", e.target.value)}
                      placeholder={lang === "ar" ? "مثال: A-101" : "e.g. A-101"}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {lang === "ar" ? "نوع الوحدة" : "Unit Type"}
                      <span className="text-destructive ms-1">*</span>
                    </label>
                    <select
                      value={unitForm.type}
                      onChange={(e) => setUnit("type", e.target.value)}
                      className={selectClass}
                    >
                      <option value="">{lang === "ar" ? "اختر النوع..." : "Select type..."}</option>
                      {unitTypeOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt[lang]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {lang === "ar" ? "المدينة" : "City"}
                    </label>
                    <select
                      value={unitForm.city}
                      onChange={(e) => setUnit("city", e.target.value)}
                      className={selectClass}
                    >
                      <option value="">{lang === "ar" ? "اختر المدينة..." : "Select city..."}</option>
                      {KSA_CITIES.map((city) => (
                        <option key={city.value} value={city.value}>
                          {city.labelAr} / {city.labelEn}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {lang === "ar" ? "السعر (ريال)" : "Price (SAR)"}
                    </label>
                    <Input
                      value={unitForm.price}
                      onChange={(e) =>
                        setUnit("price", e.target.value.replace(/[^\d.]/g, ""))
                      }
                      placeholder={lang === "ar" ? "مثال: 500000" : "e.g. 500000"}
                      dir="ltr"
                      className="font-latin text-sm"
                      type="number"
                      min="0"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-6 border-t border-border">
                  <Button
                    variant="ghost"
                    onClick={goPrev}
                    disabled={loading}
                    className="gap-2"
                    style={{ display: "inline-flex" }}
                  >
                    <DirectionalIcon icon={ArrowLeft} className="h-4 w-4" />
                    {lang === "ar" ? "السابق" : "Previous"}
                  </Button>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      onClick={handleSkipUnit}
                      disabled={loading}
                      style={{ display: "inline-flex" }}
                    >
                      {lang === "ar" ? "تخطي" : "Skip"}
                    </Button>
                    <Button
                      onClick={handleSaveUnit}
                      disabled={loading}
                      className="gap-2 px-8"
                      style={{ display: "inline-flex" }}
                    >
                      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                      {lang === "ar" ? "إضافة ومتابعة" : "Add & Continue"}
                      <DirectionalIcon icon={ArrowRight} className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* ─── Step 3: Done ─── */}
            {currentStepId === "done" && (
              <div className="flex flex-col items-center justify-center py-12 space-y-6 animate-in slide-in-from-right-4 duration-500">
                <div className="h-20 w-20 rounded-full bg-success/15 flex items-center justify-center">
                  <Check className="h-10 w-10 text-success" />
                </div>
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-bold text-primary">
                    {lang === "ar" ? "تم إعداد حسابك بنجاح!" : "Your account is ready!"}
                  </h2>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    {lang === "ar"
                      ? "يمكنك الآن الانتقال إلى لوحة التحكم وإدارة عملائك وعقاراتك."
                      : "You can now go to the dashboard and manage your customers and properties."}
                  </p>
                </div>
                <div className="flex items-center gap-4 pt-2">
                  <Button
                    onClick={() => router.push("/dashboard/crm")}
                    className="gap-2 px-8"
                    style={{ display: "inline-flex" }}
                  >
                    {lang === "ar" ? "الذهاب إلى CRM" : "Go to CRM"}
                    <DirectionalIcon icon={ArrowRight} className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </div>
    </>
  );
}
