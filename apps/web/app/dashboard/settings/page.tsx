"use client";

import { useLanguage } from "../../../components/LanguageProvider";
import * as React from "react";
import {
  Building2,
  Pencil,
  CheckCircle2,
  Briefcase,
  ShieldCheck,
  MapPin,
  Phone,
  ClipboardList,
  Lock,
  Users,
  Home,
  Save,
  RefreshCw,
  Loader2,
  Trash2,
  Mail,
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
  SelectField,
  HijriDatePicker,
} from "@repo/ui";
import Link from "next/link";
import { toast } from "sonner";
import { getOrganization, updateOrganization, clearAppCache } from "../../actions/organization";
import { usePermissions } from "../../../hooks/usePermissions";
import { getUserPreferences, updateLandingPage } from "../../actions/preferences";
import { useSession } from "../../../components/SimpleSessionProvider";
import { roleLabels } from "../../../components/shell/nav-items";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0] ?? "?").slice(0, 2).toUpperCase();
  return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
}

export default function OrgSettingsPage() {
  const { can } = usePermissions();
  const { t, lang } = useLanguage();
  const { data: session } = useSession();

  const sessionUser = session?.user ?? {};
  const profileName =
    sessionUser.name ?? (t("مستخدم ميماريك", "Mimaric User"));
  const profileEmail = sessionUser.email ?? "";
  const profileRole = (sessionUser as { role?: string }).role ?? "USER";
  const profileRoleLabel = (roleLabels[profileRole] ?? { ar: "مستخدم", en: "User" })[lang];
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
        t("تعذّر حفظ التغييرات. يرجى المحاولة مرة أخرى أو التواصل مع الدعم.", "We couldn't save your changes. Try again or contact support."),
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
          title={t("إعدادات المؤسسة", "Organization settings")}
          subtitle={
            t("الملف التعريفي والبيانات التجارية", "Profile & commercial data")
          }
          lang={lang}
        />

        <div className="flex-1 px-4 py-4 pb-28 space-y-4">
          {/* Profile (user identity) — scroll target for /dashboard/settings#profile */}
          <section
            id="profile"
            aria-label={t("الملف الشخصي", "Profile")}
            className="scroll-mt-20 rounded-lg border border-border bg-card p-4 space-y-4"
          >
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-lg font-semibold"
              >
                {initialsOf(profileName)}
              </span>
              <div className="min-w-0">
                <p className="text-base font-bold text-foreground truncate">{profileName}</p>
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                  <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                  {profileRoleLabel}
                </span>
              </div>
            </div>
            {profileEmail && (
              <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2">
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="text-xs text-foreground truncate font-latin" dir="ltr">
                  {profileEmail}
                </span>
              </div>
            )}
          </section>

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
              {t("جاري التحميل...", "Loading...")}
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
                    {t("البيانات الأساسية", "Core Identity")}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {t("اسم المنظمة", "Organization Name")} *
                      </label>
                      <Input
                        value={form.name}
                        onChange={(e) => set("name", e.target.value)}
                        className={`h-11 ${fieldErrors.name ? "border-destructive focus-visible:ring-destructive" : ""}`}
                      />
                      {fieldErrors.name && (
                        <p className="text-xs text-destructive">
                          {t("هذا الحقل مطلوب", "This field is required")}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {t("الاسم بالعربي", "Official Arabic Name")}
                      </label>
                      <Input className="h-11" value={form.nameArabic} onChange={(e) => set("nameArabic", e.target.value)} dir="rtl" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {t("الاسم بالإنجليزي", "Official English Name")}
                      </label>
                      <Input className="h-11" value={form.nameEnglish} onChange={(e) => set("nameEnglish", e.target.value)} dir="ltr" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {t("رقم السجل التجاري", "Commercial Registration")}
                      </label>
                      <CRInput className="h-11" placeholder="1010XXXXXX" value={form.crNumber} onChange={(raw) => set("crNumber", raw)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {t("الرقم الضريبي", "VAT Number")}
                      </label>
                      <Input className="h-11 font-latin" placeholder="3000XXXXXX00003" value={form.vatNumber} onChange={(e) => set("vatNumber", e.target.value)} dir="ltr" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {t("الرقم الموحد", "Unified Number")}
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
                    {t("بيانات وزارة التجارة", "Ministry of Commerce")}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {t("نوع المنشأة", "Entity Type")}
                      </label>
                      <SelectField aria-label={t("نوع المنشأة", "Entity Type")} value={form.entityType} onChange={(e) => set("entityType", e.target.value)} className="h-11">
                        <option value="">{t("اختر...", "Select...")}</option>
                        <option value="ESTABLISHMENT">{t("مؤسسة", "Establishment")}</option>
                        <option value="COMPANY">{t("شركة", "Company")}</option>
                        <option value="BRANCH">{t("فرع", "Branch")}</option>
                        <option value="PROFESSIONAL_ENTITY">{t("كيان مهني", "Professional Entity")}</option>
                        <option value="FOREIGN_COMPANY_BRANCH">{t("فرع شركة أجنبية", "Foreign Company Branch")}</option>
                      </SelectField>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {t("الشكل القانوني", "Legal Form")}
                      </label>
                      <SelectField aria-label={t("الشكل القانوني", "Legal Form")} value={form.legalForm} onChange={(e) => set("legalForm", e.target.value)} className="h-11">
                        <option value="">{t("اختر...", "Select...")}</option>
                        <option value="SOLE_PROPRIETORSHIP">{t("مؤسسة فردية", "Sole Proprietorship")}</option>
                        <option value="LIMITED_LIABILITY_COMPANY">{t("شركة ذات مسؤولية محدودة", "LLC")}</option>
                        <option value="JOINT_STOCK_COMPANY">{t("شركة مساهمة", "Joint Stock Company")}</option>
                        <option value="SIMPLIFIED_JOINT_STOCK_COMPANY">{t("شركة مساهمة مبسطة", "Simplified JSC")}</option>
                        <option value="GENERAL_PARTNERSHIP">{t("شركة تضامنية", "General Partnership")}</option>
                        <option value="LIMITED_PARTNERSHIP">{t("شركة توصية", "Limited Partnership")}</option>
                        <option value="PROFESSIONAL_COMPANY">{t("شركة مهنية", "Professional Company")}</option>
                      </SelectField>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {t("حالة التسجيل", "Registration Status")}
                      </label>
                      <SelectField aria-label={t("حالة التسجيل", "Registration Status")} value={form.registrationStatus} onChange={(e) => set("registrationStatus", e.target.value)} className="h-11">
                        <option value="">{t("اختر...", "Select...")}</option>
                        <option value="ACTIVE_REG">{t("نشط", "Active")}</option>
                        <option value="EXPIRED_REG">{t("منتهي", "Expired")}</option>
                        <option value="SUSPENDED_REG">{t("موقوف", "Suspended")}</option>
                        <option value="CANCELLED_REG">{t("ملغي", "Cancelled")}</option>
                      </SelectField>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {t("رأس المال (ر.س)", "Capital (SAR)")}
                      </label>
                      <Input className="h-11 tabular-nums" type="number" value={form.capitalAmountSar} onChange={(e) => set("capitalAmountSar", e.target.value)} dir="ltr" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          {t("تاريخ التسجيل", "Reg. Date")}
                        </label>
                        <HijriDatePicker
                          className="h-11"
                          value={form.registrationDate ? new Date(form.registrationDate) : null}
                          onChange={(d) => set("registrationDate", d ? d.toISOString().slice(0, 10) : "")}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          {t("تاريخ الانتهاء", "Expiry")}
                        </label>
                        <HijriDatePicker
                          className="h-11"
                          value={form.expiryDate ? new Date(form.expiryDate) : null}
                          onChange={(d) => set("expiryDate", d ? d.toISOString().slice(0, 10) : "")}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {t("رمز النشاط", "Activity Code")}
                      </label>
                      <Input className="h-11" value={form.mainActivityCode} onChange={(e) => set("mainActivityCode", e.target.value)} dir="ltr" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {t("اسم النشاط", "Activity Name")}
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
                    {t("بيانات التواصل", "Contact Information")}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {t("رقم الجوال", "Mobile")}
                      </label>
                      <SaudiPhoneInput className="h-11" placeholder="05XXXXXXXX" value={form.contactMobile} onChange={(e164) => set("contactMobile", e164)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {t("الهاتف الثابت", "Phone")}
                      </label>
                      <SaudiPhoneInput className="h-11" placeholder="011XXXXXXX" value={form.contactPhone} onChange={(e164) => set("contactPhone", e164)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {t("البريد الإلكتروني", "Email")}
                      </label>
                      <Input className="h-11" type="email" placeholder="info@company.sa" value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} dir="ltr" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {t("الموقع الإلكتروني", "Website")}
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
                    {t("العنوان الوطني", "National Address")}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {t("المنطقة", "Region")}
                      </label>
                      <Input className="h-11" value={form.addrRegion} onChange={(e) => set("addrRegion", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {t("المدينة", "City")}
                      </label>
                      <Input className="h-11" value={form.addrCity} onChange={(e) => set("addrCity", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {t("الحي", "District")}
                      </label>
                      <Input className="h-11" value={form.addrDistrict} onChange={(e) => set("addrDistrict", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {t("اسم الشارع", "Street")}
                      </label>
                      <Input className="h-11" value={form.addrStreet} onChange={(e) => set("addrStreet", e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          {t("المبنى", "Building")}
                        </label>
                        <Input className="h-11" value={form.addrBuilding} onChange={(e) => set("addrBuilding", e.target.value)} dir="ltr" maxLength={4} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          {t("الرمز البريدي", "Postal")}
                        </label>
                        <Input className="h-11" value={form.addrPostal} onChange={(e) => set("addrPostal", e.target.value)} dir="ltr" maxLength={5} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {t("الرقم الإضافي", "Additional No.")}
                      </label>
                      <Input className="h-11" value={form.addrAdditional} onChange={(e) => set("addrAdditional", e.target.value)} dir="ltr" maxLength={4} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {t("العنوان المختصر", "Short Address")}
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
                    {t("التفضيلات", "Preferences")}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {t("الصفحة الرئيسية", "Landing Page")}
                      </label>
                      <SelectField
                        aria-label={t("الصفحة الرئيسية", "Landing Page")}
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
                        className="h-11"
                      >
                        <option value="/dashboard">{t("نظرة عامة", "Overview")}</option>
                        <option value="/dashboard/units">{t("الوحدات", "Units")}</option>
                        <option value="/dashboard/crm">{t("العملاء", "Customers")}</option>
                        <option value="/dashboard/contracts">{t("المبيعات", "Sales")}</option>
                        <option value="/dashboard/leases">{t("الإيجارات", "Leases")}</option>
                        <option value="/dashboard/finance">{t("المالية", "Finance")}</option>
                        <option value="/dashboard/maintenance">{t("الصيانة", "Maintenance")}</option>
                        <option value="/dashboard/reports">{t("التقارير", "Reports")}</option>
                        <option value="/dashboard/settings">{t("الإعدادات", "Settings")}</option>
                      </SelectField>
                      {savingLanding && (
                        <p className="text-[11px] text-muted-foreground">
                          {t("جاري الحفظ...", "Saving...")}
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
                      {t("مسح الذاكرة المؤقتة", "Clear Cache")}
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
                  {t("فريق العمل", "Team")}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t("إدارة الأعضاء والأدوار", "Manage members & roles")}
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
                    {t("سجل المراجعة", "Audit Trail")}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {t("تتبع الوصول والتعديلات", "Track access & changes")}
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
                  {t("الأمان", "Security")}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t("تغيير كلمة المرور", "Change password")}
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
            {t("إعادة تشغيل معالج الإعداد", "Re-run Setup Wizard")}
          </Link>
        </div>

        <FAB
          icon={saving ? Loader2 : Save}
          label={
            saving
              ? (t("جاري الحفظ...", "Saving..."))
              : (t("حفظ التغييرات", "Save Changes"))
          }
          onClick={saving ? undefined : handleSave}
        />
      </div>

      {/* ─── Desktop (≥ md) ────────────────────────────────────────────── */}
      <div className="hidden md:block space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title={t("إعدادات المنظمة", "Organization Settings")}
        description={
          t("إدارة الملف التعريفي والبيانات التجارية لمنشأتك.", "Manage your organization's profile and commercial data.")
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
                title={t("البيانات الأساسية", "Core Identity")}
                description={
                  t("الاسم الرسمي وأرقام التسجيل", "Official name and registration numbers")
                }
              >
                <div className="space-y-2">
                  <label htmlFor="settings-org-name" className="text-xs font-medium text-muted-foreground">
                    {t("اسم المنظمة", "Organization Name")} *
                  </label>
                  <Input
                    id="settings-org-name"
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    className={fieldErrors.name ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {fieldErrors.name && (
                    <p className="text-xs text-destructive">
                      {t("هذا الحقل مطلوب", "This field is required")}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="settings-name-arabic" className="text-xs font-medium text-muted-foreground">
                      {t("الاسم الرسمي بالعربي", "Official Arabic Name")}
                    </label>
                    <Input
                      id="settings-name-arabic"
                      value={form.nameArabic}
                      onChange={(e) => set("nameArabic", e.target.value)}
                      dir="rtl"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="settings-name-english" className="text-xs font-medium text-muted-foreground">
                      {t("الاسم الرسمي بالإنجليزي", "Official English Name")}
                    </label>
                    <Input
                      id="settings-name-english"
                      value={form.nameEnglish}
                      onChange={(e) => set("nameEnglish", e.target.value)}
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {t("رقم السجل التجاري (CR)", "Commercial Registration")}
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
                      {t("الرقم الضريبي (VAT)", "VAT Number")}
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
                    {t("الرقم الموحد", "Unified Number")}
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
                  t("بيانات وزارة التجارة (MOC)", "Ministry of Commerce Data (MOC)")
                }
                description={
                  t("نوع المنشأة والشكل القانوني والنشاط", "Entity type, legal form, and activity details")
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="settings-entity-type" className="text-xs font-medium text-muted-foreground">
                      {t("نوع المنشأة", "Entity Type")}
                    </label>
                    <SelectField
                      id="settings-entity-type"
                      aria-label={t("نوع المنشأة", "Entity Type")}
                      value={form.entityType}
                      onChange={(e) => set("entityType", e.target.value)}
                    >
                      <option value="">{t("اختر...", "Select...")}</option>
                      <option value="ESTABLISHMENT">
                        {t("مؤسسة", "Establishment")}
                      </option>
                      <option value="COMPANY">{t("شركة", "Company")}</option>
                      <option value="BRANCH">{t("فرع", "Branch")}</option>
                      <option value="PROFESSIONAL_ENTITY">
                        {t("كيان مهني", "Professional Entity")}
                      </option>
                      <option value="FOREIGN_COMPANY_BRANCH">
                        {t("فرع شركة أجنبية", "Foreign Company Branch")}
                      </option>
                    </SelectField>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="settings-legal-form" className="text-xs font-medium text-muted-foreground">
                      {t("الشكل القانوني", "Legal Form")}
                    </label>
                    <SelectField
                      id="settings-legal-form"
                      aria-label={t("الشكل القانوني", "Legal Form")}
                      value={form.legalForm}
                      onChange={(e) => set("legalForm", e.target.value)}
                    >
                      <option value="">{t("اختر...", "Select...")}</option>
                      <option value="SOLE_PROPRIETORSHIP">
                        {t("مؤسسة فردية", "Sole Proprietorship")}
                      </option>
                      <option value="LIMITED_LIABILITY_COMPANY">
                        {t("شركة ذات مسؤولية محدودة", "LLC")}
                      </option>
                      <option value="JOINT_STOCK_COMPANY">
                        {t("شركة مساهمة", "Joint Stock Company")}
                      </option>
                      <option value="SIMPLIFIED_JOINT_STOCK_COMPANY">
                        {t("شركة مساهمة مبسطة", "Simplified JSC")}
                      </option>
                      <option value="GENERAL_PARTNERSHIP">
                        {t("شركة تضامنية", "General Partnership")}
                      </option>
                      <option value="LIMITED_PARTNERSHIP">
                        {t("شركة توصية", "Limited Partnership")}
                      </option>
                      <option value="PROFESSIONAL_COMPANY">
                        {t("شركة مهنية", "Professional Company")}
                      </option>
                    </SelectField>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="settings-reg-status" className="text-xs font-medium text-muted-foreground">
                      {t("حالة التسجيل", "Registration Status")}
                    </label>
                    <SelectField
                      id="settings-reg-status"
                      aria-label={t("حالة التسجيل", "Registration Status")}
                      value={form.registrationStatus}
                      onChange={(e) => set("registrationStatus", e.target.value)}
                    >
                      <option value="">{t("اختر...", "Select...")}</option>
                      <option value="ACTIVE_REG">
                        {t("نشط", "Active")}
                      </option>
                      <option value="EXPIRED_REG">
                        {t("منتهي", "Expired")}
                      </option>
                      <option value="SUSPENDED_REG">
                        {t("موقوف", "Suspended")}
                      </option>
                      <option value="CANCELLED_REG">
                        {t("ملغي", "Cancelled")}
                      </option>
                    </SelectField>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {t("رأس المال (ر.س)", "Capital (SAR)")}
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
                    <label htmlFor="settings-reg-date" className="text-xs font-medium text-muted-foreground">
                      {t("تاريخ التسجيل", "Registration Date")}
                    </label>
                    <HijriDatePicker
                      id="settings-reg-date"
                      className="font-dm-sans"
                      value={form.registrationDate ? new Date(form.registrationDate) : null}
                      onChange={(d) => set("registrationDate", d ? d.toISOString().slice(0, 10) : "")}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="settings-expiry-date" className="text-xs font-medium text-muted-foreground">
                      {t("تاريخ الانتهاء", "Expiry Date")}
                    </label>
                    <HijriDatePicker
                      id="settings-expiry-date"
                      className="font-dm-sans"
                      value={form.expiryDate ? new Date(form.expiryDate) : null}
                      onChange={(d) => set("expiryDate", d ? d.toISOString().slice(0, 10) : "")}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {t("رمز النشاط", "Activity Code")}
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
                      {t("اسم النشاط", "Activity Name")}
                    </label>
                    <Input
                      value={form.mainActivityNameAr}
                      onChange={(e) => set("mainActivityNameAr", e.target.value)}
                      placeholder={
                        t("التطوير العقاري", "Real Estate Development")
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="settings-trade-arabic" className="text-xs font-medium text-muted-foreground">
                      {t("الاسم التجاري بالعربي", "Trade Name (Arabic)")}
                    </label>
                    <Input
                      id="settings-trade-arabic"
                      value={form.tradeNameArabic}
                      onChange={(e) => set("tradeNameArabic", e.target.value)}
                      dir="rtl"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="settings-trade-english" className="text-xs font-medium text-muted-foreground">
                      {t("الاسم التجاري بالإنجليزي", "Trade Name (English)")}
                    </label>
                    <Input
                      id="settings-trade-english"
                      value={form.tradeNameEnglish}
                      onChange={(e) => set("tradeNameEnglish", e.target.value)}
                      dir="ltr"
                    />
                  </div>
                </div>
              </FormSection>

              {/* Contact Information */}
              <FormSection
                title={t("بيانات التواصل", "Contact Information")}
                description={
                  t("أرقام الهاتف والبريد والموقع الإلكتروني", "Phone numbers, email, and website")
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {t("رقم الجوال", "Mobile")}
                    </label>
                    <SaudiPhoneInput
                      value={form.contactMobile}
                      onChange={(e164) => set("contactMobile", e164)}
                      placeholder="05XXXXXXXX"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {t("الهاتف الثابت", "Phone")}
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
                      {t("البريد الإلكتروني", "Email")}
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
                      {t("الموقع الإلكتروني", "Website")}
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
                title={t("العنوان الوطني", "National Address")}
                description={
                  t("عنوان المنشأة حسب نظام العنوان الوطني", "Registered address per Saudi National Address system")
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {t("المنطقة", "Region")}
                    </label>
                    <Input
                      value={form.addrRegion}
                      onChange={(e) => set("addrRegion", e.target.value)}
                      placeholder={t("منطقة الرياض", "Riyadh Region")}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {t("المدينة", "City")}
                    </label>
                    <Input
                      value={form.addrCity}
                      onChange={(e) => set("addrCity", e.target.value)}
                      placeholder={t("الرياض", "Riyadh")}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {t("الحي", "District")}
                    </label>
                    <Input
                      value={form.addrDistrict}
                      onChange={(e) => set("addrDistrict", e.target.value)}
                      placeholder={t("العليا", "Al Olaya")}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="settings-addr-street" className="text-xs font-medium text-muted-foreground">
                      {t("اسم الشارع", "Street")}
                    </label>
                    <Input
                      id="settings-addr-street"
                      value={form.addrStreet}
                      onChange={(e) => set("addrStreet", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {t("رقم المبنى", "Building No.")}
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
                      {t("الرمز البريدي", "Postal Code")}
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
                      {t("الرقم الإضافي", "Additional No.")}
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
                      {t("العنوان المختصر", "Short Address")}
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
                  {t("إعادة تشغيل معالج الإعداد", "Re-run Setup Wizard")}
                </Link>
                <Button
                  className="gap-2"
                  onClick={handleSave}
                  disabled={saving}
                  style={{ display: "inline-flex" }}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving
                    ? t("جاري الحفظ...", "Saving...")
                    : t("حفظ التغييرات", "Save Changes")}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Profile (user identity) — scroll target for /dashboard/settings#profile */}
          <section
            id="profile"
            aria-label={t("الملف الشخصي", "Profile")}
            className="scroll-mt-24 rounded-lg border border-border bg-card p-6 shadow-sm space-y-4"
          >
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {t("الملف الشخصي", "Profile")}
            </h3>
            <div className="flex items-center gap-4">
              <span
                aria-hidden="true"
                className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-lg font-semibold"
              >
                {initialsOf(profileName)}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{profileName}</p>
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                  <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                  {profileRoleLabel}
                </span>
              </div>
            </div>
            {profileEmail && (
              <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2">
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="text-xs text-foreground truncate font-latin" dir="ltr">
                  {profileEmail}
                </span>
              </div>
            )}
          </section>

          {/* Verification Status */}
          <div className="bg-primary-deep p-8 rounded-lg text-white space-y-6 shadow-xl relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 10 L10 40 L40 40' stroke='white' fill='none'/%3E%3Ccircle cx='40' cy='40' r='2' fill='white'/%3E%3C/svg%3E")`,
              }}
            />
            <h3 className="text-sm font-bold uppercase tracking-widest text-secondary font-latin">
              {t("حالة التوثيق", "Verification Status")}
            </h3>
            <div className="flex items-center gap-4 p-4 bg-card/5 rounded border border-white/10">
              <div className="h-10 w-10 rounded-full bg-secondary/20 flex items-center justify-center text-secondary">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold">
                  {t("موثق لدى ميماريك", "Verified by Mimaric")}
                </p>
                <p className="text-[10px] text-white/50 font-latin">Active since 2024</p>
              </div>
            </div>
            <div className="space-y-4 pt-4 border-t border-white/10">
              <p className="text-xs leading-relaxed text-white/70">
                {t("ملفك الموثق يمنحك صلاحية الوصول إلى الربط مع منصة إيجار ونظام الفوترة الإلكترونية فاتورة.", "Your verified profile grants access to Ejar integration and ZATCA e-Invoicing.")}
              </p>
            </div>
          </div>

          {/* Settings Navigation */}
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {t("الإعدادات", "Settings")}
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
                  {t("فريق العمل", "Team")}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {t("إدارة الأعضاء والأدوار", "Manage members & roles")}
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
                    {t("سجل المراجعة", "Audit Trail")}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {t("تتبع الوصول والتعديلات", "Track access & changes")}
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
                  {t("الأمان", "Security")}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {t("تغيير كلمة المرور", "Change password")}
                </p>
              </div>
            </Link>
          </div>

          {/* Landing Page Preference */}
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Home className="h-[18px] w-[18px] text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {t("الصفحة الرئيسية", "Landing Page")}
              </h3>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {t("اختر الصفحة التي تفتح بعد تسجيل الدخول.", "Choose which page opens after login.")}
            </p>
            <label htmlFor="settings-landing-page" className="sr-only">
              {t("الصفحة الرئيسية", "Landing page")}
            </label>
            <SelectField
              id="settings-landing-page"
              aria-label={t("الصفحة الرئيسية", "Landing page")}
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
            >
              <option value="/dashboard">
                {t("نظرة عامة", "Overview")}
              </option>
              <option value="/dashboard/units">
                {t("الوحدات", "Units")}
              </option>
              <option value="/dashboard/crm">
                {t("العملاء", "Customers")}
              </option>
              <option value="/dashboard/contracts">
                {t("المبيعات", "Sales")}
              </option>
              <option value="/dashboard/leases">
                {t("الإيجارات", "Leases")}
              </option>
              <option value="/dashboard/finance">
                {t("المالية", "Finance")}
              </option>
              <option value="/dashboard/maintenance">
                {t("الصيانة", "Maintenance")}
              </option>
              <option value="/dashboard/reports">
                {t("التقارير", "Reports")}
              </option>
              <option value="/dashboard/settings">
                {t("الإعدادات", "Settings")}
              </option>
            </SelectField>
            {savingLanding && (
              <p className="text-[10px] text-secondary">
                {t("جاري الحفظ...", "Saving...")}
              </p>
            )}
          </div>

          {/* Cache Clear */}
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {t("الذاكرة المؤقتة", "Cache")}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t("امسح الذاكرة المؤقتة لإعادة تحميل البيانات من الخادم.", "Clear server cache to force fresh data across all pages.")}
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
              {t("مسح الذاكرة المؤقتة", "Clear Cache")}
            </Button>
          </div>

          {/* Quick Info Card */}
          {org && (
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {t("معلومات سريعة", "Quick Info")}
              </h3>
              {form.crNumber && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    {t("سجل تجاري", "CR")}
                  </span>
                  <span className="font-bold text-foreground font-dm-sans">
                    {form.crNumber}
                  </span>
                </div>
              )}
              {form.vatNumber && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    {t("رقم ضريبي", "VAT")}
                  </span>
                  <span className="font-bold text-foreground font-dm-sans">
                    {form.vatNumber}
                  </span>
                </div>
              )}
              {form.entityType && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    {t("نوع المنشأة", "Entity")}
                  </span>
                  <span className="font-bold text-foreground">
                    {form.entityType.replace(/_/g, " ")}
                  </span>
                </div>
              )}
              {form.registrationStatus && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    {t("حالة السجل", "Status")}
                  </span>
                  <span className="font-bold text-secondary">
                    {form.registrationStatus === "ACTIVE_REG"
                      ? t("نشط", "Active")
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
