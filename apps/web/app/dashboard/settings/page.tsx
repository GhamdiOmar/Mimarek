"use client";

import { useLanguage } from "../../../components/LanguageProvider";
import * as React from "react";
import {
  Building2,
  Pencil,
  CheckCircle2,
  CreditCard,
  Briefcase,
  ShieldCheck,
  MapPin,
  Phone,
  Globe,
  ClipboardList,
  Lock,
  Users,
  Home,
  Save,
  RefreshCw,
  Loader2,
  Trash2,
} from "lucide-react";
import {
  Button,
  Input,
  PageHeader,
  FormSection,
  AppBar,
  FAB,
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  CRInput,
  SaudiPhoneInput,
} from "@repo/ui";
import Link from "next/link";
import { toast } from "sonner";
import { getOrganization, updateOrganization, clearAppCache } from "../../actions/organization";
import { usePermissions } from "../../../hooks/usePermissions";
import { getUserPreferences, updateLandingPage } from "../../actions/preferences";

const selectClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export default function OrgSettingsPage() {
  const { can } = usePermissions();
  const { lang } = useLanguage();
  const [org, setOrg] = React.useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [landingPage, setLandingPage] = React.useState("/dashboard");
  const [savingLanding, setSavingLanding] = React.useState(false);
  const [clearingCache, setClearingCache] = React.useState(false);

  // Form state
  const [form, setForm] = React.useState({
    name: "",
    nameArabic: "",
    nameEnglish: "",
    tradeNameArabic: "",
    tradeNameEnglish: "",
    crNumber: "",
    unifiedNumber: "",
    vatNumber: "",
    entityType: "",
    legalForm: "",
    registrationStatus: "",
    registrationDate: "",
    expiryDate: "",
    capitalAmountSar: "",
    mainActivityCode: "",
    mainActivityNameAr: "",
    contactMobile: "",
    contactPhone: "",
    contactEmail: "",
    contactWebsite: "",
    addrRegion: "",
    addrCity: "",
    addrDistrict: "",
    addrStreet: "",
    addrBuilding: "",
    addrPostal: "",
    addrAdditional: "",
    addrShort: "",
  });

  const [fieldErrors, setFieldErrors] = React.useState<Record<string, boolean>>({});

  const set = (key: string, val: string) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    if (fieldErrors[key]) setFieldErrors((prev) => ({ ...prev, [key]: false }));
  };

  React.useEffect(() => {
    getUserPreferences()
      .then((prefs) => {
        if (prefs.landingPage) setLandingPage(prefs.landingPage);
      })
      .catch(() => {});
    getOrganization()
      .then((data: Record<string, unknown> | null) => {
        if (data) {
          setOrg(data);
          const ci = (data.contactInfo as Record<string, string>) || {};
          const na = (data.nationalAddress as Record<string, string>) || {};
          setForm({
            name: (data.name as string) || "",
            nameArabic: (data.nameArabic as string) || "",
            nameEnglish: (data.nameEnglish as string) || "",
            tradeNameArabic: (data.tradeNameArabic as string) || "",
            tradeNameEnglish: (data.tradeNameEnglish as string) || "",
            crNumber: (data.crNumber as string) || "",
            unifiedNumber: (data.unifiedNumber as string) || "",
            vatNumber: (data.vatNumber as string) || "",
            entityType: (data.entityType as string) || "",
            legalForm: (data.legalForm as string) || "",
            registrationStatus: (data.registrationStatus as string) || "",
            registrationDate: data.registrationDate
              ? (String(data.registrationDate).split("T")[0] ?? "")
              : "",
            expiryDate: data.expiryDate
              ? (String(data.expiryDate).split("T")[0] ?? "")
              : "",
            capitalAmountSar: data.capitalAmountSar
              ? String(Number(data.capitalAmountSar))
              : "",
            mainActivityCode: (data.mainActivityCode as string) || "",
            mainActivityNameAr: (data.mainActivityNameAr as string) || "",
            contactMobile: ci.mobileNumber || "",
            contactPhone: ci.phoneNumber || "",
            contactEmail: ci.email || "",
            contactWebsite: ci.websiteUrl || "",
            addrRegion: na.region || "",
            addrCity: na.city || "",
            addrDistrict: na.district || "",
            addrStreet: na.streetName || "",
            addrBuilding: na.buildingNumber || "",
            addrPostal: na.postalCode || "",
            addrAdditional: na.additionalNumber || "",
            addrShort: na.shortAddress || "",
          });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const requiredFields = ["name"] as const;
  const handleSave = async () => {
    const errors: Record<string, boolean> = {};
    for (const key of requiredFields) {
      if (!form[key].trim()) errors[key] = true;
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      const updated = await updateOrganization({
        name: form.name,
        nameArabic: form.nameArabic || undefined,
        nameEnglish: form.nameEnglish || undefined,
        tradeNameArabic: form.tradeNameArabic || undefined,
        tradeNameEnglish: form.tradeNameEnglish || undefined,
        crNumber: form.crNumber || undefined,
        unifiedNumber: form.unifiedNumber || undefined,
        vatNumber: form.vatNumber || undefined,
        entityType: form.entityType || undefined,
        legalForm: form.legalForm || undefined,
        registrationStatus: form.registrationStatus || undefined,
        registrationDate: form.registrationDate || undefined,
        expiryDate: form.expiryDate || undefined,
        capitalAmountSar: form.capitalAmountSar ? Number(form.capitalAmountSar) : undefined,
        mainActivityCode: form.mainActivityCode || undefined,
        mainActivityNameAr: form.mainActivityNameAr || undefined,
        contactInfo: {
          mobileNumber: form.contactMobile,
          phoneNumber: form.contactPhone,
          email: form.contactEmail,
          websiteUrl: form.contactWebsite,
        },
        nationalAddress: {
          region: form.addrRegion,
          city: form.addrCity,
          district: form.addrDistrict,
          streetName: form.addrStreet,
          buildingNumber: form.addrBuilding,
          postalCode: form.addrPostal,
          additionalNumber: form.addrAdditional,
          shortAddress: form.addrShort,
        },
      });
      setOrg(updated as Record<string, unknown>);
    } catch (err: unknown) {
      console.error("Failed to save organization settings:", err);
      toast.error(
        lang === "ar"
          ? "تعذّر حفظ التغييرات. يرجى المحاولة مرة أخرى أو التواصل مع الدعم."
          : "We couldn't save your changes. Try again or contact support.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* ─── Mobile (< md) ─────────────────────────────────────────────── */}
      <div
        className="md:hidden -m-4 sm:-m-6 min-h-dvh flex flex-col bg-background"
        dir={lang === "ar" ? "rtl" : "ltr"}
      >
        <AppBar
          title={lang === "ar" ? "إعدادات المؤسسة" : "Organization settings"}
          subtitle={
            lang === "ar"
              ? "الملف التعريفي والبيانات التجارية"
              : "Profile & commercial data"
          }
          lang={lang}
        />

        <div className="flex-1 px-4 py-4 pb-28 space-y-4">
          {/* Header identity card */}
          <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
            <div className="h-14 w-14 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Building2 className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold text-foreground truncate">
                {form.name || "\u2014"}
              </p>
              <p className="text-[11px] text-muted-foreground font-latin truncate">
                {form.tradeNameEnglish || "Mimaric"}
                {org?.type ? ` · ${org.type as string}` : ""}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground animate-pulse">
              {lang === "ar" ? "جاري التحميل..." : "Loading..."}
            </div>
          ) : (
            <Accordion type="multiple" className="rounded-lg border border-border bg-card divide-y divide-border">
              {/* Core Identity */}
              <AccordionItem value="core" className="border-0 px-4">
                <AccordionTrigger className="py-4 text-sm font-semibold text-foreground hover:no-underline">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Building2 className="h-4 w-4" />
                    </span>
                    {lang === "ar" ? "البيانات الأساسية" : "Core Identity"}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {lang === "ar" ? "اسم المنظمة" : "Organization Name"} *
                      </label>
                      <Input
                        value={form.name}
                        onChange={(e) => set("name", e.target.value)}
                        className={`h-11 ${fieldErrors.name ? "border-destructive focus-visible:ring-destructive" : ""}`}
                      />
                      {fieldErrors.name && (
                        <p className="text-xs text-destructive">
                          {lang === "ar" ? "هذا الحقل مطلوب" : "This field is required"}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {lang === "ar" ? "الاسم بالعربي" : "Official Arabic Name"}
                      </label>
                      <Input className="h-11" value={form.nameArabic} onChange={(e) => set("nameArabic", e.target.value)} dir="rtl" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {lang === "ar" ? "الاسم بالإنجليزي" : "Official English Name"}
                      </label>
                      <Input className="h-11" value={form.nameEnglish} onChange={(e) => set("nameEnglish", e.target.value)} dir="ltr" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {lang === "ar" ? "رقم السجل التجاري" : "Commercial Registration"}
                      </label>
                      <CRInput className="h-11" placeholder="1010XXXXXX" value={form.crNumber} onChange={(raw) => set("crNumber", raw)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {lang === "ar" ? "الرقم الضريبي" : "VAT Number"}
                      </label>
                      <Input className="h-11 font-latin" placeholder="3000XXXXXX00003" value={form.vatNumber} onChange={(e) => set("vatNumber", e.target.value)} dir="ltr" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {lang === "ar" ? "الرقم الموحد" : "Unified Number"}
                      </label>
                      <Input className="h-11 font-latin" placeholder="70XXXXXXXX" value={form.unifiedNumber} onChange={(e) => set("unifiedNumber", e.target.value)} dir="ltr" />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* MOC */}
              <AccordionItem value="moc" className="border-0 px-4">
                <AccordionTrigger className="py-4 text-sm font-semibold text-foreground hover:no-underline">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Briefcase className="h-4 w-4" />
                    </span>
                    {lang === "ar" ? "بيانات وزارة التجارة" : "Ministry of Commerce"}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {lang === "ar" ? "نوع المنشأة" : "Entity Type"}
                      </label>
                      <select value={form.entityType} onChange={(e) => set("entityType", e.target.value)} className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm">
                        <option value="">{lang === "ar" ? "اختر..." : "Select..."}</option>
                        <option value="ESTABLISHMENT">{lang === "ar" ? "مؤسسة" : "Establishment"}</option>
                        <option value="COMPANY">{lang === "ar" ? "شركة" : "Company"}</option>
                        <option value="BRANCH">{lang === "ar" ? "فرع" : "Branch"}</option>
                        <option value="PROFESSIONAL_ENTITY">{lang === "ar" ? "كيان مهني" : "Professional Entity"}</option>
                        <option value="FOREIGN_COMPANY_BRANCH">{lang === "ar" ? "فرع شركة أجنبية" : "Foreign Company Branch"}</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {lang === "ar" ? "الشكل القانوني" : "Legal Form"}
                      </label>
                      <select value={form.legalForm} onChange={(e) => set("legalForm", e.target.value)} className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm">
                        <option value="">{lang === "ar" ? "اختر..." : "Select..."}</option>
                        <option value="SOLE_PROPRIETORSHIP">{lang === "ar" ? "مؤسسة فردية" : "Sole Proprietorship"}</option>
                        <option value="LIMITED_LIABILITY_COMPANY">{lang === "ar" ? "شركة ذات مسؤولية محدودة" : "LLC"}</option>
                        <option value="JOINT_STOCK_COMPANY">{lang === "ar" ? "شركة مساهمة" : "Joint Stock Company"}</option>
                        <option value="SIMPLIFIED_JOINT_STOCK_COMPANY">{lang === "ar" ? "شركة مساهمة مبسطة" : "Simplified JSC"}</option>
                        <option value="GENERAL_PARTNERSHIP">{lang === "ar" ? "شركة تضامنية" : "General Partnership"}</option>
                        <option value="LIMITED_PARTNERSHIP">{lang === "ar" ? "شركة توصية" : "Limited Partnership"}</option>
                        <option value="PROFESSIONAL_COMPANY">{lang === "ar" ? "شركة مهنية" : "Professional Company"}</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {lang === "ar" ? "حالة التسجيل" : "Registration Status"}
                      </label>
                      <select value={form.registrationStatus} onChange={(e) => set("registrationStatus", e.target.value)} className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm">
                        <option value="">{lang === "ar" ? "اختر..." : "Select..."}</option>
                        <option value="ACTIVE_REG">{lang === "ar" ? "نشط" : "Active"}</option>
                        <option value="EXPIRED_REG">{lang === "ar" ? "منتهي" : "Expired"}</option>
                        <option value="SUSPENDED_REG">{lang === "ar" ? "موقوف" : "Suspended"}</option>
                        <option value="CANCELLED_REG">{lang === "ar" ? "ملغي" : "Cancelled"}</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {lang === "ar" ? "رأس المال (ر.س)" : "Capital (SAR)"}
                      </label>
                      <Input className="h-11 tabular-nums" type="number" value={form.capitalAmountSar} onChange={(e) => set("capitalAmountSar", e.target.value)} dir="ltr" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          {lang === "ar" ? "تاريخ التسجيل" : "Reg. Date"}
                        </label>
                        <Input className="h-11" type="date" value={form.registrationDate} onChange={(e) => set("registrationDate", e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          {lang === "ar" ? "تاريخ الانتهاء" : "Expiry"}
                        </label>
                        <Input className="h-11" type="date" value={form.expiryDate} onChange={(e) => set("expiryDate", e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {lang === "ar" ? "رمز النشاط" : "Activity Code"}
                      </label>
                      <Input className="h-11" value={form.mainActivityCode} onChange={(e) => set("mainActivityCode", e.target.value)} dir="ltr" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {lang === "ar" ? "اسم النشاط" : "Activity Name"}
                      </label>
                      <Input className="h-11" value={form.mainActivityNameAr} onChange={(e) => set("mainActivityNameAr", e.target.value)} />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Contact */}
              <AccordionItem value="contact" className="border-0 px-4">
                <AccordionTrigger className="py-4 text-sm font-semibold text-foreground hover:no-underline">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Phone className="h-4 w-4" />
                    </span>
                    {lang === "ar" ? "بيانات التواصل" : "Contact Information"}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {lang === "ar" ? "رقم الجوال" : "Mobile"}
                      </label>
                      <SaudiPhoneInput className="h-11" placeholder="05XXXXXXXX" value={form.contactMobile} onChange={(e164) => set("contactMobile", e164)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {lang === "ar" ? "الهاتف الثابت" : "Phone"}
                      </label>
                      <SaudiPhoneInput className="h-11" placeholder="011XXXXXXX" value={form.contactPhone} onChange={(e164) => set("contactPhone", e164)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {lang === "ar" ? "البريد الإلكتروني" : "Email"}
                      </label>
                      <Input className="h-11" type="email" placeholder="info@company.sa" value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} dir="ltr" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {lang === "ar" ? "الموقع الإلكتروني" : "Website"}
                      </label>
                      <Input className="h-11" type="url" placeholder="https://company.sa" value={form.contactWebsite} onChange={(e) => set("contactWebsite", e.target.value)} dir="ltr" />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Address */}
              <AccordionItem value="address" className="border-0 px-4">
                <AccordionTrigger className="py-4 text-sm font-semibold text-foreground hover:no-underline">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <MapPin className="h-4 w-4" />
                    </span>
                    {lang === "ar" ? "العنوان الوطني" : "National Address"}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {lang === "ar" ? "المنطقة" : "Region"}
                      </label>
                      <Input className="h-11" value={form.addrRegion} onChange={(e) => set("addrRegion", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {lang === "ar" ? "المدينة" : "City"}
                      </label>
                      <Input className="h-11" value={form.addrCity} onChange={(e) => set("addrCity", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {lang === "ar" ? "الحي" : "District"}
                      </label>
                      <Input className="h-11" value={form.addrDistrict} onChange={(e) => set("addrDistrict", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {lang === "ar" ? "اسم الشارع" : "Street"}
                      </label>
                      <Input className="h-11" value={form.addrStreet} onChange={(e) => set("addrStreet", e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          {lang === "ar" ? "المبنى" : "Building"}
                        </label>
                        <Input className="h-11" value={form.addrBuilding} onChange={(e) => set("addrBuilding", e.target.value)} dir="ltr" maxLength={4} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          {lang === "ar" ? "الرمز البريدي" : "Postal"}
                        </label>
                        <Input className="h-11" value={form.addrPostal} onChange={(e) => set("addrPostal", e.target.value)} dir="ltr" maxLength={5} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {lang === "ar" ? "الرقم الإضافي" : "Additional No."}
                      </label>
                      <Input className="h-11" value={form.addrAdditional} onChange={(e) => set("addrAdditional", e.target.value)} dir="ltr" maxLength={4} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {lang === "ar" ? "العنوان المختصر" : "Short Address"}
                      </label>
                      <Input className="h-11" value={form.addrShort} onChange={(e) => set("addrShort", e.target.value)} dir="ltr" maxLength={8} />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Preferences */}
              <AccordionItem value="preferences" className="border-0 px-4">
                <AccordionTrigger className="py-4 text-sm font-semibold text-foreground hover:no-underline">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Home className="h-4 w-4" />
                    </span>
                    {lang === "ar" ? "التفضيلات" : "Preferences"}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {lang === "ar" ? "الصفحة الرئيسية" : "Landing Page"}
                      </label>
                      <select
                        value={landingPage}
                        onChange={async (e) => {
                          const value = e.target.value;
                          setLandingPage(value);
                          setSavingLanding(true);
                          try {
                            await updateLandingPage(value);
                          } catch {
                            /* ignore */
                          } finally {
                            setSavingLanding(false);
                          }
                        }}
                        className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
                      >
                        <option value="/dashboard">{lang === "ar" ? "نظرة عامة" : "Overview"}</option>
                        <option value="/dashboard/projects">{lang === "ar" ? "المشاريع" : "Projects"}</option>
                        <option value="/dashboard/units">{lang === "ar" ? "الوحدات" : "Units"}</option>
                        <option value="/dashboard/crm">{lang === "ar" ? "العملاء" : "Customers"}</option>
                        <option value="/dashboard/contracts">{lang === "ar" ? "المبيعات" : "Sales"}</option>
                        <option value="/dashboard/leases">{lang === "ar" ? "الإيجارات" : "Leases"}</option>
                        <option value="/dashboard/finance">{lang === "ar" ? "المالية" : "Finance"}</option>
                        <option value="/dashboard/maintenance">{lang === "ar" ? "الصيانة" : "Maintenance"}</option>
                        <option value="/dashboard/reports">{lang === "ar" ? "التقارير" : "Reports"}</option>
                        <option value="/dashboard/settings">{lang === "ar" ? "الإعدادات" : "Settings"}</option>
                      </select>
                      {savingLanding && (
                        <p className="text-[11px] text-muted-foreground">
                          {lang === "ar" ? "جاري الحفظ..." : "Saving..."}
                        </p>
                      )}
                    </div>

                    <Button
                      variant="outline"
                      className="w-full gap-2 min-h-[44px]"
                      style={{ display: "inline-flex" }}
                      disabled={clearingCache}
                      onClick={async () => {
                        setClearingCache(true);
                        try {
                          await clearAppCache();
                          window.location.reload();
                        } finally {
                          setClearingCache(false);
                        }
                      }}
                    >
                      {clearingCache ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      {lang === "ar" ? "مسح الذاكرة المؤقتة" : "Clear Cache"}
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          {/* Related settings */}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <Link
              href="/dashboard/settings/team"
              className="flex items-center gap-3 px-4 py-3 min-h-[44px] border-b border-border hover:bg-muted/30 transition-colors"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {lang === "ar" ? "فريق العمل" : "Team"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {lang === "ar" ? "إدارة الأعضاء والأدوار" : "Manage members & roles"}
                </p>
              </div>
              <span className="text-muted-foreground rtl:scale-x-[-1]">›</span>
            </Link>
            {can("audit:read") && (
              <Link
                href="/dashboard/settings/audit"
                className="flex items-center gap-3 px-4 py-3 min-h-[44px] border-b border-border hover:bg-muted/30 transition-colors"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-info/10 text-info">
                  <ClipboardList className="h-5 w-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {lang === "ar" ? "سجل المراجعة" : "Audit Trail"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {lang === "ar" ? "تتبع الوصول والتعديلات" : "Track access & changes"}
                  </p>
                </div>
                <span className="text-muted-foreground rtl:scale-x-[-1]">›</span>
              </Link>
            )}
            <Link
              href="/dashboard/settings/security"
              className="flex items-center gap-3 px-4 py-3 min-h-[44px] hover:bg-muted/30 transition-colors"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10 text-warning">
                <Lock className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {lang === "ar" ? "الأمان" : "Security"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {lang === "ar" ? "تغيير كلمة المرور" : "Change password"}
                </p>
              </div>
              <span className="text-muted-foreground rtl:scale-x-[-1]">›</span>
            </Link>
          </div>

          <Link
            href="/dashboard/onboarding?mode=edit"
            className="flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors py-3"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {lang === "ar" ? "إعادة تشغيل معالج الإعداد" : "Re-run Setup Wizard"}
          </Link>
        </div>

        <FAB
          icon={saving ? Loader2 : Save}
          label={
            saving
              ? (lang === "ar" ? "جاري الحفظ..." : "Saving...")
              : (lang === "ar" ? "حفظ التغييرات" : "Save Changes")
          }
          onClick={saving ? undefined : handleSave}
        />
      </div>

      {/* ─── Desktop (≥ md) ────────────────────────────────────────────── */}
      <div className="hidden md:block space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title={lang === "ar" ? "إعدادات المنظمة" : "Organization Settings"}
        description={
          lang === "ar"
            ? "إدارة الملف التعريفي والبيانات التجارية لمنشأتك."
            : "Manage your organization's profile and commercial data."
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className={`lg:col-span-2 space-y-6 ${loading ? "animate-pulse" : ""}`}>
          {/* Organization Identity Card */}
          <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
            <div className="p-8 border-b border-border bg-muted/5">
              <div className="flex items-center gap-6">
                <div className="h-20 w-20 rounded-md bg-primary-deep flex items-center justify-center text-secondary relative group cursor-pointer border-2 border-primary/5">
                  <Building2 className="h-10 w-10" />
                  <div className="absolute inset-0 bg-primary/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-sm">
                    <Pencil className="h-5 w-5 text-white" />
                  </div>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">
                    {form.name || "\u2014"}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest font-latin">
                    {form.tradeNameEnglish || "Mimaric"} &bull;{" "}
                    {(org?.type as string) ?? "Developer"}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-8 space-y-6">
              {/* Core Identity */}
              <FormSection
                title={lang === "ar" ? "البيانات الأساسية" : "Core Identity"}
                description={
                  lang === "ar"
                    ? "الاسم الرسمي وأرقام التسجيل"
                    : "Official name and registration numbers"
                }
              >
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    {lang === "ar" ? "اسم المنظمة" : "Organization Name"} *
                  </label>
                  <Input
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    className={fieldErrors.name ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {fieldErrors.name && (
                    <p className="text-xs text-destructive">
                      {lang === "ar" ? "هذا الحقل مطلوب" : "This field is required"}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {lang === "ar" ? "الاسم الرسمي بالعربي" : "Official Arabic Name"}
                    </label>
                    <Input
                      value={form.nameArabic}
                      onChange={(e) => set("nameArabic", e.target.value)}
                      dir="rtl"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {lang === "ar" ? "الاسم الرسمي بالإنجليزي" : "Official English Name"}
                    </label>
                    <Input
                      value={form.nameEnglish}
                      onChange={(e) => set("nameEnglish", e.target.value)}
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {lang === "ar" ? "رقم السجل التجاري (CR)" : "Commercial Registration"}
                    </label>
                    <CRInput
                      placeholder="1010XXXXXX"
                      className="text-sm"
                      value={form.crNumber}
                      onChange={(raw) => set("crNumber", raw)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {lang === "ar" ? "الرقم الضريبي (VAT)" : "VAT Number"}
                    </label>
                    <div className="relative">
                      <Briefcase
                        className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      />
                      <Input
                        placeholder="3000XXXXXX00003"
                        className="pr-10 font-latin text-sm"
                        value={form.vatNumber}
                        onChange={(e) => set("vatNumber", e.target.value)}
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    {lang === "ar" ? "الرقم الموحد" : "Unified Number"}
                  </label>
                  <Input
                    placeholder="70XXXXXXXX"
                    className="font-latin text-sm"
                    value={form.unifiedNumber}
                    onChange={(e) => set("unifiedNumber", e.target.value)}
                    dir="ltr"
                  />
                </div>
              </FormSection>

              {/* MOC Section */}
              <FormSection
                title={
                  lang === "ar"
                    ? "بيانات وزارة التجارة (MOC)"
                    : "Ministry of Commerce Data (MOC)"
                }
                description={
                  lang === "ar"
                    ? "نوع المنشأة والشكل القانوني والنشاط"
                    : "Entity type, legal form, and activity details"
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {lang === "ar" ? "نوع المنشأة" : "Entity Type"}
                    </label>
                    <select
                      value={form.entityType}
                      onChange={(e) => set("entityType", e.target.value)}
                      className={selectClass}
                    >
                      <option value="">{lang === "ar" ? "اختر..." : "Select..."}</option>
                      <option value="ESTABLISHMENT">
                        {lang === "ar" ? "مؤسسة" : "Establishment"}
                      </option>
                      <option value="COMPANY">{lang === "ar" ? "شركة" : "Company"}</option>
                      <option value="BRANCH">{lang === "ar" ? "فرع" : "Branch"}</option>
                      <option value="PROFESSIONAL_ENTITY">
                        {lang === "ar" ? "كيان مهني" : "Professional Entity"}
                      </option>
                      <option value="FOREIGN_COMPANY_BRANCH">
                        {lang === "ar" ? "فرع شركة أجنبية" : "Foreign Company Branch"}
                      </option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {lang === "ar" ? "الشكل القانوني" : "Legal Form"}
                    </label>
                    <select
                      value={form.legalForm}
                      onChange={(e) => set("legalForm", e.target.value)}
                      className={selectClass}
                    >
                      <option value="">{lang === "ar" ? "اختر..." : "Select..."}</option>
                      <option value="SOLE_PROPRIETORSHIP">
                        {lang === "ar" ? "مؤسسة فردية" : "Sole Proprietorship"}
                      </option>
                      <option value="LIMITED_LIABILITY_COMPANY">
                        {lang === "ar" ? "شركة ذات مسؤولية محدودة" : "LLC"}
                      </option>
                      <option value="JOINT_STOCK_COMPANY">
                        {lang === "ar" ? "شركة مساهمة" : "Joint Stock Company"}
                      </option>
                      <option value="SIMPLIFIED_JOINT_STOCK_COMPANY">
                        {lang === "ar" ? "شركة مساهمة مبسطة" : "Simplified JSC"}
                      </option>
                      <option value="GENERAL_PARTNERSHIP">
                        {lang === "ar" ? "شركة تضامنية" : "General Partnership"}
                      </option>
                      <option value="LIMITED_PARTNERSHIP">
                        {lang === "ar" ? "شركة توصية" : "Limited Partnership"}
                      </option>
                      <option value="PROFESSIONAL_COMPANY">
                        {lang === "ar" ? "شركة مهنية" : "Professional Company"}
                      </option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {lang === "ar" ? "حالة التسجيل" : "Registration Status"}
                    </label>
                    <select
                      value={form.registrationStatus}
                      onChange={(e) => set("registrationStatus", e.target.value)}
                      className={selectClass}
                    >
                      <option value="">{lang === "ar" ? "اختر..." : "Select..."}</option>
                      <option value="ACTIVE_REG">
                        {lang === "ar" ? "نشط" : "Active"}
                      </option>
                      <option value="EXPIRED_REG">
                        {lang === "ar" ? "منتهي" : "Expired"}
                      </option>
                      <option value="SUSPENDED_REG">
                        {lang === "ar" ? "موقوف" : "Suspended"}
                      </option>
                      <option value="CANCELLED_REG">
                        {lang === "ar" ? "ملغي" : "Cancelled"}
                      </option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {lang === "ar" ? "رأس المال (ر.س)" : "Capital (SAR)"}
                    </label>
                    <Input
                      type="number"
                      value={form.capitalAmountSar}
                      onChange={(e) => set("capitalAmountSar", e.target.value)}
                      placeholder="500000"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {lang === "ar" ? "تاريخ التسجيل" : "Registration Date"}
                    </label>
                    <Input
                      type="date"
                      value={form.registrationDate}
                      onChange={(e) => set("registrationDate", e.target.value)}
                      className="font-dm-sans"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {lang === "ar" ? "تاريخ الانتهاء" : "Expiry Date"}
                    </label>
                    <Input
                      type="date"
                      value={form.expiryDate}
                      onChange={(e) => set("expiryDate", e.target.value)}
                      className="font-dm-sans"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {lang === "ar" ? "رمز النشاط" : "Activity Code"}
                    </label>
                    <Input
                      value={form.mainActivityCode}
                      onChange={(e) => set("mainActivityCode", e.target.value)}
                      placeholder="411001"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {lang === "ar" ? "اسم النشاط" : "Activity Name"}
                    </label>
                    <Input
                      value={form.mainActivityNameAr}
                      onChange={(e) => set("mainActivityNameAr", e.target.value)}
                      placeholder={
                        lang === "ar" ? "التطوير العقاري" : "Real Estate Development"
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {lang === "ar" ? "الاسم التجاري بالعربي" : "Trade Name (Arabic)"}
                    </label>
                    <Input
                      value={form.tradeNameArabic}
                      onChange={(e) => set("tradeNameArabic", e.target.value)}
                      dir="rtl"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {lang === "ar" ? "الاسم التجاري بالإنجليزي" : "Trade Name (English)"}
                    </label>
                    <Input
                      value={form.tradeNameEnglish}
                      onChange={(e) => set("tradeNameEnglish", e.target.value)}
                      dir="ltr"
                    />
                  </div>
                </div>
              </FormSection>

              {/* Contact Information */}
              <FormSection
                title={lang === "ar" ? "بيانات التواصل" : "Contact Information"}
                description={
                  lang === "ar"
                    ? "أرقام الهاتف والبريد والموقع الإلكتروني"
                    : "Phone numbers, email, and website"
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {lang === "ar" ? "رقم الجوال" : "Mobile"}
                    </label>
                    <SaudiPhoneInput
                      value={form.contactMobile}
                      onChange={(e164) => set("contactMobile", e164)}
                      placeholder="05XXXXXXXX"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {lang === "ar" ? "الهاتف الثابت" : "Phone"}
                    </label>
                    <SaudiPhoneInput
                      value={form.contactPhone}
                      onChange={(e164) => set("contactPhone", e164)}
                      placeholder="011XXXXXXX"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {lang === "ar" ? "البريد الإلكتروني" : "Email"}
                    </label>
                    <Input
                      value={form.contactEmail}
                      onChange={(e) => set("contactEmail", e.target.value)}
                      placeholder="info@company.sa"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {lang === "ar" ? "الموقع الإلكتروني" : "Website"}
                    </label>
                    <Input
                      value={form.contactWebsite}
                      onChange={(e) => set("contactWebsite", e.target.value)}
                      placeholder="https://company.sa"
                      dir="ltr"
                    />
                  </div>
                </div>
              </FormSection>

              {/* National Address */}
              <FormSection
                title={lang === "ar" ? "العنوان الوطني" : "National Address"}
                description={
                  lang === "ar"
                    ? "عنوان المنشأة حسب نظام العنوان الوطني"
                    : "Registered address per Saudi National Address system"
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {lang === "ar" ? "المنطقة" : "Region"}
                    </label>
                    <Input
                      value={form.addrRegion}
                      onChange={(e) => set("addrRegion", e.target.value)}
                      placeholder={lang === "ar" ? "منطقة الرياض" : "Riyadh Region"}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {lang === "ar" ? "المدينة" : "City"}
                    </label>
                    <Input
                      value={form.addrCity}
                      onChange={(e) => set("addrCity", e.target.value)}
                      placeholder={lang === "ar" ? "الرياض" : "Riyadh"}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {lang === "ar" ? "الحي" : "District"}
                    </label>
                    <Input
                      value={form.addrDistrict}
                      onChange={(e) => set("addrDistrict", e.target.value)}
                      placeholder={lang === "ar" ? "العليا" : "Al Olaya"}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {lang === "ar" ? "اسم الشارع" : "Street"}
                    </label>
                    <Input
                      value={form.addrStreet}
                      onChange={(e) => set("addrStreet", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {lang === "ar" ? "رقم المبنى" : "Building No."}
                    </label>
                    <Input
                      value={form.addrBuilding}
                      onChange={(e) => set("addrBuilding", e.target.value)}
                      placeholder="1234"
                      dir="ltr"
                      maxLength={4}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {lang === "ar" ? "الرمز البريدي" : "Postal Code"}
                    </label>
                    <Input
                      value={form.addrPostal}
                      onChange={(e) => set("addrPostal", e.target.value)}
                      placeholder="12211"
                      dir="ltr"
                      maxLength={5}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {lang === "ar" ? "الرقم الإضافي" : "Additional No."}
                    </label>
                    <Input
                      value={form.addrAdditional}
                      onChange={(e) => set("addrAdditional", e.target.value)}
                      placeholder="5678"
                      dir="ltr"
                      maxLength={4}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {lang === "ar" ? "العنوان المختصر" : "Short Address"}
                    </label>
                    <Input
                      value={form.addrShort}
                      onChange={(e) => set("addrShort", e.target.value)}
                      placeholder="ABCD1234"
                      dir="ltr"
                      maxLength={8}
                    />
                  </div>
                </div>
              </FormSection>

              {/* Save Button */}
              <div className="flex items-center justify-between">
                <Link
                  href="/dashboard/onboarding?mode=edit"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {lang === "ar" ? "إعادة تشغيل معالج الإعداد" : "Re-run Setup Wizard"}
                </Link>
                <Button
                  className="gap-2"
                  onClick={handleSave}
                  disabled={saving}
                  style={{ display: "inline-flex" }}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving
                    ? lang === "ar"
                      ? "جاري الحفظ..."
                      : "Saving..."
                    : lang === "ar"
                      ? "حفظ التغييرات"
                      : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Verification Status */}
          <div className="bg-primary-deep p-8 rounded-lg text-white space-y-6 shadow-xl relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 10 L10 40 L40 40' stroke='white' fill='none'/%3E%3Ccircle cx='40' cy='40' r='2' fill='white'/%3E%3C/svg%3E")`,
              }}
            />
            <h3 className="text-sm font-bold uppercase tracking-widest text-secondary font-latin">
              {lang === "ar" ? "حالة التوثيق" : "Verification Status"}
            </h3>
            <div className="flex items-center gap-4 p-4 bg-card/5 rounded border border-white/10">
              <div className="h-10 w-10 rounded-full bg-secondary/20 flex items-center justify-center text-secondary">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold">
                  {lang === "ar" ? "موثق لدى ميماريك" : "Verified by Mimaric"}
                </p>
                <p className="text-[10px] text-white/50 font-latin">Active since 2024</p>
              </div>
            </div>
            <div className="space-y-4 pt-4 border-t border-white/10">
              <p className="text-xs leading-relaxed text-white/70">
                {lang === "ar"
                  ? "ملفك الموثق يمنحك صلاحية الوصول إلى الربط مع منصة إيجار ونظام الفوترة الإلكترونية فاتورة."
                  : "Your verified profile grants access to Ejar integration and ZATCA e-Invoicing."}
              </p>
            </div>
          </div>

          {/* Settings Navigation */}
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {lang === "ar" ? "الإعدادات" : "Settings"}
            </h3>
            <Link
              href="/dashboard/settings/team"
              className="flex items-center gap-3 p-3 rounded-md hover:bg-muted/30 transition-colors group"
            >
              <div className="p-2 bg-primary/5 rounded text-primary group-hover:bg-primary/10 transition-colors">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">
                  {lang === "ar" ? "فريق العمل" : "Team"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {lang === "ar" ? "إدارة الأعضاء والأدوار" : "Manage members & roles"}
                </p>
              </div>
            </Link>
            {can("audit:read") && (
              <Link
                href="/dashboard/settings/audit"
                className="flex items-center gap-3 p-3 rounded-md hover:bg-muted/30 transition-colors group"
              >
                <div className="p-2 bg-secondary/10 rounded text-secondary group-hover:bg-secondary/15 transition-colors">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">
                    {lang === "ar" ? "سجل المراجعة" : "Audit Trail"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {lang === "ar" ? "تتبع الوصول والتعديلات" : "Track access & changes"}
                  </p>
                </div>
              </Link>
            )}
            <Link
              href="/dashboard/settings/security"
              className="flex items-center gap-3 p-3 rounded-md hover:bg-muted/30 transition-colors group"
            >
              <div className="p-2 bg-warning/10 rounded text-warning group-hover:bg-warning/15 transition-colors">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">
                  {lang === "ar" ? "الأمان" : "Security"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {lang === "ar" ? "تغيير كلمة المرور" : "Change password"}
                </p>
              </div>
            </Link>
          </div>

          {/* Landing Page Preference */}
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Home className="h-[18px] w-[18px] text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {lang === "ar" ? "الصفحة الرئيسية" : "Landing Page"}
              </h3>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {lang === "ar"
                ? "اختر الصفحة التي تفتح بعد تسجيل الدخول."
                : "Choose which page opens after login."}
            </p>
            <select
              value={landingPage}
              onChange={async (e) => {
                const value = e.target.value;
                setLandingPage(value);
                setSavingLanding(true);
                try {
                  await updateLandingPage(value);
                } catch {
                  /* ignore */
                } finally {
                  setSavingLanding(false);
                }
              }}
              className={selectClass}
            >
              <option value="/dashboard">
                {lang === "ar" ? "نظرة عامة" : "Overview"}
              </option>
              <option value="/dashboard/projects">
                {lang === "ar" ? "المشاريع" : "Projects"}
              </option>
              <option value="/dashboard/units">
                {lang === "ar" ? "الوحدات" : "Units"}
              </option>
              <option value="/dashboard/crm">
                {lang === "ar" ? "العملاء" : "Customers"}
              </option>
              <option value="/dashboard/contracts">
                {lang === "ar" ? "المبيعات" : "Sales"}
              </option>
              <option value="/dashboard/leases">
                {lang === "ar" ? "الإيجارات" : "Leases"}
              </option>
              <option value="/dashboard/finance">
                {lang === "ar" ? "المالية" : "Finance"}
              </option>
              <option value="/dashboard/maintenance">
                {lang === "ar" ? "الصيانة" : "Maintenance"}
              </option>
              <option value="/dashboard/reports">
                {lang === "ar" ? "التقارير" : "Reports"}
              </option>
              <option value="/dashboard/settings">
                {lang === "ar" ? "الإعدادات" : "Settings"}
              </option>
            </select>
            {savingLanding && (
              <p className="text-[10px] text-secondary">
                {lang === "ar" ? "جاري الحفظ..." : "Saving..."}
              </p>
            )}
          </div>

          {/* Cache Clear */}
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {lang === "ar" ? "الذاكرة المؤقتة" : "Cache"}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {lang === "ar"
                ? "امسح الذاكرة المؤقتة لإعادة تحميل البيانات من الخادم."
                : "Clear server cache to force fresh data across all pages."}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              style={{ display: "inline-flex" }}
              disabled={clearingCache}
              onClick={async () => {
                setClearingCache(true);
                try {
                  await clearAppCache();
                  window.location.reload();
                } finally {
                  setClearingCache(false);
                }
              }}
            >
              {clearingCache ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {lang === "ar" ? "مسح الذاكرة المؤقتة" : "Clear Cache"}
            </Button>
          </div>

          {/* Quick Info Card */}
          {org && (
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {lang === "ar" ? "معلومات سريعة" : "Quick Info"}
              </h3>
              {form.crNumber && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    {lang === "ar" ? "سجل تجاري" : "CR"}
                  </span>
                  <span className="font-bold text-foreground font-dm-sans">
                    {form.crNumber}
                  </span>
                </div>
              )}
              {form.vatNumber && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    {lang === "ar" ? "رقم ضريبي" : "VAT"}
                  </span>
                  <span className="font-bold text-foreground font-dm-sans">
                    {form.vatNumber}
                  </span>
                </div>
              )}
              {form.entityType && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    {lang === "ar" ? "نوع المنشأة" : "Entity"}
                  </span>
                  <span className="font-bold text-foreground">
                    {form.entityType.replace(/_/g, " ")}
                  </span>
                </div>
              )}
              {form.registrationStatus && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    {lang === "ar" ? "حالة السجل" : "Status"}
                  </span>
                  <span className="font-bold text-secondary">
                    {form.registrationStatus === "ACTIVE_REG"
                      ? lang === "ar"
                        ? "نشط"
                        : "Active"
                      : form.registrationStatus.replace(/_/g, " ")}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      </div>
    </>
  );
}
