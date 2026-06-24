"use client";

import { useLanguage } from "../../../components/LanguageProvider";
import * as React from "react";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  Search,
  UserPlus,
  Mail,
  X,
} from "lucide-react";
import { Button, IconButton, Input, AppBar, DirectionalIcon, PageIntro, CRInput, SaudiPhoneInput, SelectField } from "@repo/ui";
import { cn } from "@repo/ui/lib/utils";
import { useRouter } from "next/navigation";
import {
  lookupOrgByCR,
  createJoinRequest,
  updateOnboardingOrg,
  updateOnboardingContact,
  completeOnboarding,
} from "../../actions/onboarding";
import { createInvitation } from "../../actions/invitations";
import { CUSTOMER_ASSIGNABLE_ROLES } from "../../../lib/permissions";
import { KSA_CITIES } from "../../../lib/ksa-cities";

// ─── Constants ────────────────────────────────────────────────────────────────

const selectClass =
  "w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const roleLabels: Record<string, { ar: string; en: string }> = {
  ADMIN:      { ar: "مدير", en: "Admin" },
  MANAGER:    { ar: "مدير عمليات", en: "Manager" },
  LEASING:    { ar: "مسؤول تأجير", en: "Leasing" },
  FINANCE:    { ar: "مسؤول مالي", en: "Finance" },
  AGENT:      { ar: "وكيل", en: "Agent" },
  TECHNICIAN: { ar: "فني صيانة", en: "Technician" },
  USER:       { ar: "مستخدم", en: "User" },
};

const inviteRoleOptions = CUSTOMER_ASSIGNABLE_ROLES.map((role) => ({
  value: role,
  label: roleLabels[role] ?? { ar: role, en: role },
}));

const entityTypeOptions = [
  { value: "ESTABLISHMENT",         ar: "مؤسسة",              en: "Establishment" },
  { value: "COMPANY",               ar: "شركة",               en: "Company" },
  { value: "BRANCH",                ar: "فرع",                en: "Branch" },
  { value: "PROFESSIONAL_ENTITY",   ar: "كيان مهني",          en: "Professional Entity" },
  { value: "FOREIGN_COMPANY_BRANCH", ar: "فرع شركة أجنبية",  en: "Foreign Company Branch" },
];

const legalFormOptions = [
  { value: "SOLE_PROPRIETORSHIP",            ar: "مؤسسة فردية",                  en: "Sole Proprietorship" },
  { value: "LIMITED_LIABILITY_COMPANY",      ar: "شركة ذات مسؤولية محدودة",      en: "LLC" },
  { value: "JOINT_STOCK_COMPANY",            ar: "شركة مساهمة",                  en: "Joint Stock Company" },
  { value: "SIMPLIFIED_JOINT_STOCK_COMPANY", ar: "شركة مساهمة مبسطة",            en: "Simplified JSC" },
  { value: "GENERAL_PARTNERSHIP",            ar: "شركة تضامنية",                 en: "General Partnership" },
  { value: "LIMITED_PARTNERSHIP",            ar: "شركة توصية",                   en: "Limited Partnership" },
  { value: "PROFESSIONAL_COMPANY",           ar: "شركة مهنية",                   en: "Professional Company" },
];

// Step machine: 4 setup steps + done state.
// Index 0 = join, 1 = org, 2 = contact, 3 = team, 4 = done.
// "join" is a choice step (no Back). Steps 1–3 have Back + Skip + Save.
const steps = [
  { id: "join",    label: { ar: "الانضمام", en: "Join" } },
  { id: "org",     label: { ar: "المنشأة",  en: "Organization" } },
  { id: "contact", label: { ar: "التواصل",  en: "Contact" } },
  { id: "team",    label: { ar: "الفريق",   en: "Team" } },
  { id: "done",    label: { ar: "تم",       en: "Done" } },
];

// ─── Invite row type ───────────────────────────────────────────────────────────

type InviteRow = { email: string; role: string };
const EMPTY_INVITE: InviteRow = { email: "", role: "AGENT" };

// ─── Component ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const [currentStep, setCurrentStep] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  // ─── "done" step variant ────────────────────────────────────────────────────
  // "normal" = completed own setup; "join_requested" = sent join request
  const [doneVariant, setDoneVariant] = React.useState<"normal" | "join_requested">("normal");

  // ─── Step 1 (join): join vs. independent choice ─────────────────────────────
  type JoinChoice = "none" | "join" | "independent";
  const [joinChoice, setJoinChoice] = React.useState<JoinChoice>("none");

  // Join sub-flow state
  const [crSearch, setCrSearch] = React.useState("");
  const [crSearchResult, setCrSearchResult] = React.useState<
    | null
    | { found: true; orgId: string; maskedName: string }
    | { found: false; error?: string }
  >(null);
  const [joinReason, setJoinReason] = React.useState("");
  const [joinLoading, setJoinLoading] = React.useState(false);

  // ─── Step 2 (org): org info ─────────────────────────────────────────────────
  const [orgForm, setOrgForm] = React.useState({
    nameArabic: "",
    nameEnglish: "",
    crNumber: "",
    vatNumber: "",
    entityType: "",
    legalForm: "",
  });
  const setOrg = (k: keyof typeof orgForm, v: string) =>
    setOrgForm((p) => ({ ...p, [k]: v }));

  // ─── Step 3 (contact): contact info ─────────────────────────────────────────
  const [contactForm, setContactForm] = React.useState({
    mobileNumber: "",
    city: "",
    region: "",
  });
  const setContact = (k: keyof typeof contactForm, v: string) =>
    setContactForm((p) => ({ ...p, [k]: v }));

  // ─── Step 4 (team): invite rows ─────────────────────────────────────────────
  const [inviteRows, setInviteRows] = React.useState<InviteRow[]>([{ ...EMPTY_INVITE }]);
  const setInviteRow = (i: number, k: keyof InviteRow, v: string) =>
    setInviteRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const addInviteRow = () => setInviteRows((r) => [...r, { ...EMPTY_INVITE }]);
  const removeInviteRow = (i: number) =>
    setInviteRows((rows) => rows.length > 1 ? rows.filter((_, idx) => idx !== i) : rows);

  // ─── Navigation helpers ─────────────────────────────────────────────────────

  const goNext = () => {
    setError("");
    setCurrentStep((p) => Math.min(p + 1, steps.length - 1));
  };

  const goPrev = () => {
    setError("");
    setCurrentStep((p) => Math.max(p - 1, 0));
  };

  const goToDone = (variant: "normal" | "join_requested") => {
    setError("");
    setDoneVariant(variant);
    setCurrentStep(steps.findIndex((s) => s.id === "done"));
  };

  // ─── Step handlers ──────────────────────────────────────────────────────────

  const handleCRLookup = async () => {
    setCrSearchResult(null);
    if (!crSearch) return;
    setJoinLoading(true);
    setError("");
    try {
      const result = await lookupOrgByCR(crSearch);
      if (result.found) {
        setCrSearchResult({
          found: true,
          orgId: result.orgId ?? "",
          maskedName: result.maskedName ?? "",
        });
      } else {
        setCrSearchResult({ found: false, error: result.error });
      }
    } catch {
      setError(t("فشل في البحث. يرجى المحاولة مجدداً.", "Search failed. Please try again."));
    } finally {
      setJoinLoading(false);
    }
  };

  const handleSendJoinRequest = async () => {
    if (!crSearchResult || !crSearchResult.found) return;
    setLoading(true);
    setError("");
    try {
      const result = await createJoinRequest({
        targetOrgId: crSearchResult.orgId,
        crNumber: crSearch,
        reason: joinReason || undefined,
      });
      if (!result.success) {
        const msgMap: Record<string, { ar: string; en: string }> = {
          ALREADY_IN_ORG:         { ar: "أنت بالفعل عضو في هذه المنشأة.",        en: "You are already a member of this organization." },
          REQUEST_ALREADY_EXISTS: { ar: "لديك طلب انضمام معلق بالفعل.",          en: "You already have a pending join request." },
          CREATE_FAILED:          { ar: "فشل إرسال الطلب. يرجى المحاولة مجدداً.", en: "Failed to send request. Please try again." },
        };
        const msg = result.error ? msgMap[result.error] : undefined;
        setError(msg ? msg[lang] : (t("فشل إرسال الطلب.", "Failed to send request.")));
        return;
      }
      goToDone("join_requested");
    } catch {
      setError(t("فشل إرسال الطلب. يرجى المحاولة مجدداً.", "Failed to send request. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOrg = async (skip = false) => {
    if (skip) { goNext(); return; }
    setLoading(true);
    setError("");
    try {
      const payload = {
        nameArabic:  orgForm.nameArabic  || undefined,
        nameEnglish: orgForm.nameEnglish || undefined,
        crNumber:    orgForm.crNumber    || undefined,
        vatNumber:   orgForm.vatNumber   || undefined,
        entityType:  orgForm.entityType  || undefined,
        legalForm:   orgForm.legalForm   || undefined,
      };
      const result = await updateOnboardingOrg(payload);
      if (!result.success) {
        const msgMap: Record<string, { ar: string; en: string }> = {
          INVALID_CR_FORMAT: { ar: "صيغة رقم السجل التجاري غير صحيحة (10 أرقام).",    en: "Invalid CR format — must be 10 digits." },
          INVALID_VAT_FORMAT: { ar: "صيغة الرقم الضريبي غير صحيحة.",                  en: "Invalid VAT format." },
          CR_TAKEN:           { ar: "رقم السجل التجاري مسجل لمنشأة أخرى.",            en: "CR number is already taken." },
          VAT_TAKEN:          { ar: "الرقم الضريبي مسجل لمنشأة أخرى.",               en: "VAT number is already taken." },
          UPDATE_FAILED:      { ar: "فشل في حفظ البيانات. يرجى المحاولة مجدداً.",     en: "Failed to save. Please try again." },
        };
        const msg = result.error ? msgMap[result.error] : undefined;
        setError(msg ? msg[lang] : (t("فشل في حفظ البيانات.", "Failed to save.")));
        return;
      }
      goNext();
    } catch {
      setError(t("فشل في حفظ البيانات. يرجى المحاولة مجدداً.", "Failed to save. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveContact = async (skip = false) => {
    if (skip) { goNext(); return; }
    setLoading(true);
    setError("");
    try {
      const payload = {
        mobileNumber: contactForm.mobileNumber || undefined,
        city:         contactForm.city         || undefined,
        region:       contactForm.region       || undefined,
      };
      const result = await updateOnboardingContact(payload);
      if (!result.success) {
        setError(t("فشل في حفظ بيانات التواصل. يرجى المحاولة مجدداً.", "Failed to save contact info. Please try again."));
        return;
      }
      goNext();
    } catch {
      setError(t("فشل في حفظ بيانات التواصل. يرجى المحاولة مجدداً.", "Failed to save contact info. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleFinishTeam = async (skip = false) => {
    setLoading(true);
    setError("");
    try {
      // Send any filled invite rows (best-effort — don't block completion on failures)
      if (!skip) {
        const filledRows = inviteRows.filter((r) => r.email.trim());
        for (const row of filledRows) {
          await createInvitation({ email: row.email.trim(), role: row.role });
        }
      }
      await completeOnboarding();
      goToDone("normal");
    } catch {
      setError(t("حدث خطأ. يرجى المحاولة مجدداً.", "Something went wrong. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  // ─── Derived UI helpers ─────────────────────────────────────────────────────

  const currentStepId  = steps[currentStep]?.id ?? "join";
  const currentStepObj = steps[currentStep];
  const isDoneStep     = currentStepId === "done";

  // Progress excludes the "done" step from the count so bar fills to 100% on the last setup step.
  const setupStepCount = steps.length - 1; // 4
  const progressPct    = (currentStep / setupStepCount) * 100;

  // Mobile primary CTA label + handler
  const mobilePrimaryLabel = React.useMemo(() => {
    if (currentStepId === "join") {
      if (joinChoice === "join" && crSearchResult?.found) return t("إرسال طلب الانضمام", "Send Join Request");
      if (joinChoice === "independent")                   return t("المتابعة", "Continue");
      return t("اختيار", "Select");
    }
    if (currentStepId === "org")     return t("حفظ ومتابعة", "Save & Continue");
    if (currentStepId === "contact") return t("حفظ ومتابعة", "Save & Continue");
    if (currentStepId === "team")    return t("إنهاء الإعداد", "Finish Setup");
    return t("الذهاب إلى لوحة التحكم", "Go to Dashboard");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` is derived from `lang`, which is already a dep; listing `lang` covers every translation read here.
  }, [currentStepId, joinChoice, crSearchResult, lang]);

  const handleMobilePrimary = () => {
    if (currentStepId === "join") {
      if (joinChoice === "join" && crSearchResult?.found) return handleSendJoinRequest();
      if (joinChoice === "independent")                   return goNext();
      return; // no choice yet — button is disabled
    }
    if (currentStepId === "org")     return handleSaveOrg();
    if (currentStepId === "contact") return handleSaveContact();
    if (currentStepId === "team")    return handleFinishTeam();
    if (isDoneStep)                  return router.push("/dashboard");
  };

  const mobilePrimaryDisabled =
    loading ||
    (currentStepId === "join" && joinChoice === "none") ||
    (currentStepId === "join" && joinChoice === "join" && !crSearchResult?.found);

  // ─── Join step error display helper ─────────────────────────────────────────
  function crLookupErrorMessage(code?: string): string {
    const msgMap: Record<string, { ar: string; en: string }> = {
      INVALID_CR_FORMAT: { ar: "رقم السجل التجاري يجب أن يكون 10 أرقام.", en: "CR must be exactly 10 digits." },
      TOO_MANY_LOOKUPS:  { ar: "تجاوزت الحد المسموح. يرجى الانتظار قليلاً.", en: "Too many searches. Please wait." },
      LOOKUP_FAILED:     { ar: "فشل في البحث. يرجى المحاولة مجدداً.", en: "Search failed. Please try again." },
    };
    if (!code) return t("المنشأة غير موجودة في النظام.", "Organization not found in the system.");
    return (msgMap[code] ?? { ar: "خطأ غير متوقع.", en: "Unexpected error." })[lang];
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
    {/* ─── Mobile (< md) ──────────────────────────────────────────────── */}
    <div
      dir={lang === "ar" ? "rtl" : "ltr"}
      className="md:hidden -m-4 sm:-m-6 min-h-dvh flex flex-col bg-background"
    >
      <AppBar
        title={currentStepObj ? currentStepObj.label[lang] : (t("إعداد الحساب", "Setup"))}
        subtitle={
          isDoneStep
            ? undefined
            : lang === "ar"
              ? `الخطوة ${currentStep + 1} من ${setupStepCount}`
              : `Step ${currentStep + 1} of ${setupStepCount}`
        }
        lang={lang}
      />

      {/* Progress bar */}
      {!isDoneStep && (
        <div className="h-1 w-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5 pb-[calc(theme(height.mobile-bottomnav)+env(safe-area-inset-bottom)+7rem)]">
        {error && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* ─── Step 1: Join ─── */}
        {currentStepId === "join" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {t("كيف تريد البدء؟", "How would you like to start?")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("انضم إلى منشأة قائمة أو أنشئ مساحة عملك الخاصة.", "Join an existing organization or set up your own workspace.")}
              </p>
            </div>

            {/* Choice cards */}
            <div className="space-y-3">
              <Button
                type="button"
                variant="ghost"
                style={{ display: "block" }}
                onClick={() => { setJoinChoice("join"); setCrSearchResult(null); setCrSearch(""); }}
                className={cn(
                  "w-full text-start rounded-xl border-2 p-4 h-auto transition-all",
                  joinChoice === "join"
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-primary/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn("h-10 w-10 rounded-full flex items-center justify-center shrink-0", joinChoice === "join" ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
                    <UserPlus className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {t("الانضمام إلى منشأة قائمة", "Join an existing company")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("ابحث عن المنشأة عبر رقم السجل التجاري.", "Search by commercial registration number.")}
                    </p>
                  </div>
                </div>
              </Button>

              <Button
                type="button"
                variant="ghost"
                style={{ display: "block" }}
                onClick={() => { setJoinChoice("independent"); setCrSearchResult(null); }}
                className={cn(
                  "w-full text-start rounded-xl border-2 p-4 h-auto transition-all",
                  joinChoice === "independent"
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-primary/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn("h-10 w-10 rounded-full flex items-center justify-center shrink-0", joinChoice === "independent" ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
                    <Check className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {t("المتابعة بشكل مستقل", "Continue independently")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("أنشئ مساحة عمل خاصة بمنشأتك.", "Create your own workspace.")}
                    </p>
                  </div>
                </div>
              </Button>
            </div>

            {/* Join sub-flow */}
            {joinChoice === "join" && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="space-y-2">
                  <label htmlFor="onb-join-cr-m" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {t("رقم السجل التجاري", "Commercial Registration No.")}
                  </label>
                  <div className="flex gap-2">
                    <CRInput
                      id="onb-join-cr-m"
                      value={crSearch}
                      onChange={(raw) => { setCrSearch(raw); setCrSearchResult(null); }}
                      placeholder="1010XXXXXX"
                      className="h-11 flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11 gap-2 shrink-0"
                      style={{ display: "inline-flex" }}
                      onClick={handleCRLookup}
                      disabled={joinLoading || crSearch.length !== 10}
                    >
                      {joinLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      {t("بحث", "Search")}
                    </Button>
                  </div>
                </div>

                {crSearchResult && !crSearchResult.found && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                    {crLookupErrorMessage(crSearchResult.error)}
                  </div>
                )}

                {crSearchResult?.found && (
                  <div className="space-y-3 animate-in fade-in duration-200">
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground mb-1">
                        {t("المنشأة:", "Organization:")}
                      </p>
                      <p className="text-sm font-semibold text-foreground font-mono">{crSearchResult.maskedName}</p>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="onb-join-reason-m" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {t("سبب الطلب (اختياري)", "Reason for joining (optional)")}
                      </label>
                      <textarea
                        id="onb-join-reason-m"
                        value={joinReason}
                        onChange={(e) => setJoinReason(e.target.value)}
                        rows={3}
                        placeholder={
                          t("اذكر سبب رغبتك في الانضمام إلى هذه المنشأة...", "Describe why you want to join this organization...")
                        }
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── Step 2: Org ─── */}
        {currentStepId === "org" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {t("بيانات المنشأة", "Organization Info")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("أضف بيانات منشأتك. يمكنك تخطي هذه الخطوة الآن وإكمالها لاحقاً.", "Add your organization details. You can skip this step and complete it later.")}
              </p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="onb-name-ar-m" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {t("الاسم بالعربي", "Arabic Name")}
                </label>
                <Input id="onb-name-ar-m" value={orgForm.nameArabic} onChange={(e) => setOrg("nameArabic", e.target.value)} placeholder={t("مثال: شركة الأفق العقارية", "e.g. شركة الأفق العقارية")} dir="rtl" className="h-11" />
              </div>
              <div className="space-y-2">
                <label htmlFor="onb-name-en-m" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {t("الاسم بالإنجليزي", "English Name")}
                </label>
                <Input id="onb-name-en-m" value={orgForm.nameEnglish} onChange={(e) => setOrg("nameEnglish", e.target.value)} placeholder="e.g. Al Ufuq Real Estate" dir="ltr" className="h-11" />
              </div>
              <div className="space-y-2">
                <label htmlFor="onb-cr-m" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {t("رقم السجل التجاري", "CR Number")}
                </label>
                <CRInput id="onb-cr-m" value={orgForm.crNumber} onChange={(raw) => setOrg("crNumber", raw)} placeholder="1010XXXXXX" className="h-11" />
              </div>
              <div className="space-y-2">
                <label htmlFor="onb-vat-m" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {t("الرقم الضريبي", "VAT Number")}
                </label>
                <Input id="onb-vat-m" value={orgForm.vatNumber} onChange={(e) => setOrg("vatNumber", e.target.value)} placeholder="3000XXXXXX00003" dir="ltr" className="h-11 font-mono tabular-nums" />
              </div>
              <div className="space-y-2">
                <label htmlFor="onb-entity-m" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {t("نوع المنشأة", "Entity Type")}
                </label>
                <SelectField id="onb-entity-m" aria-label={t("نوع المنشأة", "Entity Type")} value={orgForm.entityType} onChange={(e) => setOrg("entityType", e.target.value)} className={cn(selectClass, "h-11")}>
                  <option value="">{t("اختر...", "Select...")}</option>
                  {entityTypeOptions.map((o) => (
                    <option key={o.value} value={o.value}>{lang === "ar" ? o.ar : o.en}</option>
                  ))}
                </SelectField>
              </div>
              <div className="space-y-2">
                <label htmlFor="onb-legal-m" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {t("الشكل القانوني", "Legal Form")}
                </label>
                <SelectField id="onb-legal-m" aria-label={t("الشكل القانوني", "Legal Form")} value={orgForm.legalForm} onChange={(e) => setOrg("legalForm", e.target.value)} className={cn(selectClass, "h-11")}>
                  <option value="">{t("اختر...", "Select...")}</option>
                  {legalFormOptions.map((o) => (
                    <option key={o.value} value={o.value}>{lang === "ar" ? o.ar : o.en}</option>
                  ))}
                </SelectField>
              </div>
            </div>
            <Button type="button" variant="link" onClick={() => handleSaveOrg(true)} disabled={loading} className="w-full min-h-11 text-sm text-muted-foreground hover:text-foreground">
              {t("تخطي هذه الخطوة", "Skip this step")}
            </Button>
          </div>
        )}

        {/* ─── Step 3: Contact ─── */}
        {currentStepId === "contact" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {t("بيانات التواصل", "Contact Info")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("أضف رقم الجوال والمدينة. يمكنك تخطي هذه الخطوة.", "Add your mobile and city. You can skip this step.")}
              </p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="onb-mobile-m" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {t("رقم الجوال", "Mobile Number")}
                </label>
                <SaudiPhoneInput id="onb-mobile-m" value={contactForm.mobileNumber} onChange={(e164) => setContact("mobileNumber", e164)} placeholder="05XXXXXXXX" className="h-11" />
              </div>
              <div className="space-y-2">
                <label htmlFor="onb-city-m" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {t("المدينة", "City")}
                </label>
                <SelectField id="onb-city-m" aria-label={t("المدينة", "City")} value={contactForm.city} onChange={(e) => setContact("city", e.target.value)} className={cn(selectClass, "h-11")}>
                  <option value="">{t("اختر المدينة...", "Select city...")}</option>
                  {KSA_CITIES.map((city) => (
                    <option key={city.value} value={city.value}>
                      {lang === "ar" ? city.labelAr : city.labelEn}
                    </option>
                  ))}
                </SelectField>
              </div>
              <div className="space-y-2">
                <label htmlFor="onb-region-m" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {t("المنطقة", "Region")}
                </label>
                <Input id="onb-region-m" value={contactForm.region} onChange={(e) => setContact("region", e.target.value)} placeholder={t("مثال: منطقة الرياض", "e.g. Riyadh Region")} className="h-11" />
              </div>
            </div>
            <Button type="button" variant="link" onClick={() => handleSaveContact(true)} disabled={loading} className="w-full min-h-11 text-sm text-muted-foreground hover:text-foreground">
              {t("تخطي هذه الخطوة", "Skip this step")}
            </Button>
          </div>
        )}

        {/* ─── Step 4: Team ─── */}
        {currentStepId === "team" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {t("دعوة أعضاء الفريق", "Invite Team Members")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("أرسل دعوات لزملائك. يمكنك تخطي هذه الخطوة.", "Send invitations to your colleagues. You can skip this step.")}
              </p>
            </div>
            <div className="space-y-3">
              {inviteRows.map((row, i) => (
                <div key={i} className="space-y-2 rounded-lg border border-border bg-card/50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">
                      {lang === "ar" ? `دعوة ${i + 1}` : `Invite ${i + 1}`}
                    </span>
                    {inviteRows.length > 1 && (
                      <IconButton
                        icon={X}
                        type="button"
                        onClick={() => removeInviteRow(i)}
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={t("إزالة", "Remove")}
                      />
                    )}
                  </div>
                  <Input
                    id={`onb-invite-email-m-${i}`}
                    type="email"
                    value={row.email}
                    onChange={(e) => setInviteRow(i, "email", e.target.value)}
                    placeholder="name@example.com"
                    aria-label={lang === "ar" ? `البريد الإلكتروني للدعوة ${i + 1}` : `Invite ${i + 1} email`}
                    dir="ltr"
                    className="h-11"
                  />
                  <SelectField id={`onb-invite-role-m-${i}`} aria-label={t("الدور", "Role")} value={row.role} onChange={(e) => setInviteRow(i, "role", e.target.value)} className={cn(selectClass, "h-11")}>
                    {inviteRoleOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label[lang]}</option>
                    ))}
                  </SelectField>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={addInviteRow} className="w-full min-h-11 gap-2" style={{ display: "inline-flex" }}>
                <Mail className="h-4 w-4" />
                {t("إضافة دعوة أخرى", "Add another invite")}
              </Button>
            </div>
            <Button type="button" variant="link" onClick={() => handleFinishTeam(true)} disabled={loading} className="w-full min-h-11 text-sm text-muted-foreground hover:text-foreground">
              {t("تخطي هذه الخطوة", "Skip this step")}
            </Button>
          </div>
        )}

        {/* ─── Done ─── */}
        {currentStepId === "done" && (
          <div className="flex flex-col items-center justify-center py-10 space-y-5 animate-in fade-in duration-300">
            <div className="h-20 w-20 rounded-full bg-success/15 flex items-center justify-center">
              <Check className="h-10 w-10 text-success" aria-hidden="true" />
            </div>
            <div className="text-center space-y-2 max-w-sm">
              {doneVariant === "join_requested" ? (
                <>
                  <h2 className="text-xl font-bold text-foreground">
                    {t("تم إرسال طلب الانضمام!", "Join request submitted!")}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t("سيقوم مدير المنشأة بمراجعة طلبك والرد عليه خلال فترة قصيرة.", "The organization admin will review your request and respond shortly.")}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 gap-1.5"
                    style={{ display: "inline-flex" }}
                    onClick={() => router.push("/dashboard/help#join-requests")}
                  >
                    {t("متابعة حالة الطلب", "Check request status")}
                  </Button>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-foreground">
                    {t("تم إعداد حسابك بنجاح!", "Your account is ready!")}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t("يمكنك الآن الانتقال إلى لوحة التحكم وإدارة منشأتك.", "You can now go to the dashboard and manage your organization.")}
                  </p>
                </>
              )}
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
          {currentStep > 0 && !isDoneStep && (
            <Button
              variant="outline"
              className="min-h-11 gap-2"
              style={{ display: "inline-flex" }}
              onClick={goPrev}
              disabled={loading}
            >
              <DirectionalIcon icon={ArrowLeft} className="h-4 w-4" aria-hidden="true" />
              {t("السابق", "Back")}
            </Button>
          )}
          <Button
            className="flex-1 min-h-11 gap-2"
            style={{ display: "inline-flex" }}
            onClick={handleMobilePrimary}
            disabled={mobilePrimaryDisabled}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {mobilePrimaryLabel}
            {!isDoneStep && !loading && <DirectionalIcon icon={ArrowRight} className="h-4 w-4" aria-hidden="true" />}
          </Button>
        </div>
      </div>
    </div>

    {/* ─── Desktop (≥ md) ─────────────────────────────────────────────── */}
    <div className="hidden md:block">
    <div
      dir={lang === "ar" ? "rtl" : "ltr"}
      className="min-h-screen bg-muted/30"
    >
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8 animate-in fade-in duration-500">
        <PageIntro
          title={t("إعداد حسابك", "Set Up Your Account")}
          description={
            t("أكمل الخطوات التالية لتفعيل حسابك على معمارك.", "Complete the following steps to activate your Mimarek account.")
          }
        />

        {/* Stepper (only while setup steps visible) */}
        {!isDoneStep && (
          <div className="relative h-1 bg-muted rounded-full mx-8">
            <div
              className="absolute h-full bg-secondary rounded-full transition-all duration-500"
              style={{
                width: `${(currentStep / (steps.length - 1)) * 100}%`,
                [t("right", "left")]: 0,
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
        )}

        {/* Step Content */}
        <div className={isDoneStep ? "" : "pt-10"}>
          <div className="bg-card rounded-xl border border-border shadow-sm p-8 min-h-[400px]">
            {/* Error Banner */}
            {error && (
              <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
                {error}
              </div>
            )}

            {/* ─── Step 1: Join ─── */}
            {currentStepId === "join" && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-primary">
                    {t("كيف تريد البدء؟", "How would you like to start?")}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("انضم إلى منشأة قائمة أو أنشئ مساحة عملك الخاصة.", "Join an existing organization or set up your own workspace.")}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button
                    type="button"
                    variant="ghost"
                    style={{ display: "block" }}
                    onClick={() => { setJoinChoice("join"); setCrSearchResult(null); setCrSearch(""); }}
                    className={cn(
                      "text-start rounded-xl border-2 p-5 h-auto transition-all",
                      joinChoice === "join"
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary/50"
                    )}
                  >
                    <div className={cn("h-12 w-12 rounded-full flex items-center justify-center mb-3", joinChoice === "join" ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
                      <UserPlus className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                      {t("الانضمام إلى منشأة قائمة", "Join an existing company")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("ابحث عبر رقم السجل التجاري.", "Search by commercial registration number.")}
                    </p>
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    style={{ display: "block" }}
                    onClick={() => { setJoinChoice("independent"); setCrSearchResult(null); }}
                    className={cn(
                      "text-start rounded-xl border-2 p-5 h-auto transition-all",
                      joinChoice === "independent"
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary/50"
                    )}
                  >
                    <div className={cn("h-12 w-12 rounded-full flex items-center justify-center mb-3", joinChoice === "independent" ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
                      <Check className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                      {t("المتابعة بشكل مستقل", "Continue independently")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("أنشئ مساحة عمل خاصة بمنشأتك.", "Create your own workspace.")}
                    </p>
                  </Button>
                </div>

                {/* Join sub-flow — desktop */}
                {joinChoice === "join" && (
                  <div className="space-y-4 animate-in fade-in duration-200 pt-2">
                    <div className="space-y-2">
                      <label htmlFor="onb-join-cr-d" className="text-xs font-medium text-muted-foreground">
                        {t("رقم السجل التجاري", "Commercial Registration No.")}
                      </label>
                      <div className="flex gap-2">
                        <CRInput
                          id="onb-join-cr-d"
                          value={crSearch}
                          onChange={(raw) => { setCrSearch(raw); setCrSearchResult(null); }}
                          placeholder="1010XXXXXX"
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="gap-2 shrink-0"
                          style={{ display: "inline-flex" }}
                          onClick={handleCRLookup}
                          disabled={joinLoading || crSearch.length !== 10}
                        >
                          {joinLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                          {t("بحث", "Search")}
                        </Button>
                      </div>
                    </div>

                    {crSearchResult && !crSearchResult.found && (
                      <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                        {crLookupErrorMessage(crSearchResult.error)}
                      </div>
                    )}

                    {crSearchResult?.found && (
                      <div className="space-y-4 animate-in fade-in duration-200">
                        <div className="rounded-lg border border-border bg-muted/30 p-4">
                          <p className="text-xs text-muted-foreground mb-1">
                            {t("المنشأة:", "Organization:")}
                          </p>
                          <p className="text-sm font-semibold text-foreground font-mono">{crSearchResult.maskedName}</p>
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="onb-join-reason-d" className="text-xs font-medium text-muted-foreground">
                            {t("سبب الطلب (اختياري)", "Reason for joining (optional)")}
                          </label>
                          <textarea
                            id="onb-join-reason-d"
                            value={joinReason}
                            onChange={(e) => setJoinReason(e.target.value)}
                            rows={3}
                            placeholder={
                              t("اذكر سبب رغبتك في الانضمام إلى هذه المنشأة...", "Describe why you want to join this organization...")
                            }
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-end pt-6 border-t border-border">
                  {joinChoice === "join" && crSearchResult?.found ? (
                    <Button
                      onClick={handleSendJoinRequest}
                      disabled={loading}
                      className="gap-2 px-8"
                      style={{ display: "inline-flex" }}
                    >
                      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                      {t("إرسال طلب الانضمام", "Send Join Request")}
                      <DirectionalIcon icon={ArrowRight} className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      onClick={() => joinChoice === "independent" && goNext()}
                      disabled={loading || joinChoice !== "independent"}
                      className="gap-2 px-8"
                      style={{ display: "inline-flex" }}
                    >
                      {t("المتابعة", "Continue")}
                      <DirectionalIcon icon={ArrowRight} className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* ─── Step 2: Org ─── */}
            {currentStepId === "org" && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-primary">
                    {t("بيانات المنشأة", "Organization Info")}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("أضف بيانات منشأتك. جميع الحقول اختيارية.", "Add your organization details. All fields are optional.")}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label htmlFor="onb-name-ar-d" className="text-xs font-medium text-muted-foreground">
                      {t("الاسم بالعربي", "Arabic Name")}
                    </label>
                    <Input id="onb-name-ar-d" value={orgForm.nameArabic} onChange={(e) => setOrg("nameArabic", e.target.value)} placeholder={t("شركة الأفق العقارية", "شركة الأفق العقارية")} dir="rtl" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="onb-name-en-d" className="text-xs font-medium text-muted-foreground">
                      {t("الاسم بالإنجليزي", "English Name")}
                    </label>
                    <Input id="onb-name-en-d" value={orgForm.nameEnglish} onChange={(e) => setOrg("nameEnglish", e.target.value)} placeholder="Al Ufuq Real Estate" dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="onb-cr-d" className="text-xs font-medium text-muted-foreground">
                      {t("رقم السجل التجاري", "CR Number")}
                    </label>
                    <CRInput id="onb-cr-d" value={orgForm.crNumber} onChange={(raw) => setOrg("crNumber", raw)} placeholder="1010XXXXXX" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="onb-vat-d" className="text-xs font-medium text-muted-foreground">
                      {t("الرقم الضريبي", "VAT Number")}
                    </label>
                    <Input id="onb-vat-d" value={orgForm.vatNumber} onChange={(e) => setOrg("vatNumber", e.target.value)} placeholder="3000XXXXXX00003" dir="ltr" className="font-mono tabular-nums" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="onb-entity-d" className="text-xs font-medium text-muted-foreground">
                      {t("نوع المنشأة", "Entity Type")}
                    </label>
                    <SelectField id="onb-entity-d" aria-label={t("نوع المنشأة", "Entity Type")} value={orgForm.entityType} onChange={(e) => setOrg("entityType", e.target.value)} className={selectClass}>
                      <option value="">{t("اختر...", "Select...")}</option>
                      {entityTypeOptions.map((o) => (
                        <option key={o.value} value={o.value}>{lang === "ar" ? o.ar : o.en}</option>
                      ))}
                    </SelectField>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="onb-legal-d" className="text-xs font-medium text-muted-foreground">
                      {t("الشكل القانوني", "Legal Form")}
                    </label>
                    <SelectField id="onb-legal-d" aria-label={t("الشكل القانوني", "Legal Form")} value={orgForm.legalForm} onChange={(e) => setOrg("legalForm", e.target.value)} className={selectClass}>
                      <option value="">{t("اختر...", "Select...")}</option>
                      {legalFormOptions.map((o) => (
                        <option key={o.value} value={o.value}>{lang === "ar" ? o.ar : o.en}</option>
                      ))}
                    </SelectField>
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
                    {t("السابق", "Back")}
                  </Button>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      onClick={() => handleSaveOrg(true)}
                      disabled={loading}
                      style={{ display: "inline-flex" }}
                    >
                      {t("تخطي", "Skip")}
                    </Button>
                    <Button
                      onClick={() => handleSaveOrg(false)}
                      disabled={loading}
                      className="gap-2 px-8"
                      style={{ display: "inline-flex" }}
                    >
                      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                      {t("حفظ ومتابعة", "Save & Continue")}
                      <DirectionalIcon icon={ArrowRight} className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* ─── Step 3: Contact ─── */}
            {currentStepId === "contact" && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-primary">
                    {t("بيانات التواصل", "Contact Info")}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("أضف رقم الجوال والمدينة. جميع الحقول اختيارية.", "Add your mobile and city. All fields are optional.")}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label htmlFor="onb-mobile-d" className="text-xs font-medium text-muted-foreground">
                      {t("رقم الجوال", "Mobile Number")}
                    </label>
                    <SaudiPhoneInput id="onb-mobile-d" value={contactForm.mobileNumber} onChange={(e164) => setContact("mobileNumber", e164)} placeholder="05XXXXXXXX" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="onb-region-d" className="text-xs font-medium text-muted-foreground">
                      {t("المنطقة", "Region")}
                    </label>
                    <Input id="onb-region-d" value={contactForm.region} onChange={(e) => setContact("region", e.target.value)} placeholder={t("منطقة الرياض", "Riyadh Region")} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label htmlFor="onb-city-d" className="text-xs font-medium text-muted-foreground">
                      {t("المدينة", "City")}
                    </label>
                    <SelectField id="onb-city-d" aria-label={t("المدينة", "City")} value={contactForm.city} onChange={(e) => setContact("city", e.target.value)} className={selectClass}>
                      <option value="">{t("اختر المدينة...", "Select city...")}</option>
                      {KSA_CITIES.map((city) => (
                        <option key={city.value} value={city.value}>
                          {lang === "ar" ? city.labelAr : city.labelEn}
                        </option>
                      ))}
                    </SelectField>
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
                    {t("السابق", "Back")}
                  </Button>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      onClick={() => handleSaveContact(true)}
                      disabled={loading}
                      style={{ display: "inline-flex" }}
                    >
                      {t("تخطي", "Skip")}
                    </Button>
                    <Button
                      onClick={() => handleSaveContact(false)}
                      disabled={loading}
                      className="gap-2 px-8"
                      style={{ display: "inline-flex" }}
                    >
                      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                      {t("حفظ ومتابعة", "Save & Continue")}
                      <DirectionalIcon icon={ArrowRight} className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* ─── Step 4: Team ─── */}
            {currentStepId === "team" && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-primary">
                    {t("دعوة أعضاء الفريق", "Invite Team Members")}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("أرسل دعوات لزملائك لبدء العمل معاً.", "Send invitations to your colleagues to get started together.")}
                  </p>
                </div>

                <div className="space-y-3">
                  {inviteRows.map((row, i) => (
                    <div key={i} className="grid grid-cols-[1fr_180px_auto] gap-3 items-center">
                      <Input
                        id={`onb-invite-email-d-${i}`}
                        type="email"
                        value={row.email}
                        onChange={(e) => setInviteRow(i, "email", e.target.value)}
                        placeholder="name@example.com"
                        aria-label={lang === "ar" ? `البريد الإلكتروني للدعوة ${i + 1}` : `Invite ${i + 1} email`}
                        dir="ltr"
                      />
                      <SelectField id={`onb-invite-role-d-${i}`} aria-label={t("الدور", "Role")} value={row.role} onChange={(e) => setInviteRow(i, "role", e.target.value)} className={selectClass}>
                        {inviteRoleOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label[lang]}</option>
                        ))}
                      </SelectField>
                      <IconButton
                        icon={X}
                        type="button"
                        onClick={() => removeInviteRow(i)}
                        disabled={inviteRows.length === 1}
                        variant="ghost"
                        className="h-10 w-10 rounded-md text-muted-foreground hover:text-destructive disabled:opacity-30"
                        aria-label={t("إزالة", "Remove")}
                      />
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addInviteRow}
                    className="gap-2"
                    style={{ display: "inline-flex" }}
                  >
                    <Mail className="h-4 w-4" />
                    {t("إضافة دعوة", "Add invite")}
                  </Button>
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
                    {t("السابق", "Back")}
                  </Button>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      onClick={() => handleFinishTeam(true)}
                      disabled={loading}
                      style={{ display: "inline-flex" }}
                    >
                      {t("تخطي", "Skip")}
                    </Button>
                    <Button
                      onClick={() => handleFinishTeam(false)}
                      disabled={loading}
                      className="gap-2 px-8"
                      style={{ display: "inline-flex" }}
                    >
                      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                      {t("إنهاء الإعداد", "Finish Setup")}
                      <DirectionalIcon icon={ArrowRight} className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* ─── Done ─── */}
            {currentStepId === "done" && (
              <div className="flex flex-col items-center justify-center py-12 space-y-6 animate-in slide-in-from-right-4 duration-500">
                <div className="h-20 w-20 rounded-full bg-success/15 flex items-center justify-center">
                  <Check className="h-10 w-10 text-success" />
                </div>
                <div className="text-center space-y-2">
                  {doneVariant === "join_requested" ? (
                    <>
                      <h2 className="text-2xl font-bold text-primary">
                        {t("تم إرسال طلب الانضمام!", "Join request submitted!")}
                      </h2>
                      <p className="text-sm text-muted-foreground max-w-sm">
                        {t("سيقوم مدير المنشأة بمراجعة طلبك والرد عليه خلال فترة قصيرة. ستصلك إشعار بالقرار.", "The organization admin will review your request and respond shortly. You will receive a notification with their decision.")}
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-2xl font-bold text-primary">
                        {t("تم إعداد حسابك بنجاح!", "Your account is ready!")}
                      </h2>
                      <p className="text-sm text-muted-foreground max-w-sm">
                        {t("يمكنك الآن الانتقال إلى لوحة التحكم وإدارة منشأتك وعقاراتك.", "You can now go to the dashboard and manage your organization and properties.")}
                      </p>
                    </>
                  )}
                </div>
                <div className="flex flex-col items-center gap-3 pt-2">
                  <Button
                    onClick={() => router.push("/dashboard")}
                    className="gap-2 px-8"
                    style={{ display: "inline-flex" }}
                  >
                    {t("الذهاب إلى لوحة التحكم", "Go to Dashboard")}
                    <DirectionalIcon icon={ArrowRight} className="h-4 w-4" />
                  </Button>
                  {doneVariant === "join_requested" && (
                    <Button
                      variant="outline"
                      onClick={() => router.push("/dashboard/help#join-requests")}
                      className="gap-2"
                      style={{ display: "inline-flex" }}
                    >
                      {t("متابعة حالة الطلب", "Check request status")}
                    </Button>
                  )}
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
