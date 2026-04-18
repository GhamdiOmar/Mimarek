"use client";

import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "../../../../components/LanguageProvider";
import { useSession } from "../../../../components/SimpleSessionProvider";
import { isSystemRole } from "../../../../lib/permissions";
import { getSeoConfig, upsertSeoConfig } from "../../../actions/seo-config";
import { UploadButton } from "../../../../lib/uploadthing";
import {
  SearchCheck,
  Globe,
  Tag,
  Shield,
  Code2,
  Building2,
  Save,
  AlertTriangle,
  Plus,
  Trash2,
  CheckCircle2,
  Image as ImageIcon,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import Image from "next/image";
import {
  Button,
  Card,
  Input,
  Badge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  AppBar,
  EmptyState,
} from "@repo/ui";
import { toast } from "sonner";

type RobotsRule = { userAgent: string; allow: string[]; disallow: string[] };

const DEFAULT_ROBOTS: RobotsRule[] = [
  {
    userAgent: "*",
    allow: ["/ar", "/en"],
    disallow: ["/dashboard/", "/api/", "/auth/invite/", "/auth/reset-password/"],
  },
];

function renderRobotsPreview(rules: RobotsRule[]): string {
  return rules
    .map((r) => {
      const lines = [`User-agent: ${r.userAgent}`];
      r.allow.forEach((p) => lines.push(`Allow: ${p}`));
      r.disallow.forEach((p) => lines.push(`Disallow: ${p}`));
      return lines.join("\n");
    })
    .join("\n\n");
}

function AssetUploader({
  label,
  currentUrl,
  onUploaded,
  lang,
}: {
  label: string;
  currentUrl?: string | null;
  onUploaded: (url: string) => void;
  lang: "ar" | "en";
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="flex items-center gap-3">
        {currentUrl && (
          <div className="h-12 w-12 overflow-hidden rounded-md border border-border bg-muted flex items-center justify-center">
            <Image src={currentUrl} alt={label} width={48} height={48} className="h-full w-full object-contain" />
          </div>
        )}
        {!currentUrl && (
          <div className="h-12 w-12 rounded-md border border-dashed border-border bg-muted flex items-center justify-center">
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        <UploadButton
          endpoint="seoAssetUploader"
          onClientUploadComplete={(res) => {
            const url = res[0]?.url;
            if (url) onUploaded(url);
          }}
          onUploadError={(err) => { toast.error(err.message); }}
          appearance={{
            button: "bg-primary text-primary-foreground text-xs px-3 py-1.5 rounded-md font-medium",
          }}
        />
      </div>
      {currentUrl && (
        <p className="text-xs text-muted-foreground truncate max-w-sm">{currentUrl}</p>
      )}
    </div>
  );
}

export default function SeoSettingsPage() {
  const { lang } = useLanguage();
  const { data: session } = useSession();
  const userRole = session?.user?.role ?? "";
  const authorized = isSystemRole(userRole);
  const dir = lang === "ar" ? "rtl" : "ltr";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Section A — SEO Metadata
  const [siteTitle, setSiteTitle] = useState("");
  const [siteTitleTemplate, setSiteTitleTemplate] = useState("%s | Mimaric");
  const [siteDescriptionAr, setSiteDescriptionAr] = useState("");
  const [siteDescriptionEn, setSiteDescriptionEn] = useState("");
  const [canonicalUrl, setCanonicalUrl] = useState("https://mimaric.app");
  const [ogLocale, setOgLocale] = useState("ar_SA");
  const [twitterHandle, setTwitterHandle] = useState("");
  const [twitterCard, setTwitterCard] = useState("summary_large_image");

  // Section B — Brand Assets
  const [faviconUrl, setFaviconUrl] = useState("");
  const [appleTouchIconUrl, setAppleTouchIconUrl] = useState("");
  const [ogImageUrl, setOgImageUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoLightUrl, setLogoLightUrl] = useState("");
  const [logoDarkUrl, setLogoDarkUrl] = useState("");

  // Section C — Analytics
  const [gtmContainerId, setGtmContainerId] = useState("");
  const [ga4MeasurementId, setGa4MeasurementId] = useState("");
  const [gadsConversionId, setGadsConversionId] = useState("");

  // Section D — Webmaster Verification
  const [gscVerificationCode, setGscVerificationCode] = useState("");
  const [bingVerificationCode, setBingVerificationCode] = useState("");

  // Section E — robots.txt
  const [robotsRules, setRobotsRules] = useState<RobotsRule[]>(DEFAULT_ROBOTS);

  // Section F — Schema.org
  const [schemaOrgName, setSchemaOrgName] = useState("Mimaric");
  const [schemaOrgLogoUrl, setSchemaOrgLogoUrl] = useState("");
  const [schemaOrgTwitter, setSchemaOrgTwitter] = useState("");
  const [schemaOrgLinkedIn, setSchemaOrgLinkedIn] = useState("");
  const [schemaOrgInstagram, setSchemaOrgInstagram] = useState("");

  const loadConfig = useCallback(async () => {
    try {
      const config = await getSeoConfig();
      if (!config) return;
      setSiteTitle(config.siteTitle ?? "");
      setSiteTitleTemplate(config.siteTitleTemplate ?? "%s | Mimaric");
      setSiteDescriptionAr(config.siteDescriptionAr ?? "");
      setSiteDescriptionEn(config.siteDescriptionEn ?? "");
      setCanonicalUrl(config.canonicalUrl ?? "https://mimaric.app");
      setOgLocale(config.ogLocale ?? "ar_SA");
      setTwitterHandle(config.twitterHandle ?? "");
      setTwitterCard(config.twitterCard ?? "summary_large_image");
      setFaviconUrl(config.faviconUrl ?? "");
      setAppleTouchIconUrl(config.appleTouchIconUrl ?? "");
      setOgImageUrl(config.ogImageUrl ?? "");
      setLogoUrl(config.logoUrl ?? "");
      setLogoLightUrl(config.logoLightUrl ?? "");
      setLogoDarkUrl(config.logoDarkUrl ?? "");
      setGtmContainerId(config.gtmContainerId ?? "");
      setGa4MeasurementId(config.ga4MeasurementId ?? "");
      setGadsConversionId(config.gadsConversionId ?? "");
      setGscVerificationCode(config.gscVerificationCode ?? "");
      setBingVerificationCode(config.bingVerificationCode ?? "");
      if (config.robotsTxtRules) {
        try { setRobotsRules(JSON.parse(config.robotsTxtRules)); } catch { /* keep default */ }
      }
      setSchemaOrgName(config.schemaOrgName ?? "Mimaric");
      setSchemaOrgLogoUrl(config.schemaOrgLogoUrl ?? "");
      setSchemaOrgTwitter(config.schemaOrgTwitter ?? "");
      setSchemaOrgLinkedIn(config.schemaOrgLinkedIn ?? "");
      setSchemaOrgInstagram(config.schemaOrgInstagram ?? "");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  async function save(section: string, data: Record<string, string | null | undefined>) {
    setSaving(section);
    try {
      await upsertSeoConfig(data);
      toast.success(lang === "ar" ? "تم الحفظ بنجاح" : "Saved successfully");
    } catch {
      toast.error(lang === "ar" ? "فشل الحفظ" : "Failed to save");
    } finally {
      setSaving(null);
    }
  }

  function addPath(ruleIdx: number, type: "allow" | "disallow") {
    setRobotsRules((prev) =>
      prev.map((r, i) => i === ruleIdx ? { ...r, [type]: [...r[type], "/"] } : r)
    );
  }

  function updatePath(ruleIdx: number, type: "allow" | "disallow", pathIdx: number, value: string) {
    setRobotsRules((prev) =>
      prev.map((r, i) =>
        i === ruleIdx
          ? { ...r, [type]: r[type].map((p, j) => (j === pathIdx ? value : p)) }
          : r
      )
    );
  }

  function removePath(ruleIdx: number, type: "allow" | "disallow", pathIdx: number) {
    setRobotsRules((prev) =>
      prev.map((r, i) =>
        i === ruleIdx ? { ...r, [type]: r[type].filter((_, j) => j !== pathIdx) } : r
      )
    );
  }

  const translations = {
    title: { ar: "إعدادات SEO والاكتشاف", en: "SEO & Discoverability Settings" },
    subtitle: { ar: "إدارة ميتاداتا الموقع، العلامة التجارية، التحليلات، وإعدادات محركات البحث", en: "Manage site metadata, brand assets, analytics, and search engine settings" },
    tabMeta: { ar: "ميتاداتا SEO", en: "SEO Metadata" },
    tabAssets: { ar: "العلامة التجارية", en: "Brand Assets" },
    tabAnalytics: { ar: "التحليلات", en: "Analytics" },
    tabVerification: { ar: "التحقق", en: "Verification" },
    tabRobots: { ar: "robots.txt", en: "robots.txt" },
    tabSchema: { ar: "Schema.org", en: "Schema.org" },
    save: { ar: "حفظ", en: "Save" },
    saving: { ar: "جارٍ الحفظ...", en: "Saving..." },
  };

  const l = (key: keyof typeof translations) => translations[key][lang];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // ── Mobile save helper (persists all editable fields in one call) ───────
  const saveAllMobile = async () => {
    await save("all", {
      siteTitle,
      siteTitleTemplate,
      siteDescriptionAr,
      siteDescriptionEn,
      canonicalUrl,
      ogLocale,
      twitterHandle,
      twitterCard,
      gtmContainerId: gtmContainerId || null,
      ga4MeasurementId: ga4MeasurementId || null,
      gadsConversionId: gadsConversionId || null,
      gscVerificationCode: gscVerificationCode || null,
      bingVerificationCode: bingVerificationCode || null,
      schemaOrgName,
      schemaOrgLogoUrl: schemaOrgLogoUrl || null,
      schemaOrgTwitter: schemaOrgTwitter || null,
      schemaOrgLinkedIn: schemaOrgLinkedIn || null,
      schemaOrgInstagram: schemaOrgInstagram || null,
      robotsTxtRules: JSON.stringify(robotsRules),
    });
  };

  return (
    <>
    {/* ─── Mobile (< md) ─────────────────────────────────────────────── */}
    <div
      className="md:hidden -m-4 sm:-m-6 min-h-dvh flex flex-col bg-background"
      dir={dir}
    >
      <AppBar
        title={lang === "ar" ? "تحسين محركات البحث" : "SEO"}
        lang={lang}
      />

      {!authorized ? (
        <div className="flex-1 px-4 pt-10">
          <EmptyState
            icon={<ShieldAlert className="h-10 w-10" aria-hidden="true" />}
            title={lang === "ar" ? "غير مصرح" : "Unauthorized"}
            description={
              lang === "ar"
                ? "هذه الصفحة متاحة لفريق المنصة فقط."
                : "This page is available to platform staff only."
            }
          />
        </div>
      ) : (
        <>
          <div className="flex-1 px-4 py-4 space-y-6 pb-28">
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {lang === "ar" ? "ميتاداتا" : "Metadata"}
              </h2>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {lang === "ar" ? "عنوان الموقع" : "Site title"}
                </label>
                <Input value={siteTitle} onChange={(e) => setSiteTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {lang === "ar" ? "قالب العنوان" : "Title template"}
                </label>
                <Input value={siteTitleTemplate} onChange={(e) => setSiteTitleTemplate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {lang === "ar" ? "الوصف (عربي)" : "Description (AR)"}
                </label>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  rows={3}
                  dir="rtl"
                  value={siteDescriptionAr}
                  onChange={(e) => setSiteDescriptionAr(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {lang === "ar" ? "الوصف (إنجليزي)" : "Description (EN)"}
                </label>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  rows={3}
                  dir="ltr"
                  value={siteDescriptionEn}
                  onChange={(e) => setSiteDescriptionEn(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {lang === "ar" ? "الرابط الأساسي" : "Canonical URL"}
                </label>
                <Input dir="ltr" value={canonicalUrl} onChange={(e) => setCanonicalUrl(e.target.value)} />
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {lang === "ar" ? "التحليلات" : "Analytics"}
              </h2>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">GTM Container ID</label>
                <Input
                  dir="ltr"
                  value={gtmContainerId}
                  onChange={(e) => setGtmContainerId(e.target.value.toUpperCase())}
                  placeholder="GTM-XXXXXXX"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">GA4 Measurement ID</label>
                <Input
                  dir="ltr"
                  value={ga4MeasurementId}
                  onChange={(e) => setGa4MeasurementId(e.target.value.toUpperCase())}
                  placeholder="G-XXXXXXXXXX"
                  disabled={!!gtmContainerId}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Google Ads Conversion ID</label>
                <Input
                  dir="ltr"
                  value={gadsConversionId}
                  onChange={(e) => setGadsConversionId(e.target.value.toUpperCase())}
                  placeholder="AW-XXXXXXXXX"
                />
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {lang === "ar" ? "التحقق" : "Verification"}
              </h2>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Google Search Console</label>
                <Input dir="ltr" value={gscVerificationCode} onChange={(e) => setGscVerificationCode(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Bing Webmaster</label>
                <Input dir="ltr" value={bingVerificationCode} onChange={(e) => setBingVerificationCode(e.target.value)} />
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Schema.org
              </h2>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {lang === "ar" ? "اسم المنظمة" : "Organization name"}
                </label>
                <Input value={schemaOrgName} onChange={(e) => setSchemaOrgName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {lang === "ar" ? "رابط الشعار" : "Logo URL"}
                </label>
                <Input dir="ltr" value={schemaOrgLogoUrl} onChange={(e) => setSchemaOrgLogoUrl(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Twitter / X</label>
                <Input dir="ltr" value={schemaOrgTwitter} onChange={(e) => setSchemaOrgTwitter(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">LinkedIn</label>
                <Input dir="ltr" value={schemaOrgLinkedIn} onChange={(e) => setSchemaOrgLinkedIn(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Instagram</label>
                <Input dir="ltr" value={schemaOrgInstagram} onChange={(e) => setSchemaOrgInstagram(e.target.value)} />
              </div>
            </section>
          </div>

          <div className="fixed inset-x-0 bottom-0 bg-card/95 backdrop-blur-md border-t p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] z-mobile-fab">
            <Button
              onClick={saveAllMobile}
              disabled={saving !== null}
              className="w-full"
              style={{ display: "inline-flex", justifyContent: "center" }}
            >
              <Save className="h-4 w-4 me-2" />
              {saving !== null
                ? lang === "ar"
                  ? "جارٍ الحفظ..."
                  : "Saving..."
                : lang === "ar"
                  ? "حفظ"
                  : "Save"}
            </Button>
          </div>
        </>
      )}
    </div>

    {/* ─── Desktop (≥ md) ─ unchanged ───────────────────────────────── */}
    <div className="hidden md:block">
    <div className="space-y-6 animate-in fade-in duration-500" dir={dir}>
      {/* Header */}
      <div className="flex items-center gap-4 px-2">
        <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center text-primary">
          <SearchCheck className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-primary">
            {lang === "ar" ? "إعدادات SEO والاكتشاف" : "SEO & Discoverability Settings"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lang === "ar"
              ? "إدارة ميتاداتا الموقع، العلامة التجارية، التحليلات، وإعدادات محركات البحث"
              : "Manage site metadata, brand assets, analytics, and search engine settings"}
          </p>
        </div>
      </div>

      <Tabs defaultValue="metadata" dir={dir}>
        <TabsList className="flex flex-wrap gap-1 h-auto p-1">
          <TabsTrigger value="metadata" className="gap-2">
            <Globe className="h-4 w-4" />
            {lang === "ar" ? "ميتاداتا SEO" : "SEO Metadata"}
          </TabsTrigger>
          <TabsTrigger value="assets" className="gap-2">
            <ImageIcon className="h-4 w-4" />
            {lang === "ar" ? "العلامة التجارية" : "Brand Assets"}
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <Tag className="h-4 w-4" />
            {lang === "ar" ? "التحليلات" : "Analytics"}
          </TabsTrigger>
          <TabsTrigger value="verification" className="gap-2">
            <Shield className="h-4 w-4" />
            {lang === "ar" ? "التحقق" : "Verification"}
          </TabsTrigger>
          <TabsTrigger value="robots" className="gap-2">
            <Code2 className="h-4 w-4" />
            robots.txt
          </TabsTrigger>
          <TabsTrigger value="schema" className="gap-2">
            <Building2 className="h-4 w-4" />
            Schema.org
          </TabsTrigger>
        </TabsList>

        {/* ─── A: SEO Metadata ─────────────────────────────────────────── */}
        <TabsContent value="metadata">
          <Card className="p-6 space-y-5">
            <div>
              <h3 className="font-semibold text-primary">
                {lang === "ar" ? "ميتاداتا SEO الافتراضية" : "Default SEO Metadata"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {lang === "ar"
                  ? "هذه القيم تُطبَّق على جميع الصفحات العامة. تُغيِّر هذا الحقل فيصبح فعّالاً فوراً."
                  : "These values apply globally to all public pages and take effect immediately."}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{lang === "ar" ? "عنوان الموقع (افتراضي)" : "Site Title (default)"}</label>
                <Input value={siteTitle} onChange={(e) => setSiteTitle(e.target.value)} placeholder="Mimaric | منصة إدارة العقارات" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{lang === "ar" ? "قالب العنوان" : "Title Template"}</label>
                <Input value={siteTitleTemplate} onChange={(e) => setSiteTitleTemplate(e.target.value)} placeholder="%s | Mimaric" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">{lang === "ar" ? "الوصف (عربي)" : "Description (Arabic)"}</label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                rows={3}
                value={siteDescriptionAr}
                onChange={(e) => setSiteDescriptionAr(e.target.value)}
                dir="rtl"
                placeholder="منصة PropTech السعودية لمطوري العقارات..."
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">{lang === "ar" ? "الوصف (إنجليزي)" : "Description (English)"}</label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                rows={3}
                value={siteDescriptionEn}
                onChange={(e) => setSiteDescriptionEn(e.target.value)}
                dir="ltr"
                placeholder="The Saudi PropTech platform for real estate developers..."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{lang === "ar" ? "الرابط الأساسي (Canonical)" : "Canonical Base URL"}</label>
                <Input value={canonicalUrl} onChange={(e) => setCanonicalUrl(e.target.value)} placeholder="https://mimaric.app" dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{lang === "ar" ? "لغة Open Graph" : "OG Locale"}</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  value={ogLocale}
                  onChange={(e) => setOgLocale(e.target.value)}
                >
                  <option value="ar_SA">ar_SA — Arabic (Saudi)</option>
                  <option value="en_US">en_US — English</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{lang === "ar" ? "حساب Twitter/X" : "Twitter/X Handle"}</label>
                <Input value={twitterHandle} onChange={(e) => setTwitterHandle(e.target.value)} placeholder="@mimaric_sa" dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{lang === "ar" ? "نوع Twitter Card" : "Twitter Card Type"}</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  value={twitterCard}
                  onChange={(e) => setTwitterCard(e.target.value)}
                >
                  <option value="summary_large_image">summary_large_image (recommended)</option>
                  <option value="summary">summary</option>
                </select>
              </div>
            </div>

            <Button
              onClick={() => save("metadata", { siteTitle, siteTitleTemplate, siteDescriptionAr, siteDescriptionEn, canonicalUrl, ogLocale, twitterHandle, twitterCard })}
              disabled={saving === "metadata"}
              style={{ display: "inline-flex" }}
            >
              <Save className="h-4 w-4 me-2" />
              {saving === "metadata" ? (lang === "ar" ? "جارٍ الحفظ..." : "Saving...") : (lang === "ar" ? "حفظ الميتاداتا" : "Save Metadata")}
            </Button>
          </Card>
        </TabsContent>

        {/* ─── B: Brand Assets ─────────────────────────────────────────── */}
        <TabsContent value="assets">
          <Card className="p-6 space-y-6">
            <div>
              <h3 className="font-semibold text-primary">
                {lang === "ar" ? "أصول العلامة التجارية" : "Brand Assets"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {lang === "ar"
                  ? "رفع الشعارات، الأيقونة، وصورة الشبكات الاجتماعية. التغييرات تسري فوراً — لا يلزم إعادة النشر."
                  : "Upload logos, favicon, and social sharing image. Changes take effect immediately — no redeployment needed."}
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <AssetUploader
                label={lang === "ar" ? "أيقونة الموقع (Favicon — 32×32)" : "Favicon (32×32 PNG/ICO)"}
                currentUrl={faviconUrl}
                onUploaded={(url) => { setFaviconUrl(url); save("favicon", { faviconUrl: url }); }}
                lang={lang}
              />
              <AssetUploader
                label={lang === "ar" ? "أيقونة Apple Touch (180×180)" : "Apple Touch Icon (180×180)"}
                currentUrl={appleTouchIconUrl}
                onUploaded={(url) => { setAppleTouchIconUrl(url); save("appleTouchIcon", { appleTouchIconUrl: url }); }}
                lang={lang}
              />
              <AssetUploader
                label={lang === "ar" ? "صورة الشبكات الاجتماعية OG (1200×630)" : "OG / Social Image (1200×630)"}
                currentUrl={ogImageUrl}
                onUploaded={(url) => { setOgImageUrl(url); save("ogImage", { ogImageUrl: url }); }}
                lang={lang}
              />
              <AssetUploader
                label={lang === "ar" ? "الشعار الأساسي" : "Primary Logo"}
                currentUrl={logoUrl}
                onUploaded={(url) => { setLogoUrl(url); save("logo", { logoUrl: url }); }}
                lang={lang}
              />
              <AssetUploader
                label={lang === "ar" ? "شعار الوضع الفاتح" : "Light Mode Logo"}
                currentUrl={logoLightUrl}
                onUploaded={(url) => { setLogoLightUrl(url); save("logoLight", { logoLightUrl: url }); }}
                lang={lang}
              />
              <AssetUploader
                label={lang === "ar" ? "شعار الوضع الداكن" : "Dark Mode Logo"}
                currentUrl={logoDarkUrl}
                onUploaded={(url) => { setLogoDarkUrl(url); save("logoDark", { logoDarkUrl: url }); }}
                lang={lang}
              />
            </div>
          </Card>
        </TabsContent>

        {/* ─── C: Analytics / Tag Management ──────────────────────────── */}
        <TabsContent value="analytics">
          <Card className="p-6 space-y-5">
            <div>
              <h3 className="font-semibold text-primary">
                {lang === "ar" ? "إدارة العلامات والتحليلات" : "Tag Management & Analytics"}
              </h3>
              <div className="mt-2 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-4 py-3">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  {lang === "ar"
                    ? "💡 GTM موصى به — يتيح لك إضافة GA4، Meta Pixel، TikTok، Snapchat، LinkedIn، وX من واجهة GTM دون أي تغييرات في الكود."
                    : "💡 GTM is recommended — it lets you add GA4, Meta Pixel, TikTok, Snapchat, LinkedIn, and X from the GTM interface without touching code."}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">
                    {lang === "ar" ? "معرّف GTM Container" : "GTM Container ID"}
                  </label>
                  <Badge>{lang === "ar" ? "موصى به" : "Recommended"}</Badge>
                </div>
                <Input
                  value={gtmContainerId}
                  onChange={(e) => setGtmContainerId(e.target.value.toUpperCase())}
                  placeholder="GTM-XXXXXXX"
                  dir="ltr"
                />
                <p className="text-xs text-muted-foreground">{lang === "ar" ? "يبدأ بـ GTM-" : "Must start with GTM-"}</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  {lang === "ar" ? "معرّف GA4 (بدون GTM فقط)" : "GA4 Measurement ID (only if not using GTM)"}
                </label>
                <Input
                  value={ga4MeasurementId}
                  onChange={(e) => setGa4MeasurementId(e.target.value.toUpperCase())}
                  placeholder="G-XXXXXXXXXX"
                  dir="ltr"
                  disabled={!!gtmContainerId}
                />
                {gtmContainerId && (
                  <p className="text-xs text-muted-foreground">{lang === "ar" ? "معطّل — GTM مفعّل، أضف GA4 من داخله" : "Disabled — GTM is active, add GA4 inside GTM"}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  {lang === "ar" ? "معرّف تحويلات Google Ads" : "Google Ads Conversion ID"}
                </label>
                <Input
                  value={gadsConversionId}
                  onChange={(e) => setGadsConversionId(e.target.value.toUpperCase())}
                  placeholder="AW-XXXXXXXXX"
                  dir="ltr"
                />
              </div>
            </div>

            <Button
              onClick={() => save("analytics", { gtmContainerId: gtmContainerId || null, ga4MeasurementId: ga4MeasurementId || null, gadsConversionId: gadsConversionId || null })}
              disabled={saving === "analytics"}
              style={{ display: "inline-flex" }}
            >
              <Save className="h-4 w-4 me-2" />
              {saving === "analytics" ? (lang === "ar" ? "جارٍ الحفظ..." : "Saving...") : (lang === "ar" ? "حفظ إعدادات التحليلات" : "Save Analytics Settings")}
            </Button>
          </Card>
        </TabsContent>

        {/* ─── D: Webmaster Verification ───────────────────────────────── */}
        <TabsContent value="verification">
          <Card className="p-6 space-y-5">
            <div>
              <h3 className="font-semibold text-primary">
                {lang === "ar" ? "التحقق من ملكية الموقع" : "Webmaster Verification"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {lang === "ar"
                  ? "الصق قيمة content= فقط من الوسم <meta> — لا تصق الوسم كاملاً."
                  : "Paste only the content= value from the <meta> tag — not the full tag."}
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  {lang === "ar" ? "كود التحقق من Google Search Console" : "Google Search Console Verification"}
                </label>
                <Input
                  value={gscVerificationCode}
                  onChange={(e) => setGscVerificationCode(e.target.value)}
                  placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  dir="ltr"
                />
                <p className="text-xs text-muted-foreground">
                  {lang === "ar"
                    ? "مثال: من <meta name=\"google-site-verification\" content=\"ABC123\" /> — الصق ABC123 فقط"
                    : "Example: from <meta name=\"google-site-verification\" content=\"ABC123\" /> — paste only ABC123"}
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  {lang === "ar" ? "كود التحقق من Bing Webmaster" : "Bing Webmaster Verification"}
                </label>
                <Input
                  value={bingVerificationCode}
                  onChange={(e) => setBingVerificationCode(e.target.value)}
                  placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  dir="ltr"
                />
              </div>
            </div>

            <Button
              onClick={() => save("verification", { gscVerificationCode: gscVerificationCode || null, bingVerificationCode: bingVerificationCode || null })}
              disabled={saving === "verification"}
              style={{ display: "inline-flex" }}
            >
              <Save className="h-4 w-4 me-2" />
              {saving === "verification" ? (lang === "ar" ? "جارٍ الحفظ..." : "Saving...") : (lang === "ar" ? "حفظ أكواد التحقق" : "Save Verification Codes")}
            </Button>
          </Card>
        </TabsContent>

        {/* ─── E: robots.txt ───────────────────────────────────────────── */}
        <TabsContent value="robots">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Builder */}
            <Card className="p-6 space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-primary">
                    {lang === "ar" ? "محرر robots.txt" : "robots.txt Editor"}
                  </h3>
                  <div className="flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2 py-0.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                    <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                      {lang === "ar" ? "تحذير" : "Warning"}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {lang === "ar"
                    ? "القواعد الخاطئة تمنع محركات البحث من فهرسة موقعك فوراً."
                    : "Incorrect rules can block search engines from indexing your site immediately."}
                </p>
              </div>

              {robotsRules.map((rule, ri) => (
                <div key={ri} className="rounded-md border border-border p-4 space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">User-agent</label>
                    <Input
                      value={rule.userAgent}
                      onChange={(e) => setRobotsRules((prev) => prev.map((r, i) => i === ri ? { ...r, userAgent: e.target.value } : r))}
                      placeholder="*"
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-green-700 dark:text-green-400 uppercase tracking-wide">Allow</label>
                      <button onClick={() => addPath(ri, "allow")} className="text-xs text-primary hover:underline flex items-center gap-1">
                        <Plus className="h-3 w-3" /> {lang === "ar" ? "إضافة" : "Add"}
                      </button>
                    </div>
                    {rule.allow.map((p, pi) => (
                      <div key={pi} className="flex gap-2">
                        <Input value={p} onChange={(e) => updatePath(ri, "allow", pi, e.target.value)} dir="ltr" className="flex-1" />
                        <button onClick={() => removePath(ri, "allow", pi)} className="text-destructive hover:text-destructive/80" aria-label={lang === "ar" ? "حذف" : "Delete"}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-red-700 dark:text-red-400 uppercase tracking-wide">Disallow</label>
                      <button onClick={() => addPath(ri, "disallow")} className="text-xs text-primary hover:underline flex items-center gap-1">
                        <Plus className="h-3 w-3" /> {lang === "ar" ? "إضافة" : "Add"}
                      </button>
                    </div>
                    {rule.disallow.map((p, pi) => (
                      <div key={pi} className="flex gap-2">
                        <Input value={p} onChange={(e) => updatePath(ri, "disallow", pi, e.target.value)} dir="ltr" className="flex-1" />
                        <button onClick={() => removePath(ri, "disallow", pi)} className="text-destructive hover:text-destructive/80" aria-label={lang === "ar" ? "حذف" : "Delete"}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <Button
                onClick={() => save("robots", { robotsTxtRules: JSON.stringify(robotsRules) })}
                disabled={saving === "robots"}
                style={{ display: "inline-flex" }}
              >
                <Save className="h-4 w-4 me-2" />
                {saving === "robots" ? (lang === "ar" ? "جارٍ الحفظ..." : "Saving...") : (lang === "ar" ? "حفظ robots.txt" : "Save robots.txt")}
              </Button>
            </Card>

            {/* Preview */}
            <Card className="p-6 space-y-3">
              <h3 className="font-semibold text-primary">
                {lang === "ar" ? "معاينة مباشرة" : "Live Preview"}
              </h3>
              <pre className="rounded-md bg-muted p-4 text-xs font-mono leading-relaxed overflow-auto max-h-80 text-foreground/80">
                {renderRobotsPreview(robotsRules)}
                {"\n\nSitemap: https://mimaric.app/sitemap.xml"}
              </pre>
            </Card>
          </div>
        </TabsContent>

        {/* ─── F: Schema.org ───────────────────────────────────────────── */}
        <TabsContent value="schema">
          <Card className="p-6 space-y-5">
            <div>
              <h3 className="font-semibold text-primary">
                {lang === "ar" ? "بيانات Schema.org للمنظمة" : "Organization Schema.org Data"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {lang === "ar"
                  ? "هذه البيانات تُحقن تلقائياً كـ JSON-LD في كل صفحة لتحسين ظهور الموقع في نتائج البحث."
                  : "This data is automatically injected as JSON-LD on every page to improve rich search results."}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{lang === "ar" ? "اسم المنظمة" : "Organization Name"}</label>
                <Input value={schemaOrgName} onChange={(e) => setSchemaOrgName(e.target.value)} placeholder="Mimaric" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{lang === "ar" ? "رابط الشعار" : "Logo URL"}</label>
                <Input value={schemaOrgLogoUrl} onChange={(e) => setSchemaOrgLogoUrl(e.target.value)} placeholder="https://mimaric.app/assets/brand/logo.png" dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Twitter/X</label>
                <Input value={schemaOrgTwitter} onChange={(e) => setSchemaOrgTwitter(e.target.value)} placeholder="https://x.com/mimaric_sa" dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">LinkedIn</label>
                <Input value={schemaOrgLinkedIn} onChange={(e) => setSchemaOrgLinkedIn(e.target.value)} placeholder="https://linkedin.com/company/mimaric" dir="ltr" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-sm font-medium">Instagram</label>
                <Input value={schemaOrgInstagram} onChange={(e) => setSchemaOrgInstagram(e.target.value)} placeholder="https://instagram.com/mimaric_sa" dir="ltr" />
              </div>
            </div>

            <Button
              onClick={() => save("schema", { schemaOrgName, schemaOrgLogoUrl: schemaOrgLogoUrl || null, schemaOrgTwitter: schemaOrgTwitter || null, schemaOrgLinkedIn: schemaOrgLinkedIn || null, schemaOrgInstagram: schemaOrgInstagram || null })}
              disabled={saving === "schema"}
              style={{ display: "inline-flex" }}
            >
              <Save className="h-4 w-4 me-2" />
              {saving === "schema" ? (lang === "ar" ? "جارٍ الحفظ..." : "Saving...") : (lang === "ar" ? "حفظ بيانات Schema" : "Save Schema Data")}
            </Button>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
    </div>
    </>
  );
}
