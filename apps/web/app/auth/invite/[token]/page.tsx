"use client";

import * as React from "react";
import { Button, Input, DirectionalIcon } from "@repo/ui";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Globe,
  Building2,
  ArrowRight,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { MimaricLogo } from "../../../../components/brand/MimaricLogo";
import { PasswordStrengthHint } from "../../../../components/PasswordStrengthHint";
import {
  getInvitationByToken,
  acceptInvitation,
} from "../../../actions/invitations";

const roleLabels: Record<string, { ar: string; en: string }> = {
  SYSTEM_ADMIN: { ar: "مدير المنصة", en: "System Admin" },
  SYSTEM_SUPPORT: { ar: "دعم المنصة", en: "System Support" },
  COMPANY_ADMIN: { ar: "مدير الشركة", en: "Company Admin" },
  // Backward compat
  SUPER_ADMIN: { ar: "مدير الشركة", en: "Company Admin" },
  DEV_ADMIN: { ar: "دعم المنصة", en: "System Support" },
  PROJECT_MANAGER: { ar: "مدير مشاريع", en: "Project Manager" },
  SALES_MANAGER: { ar: "مدير مبيعات", en: "Sales Manager" },
  SALES_AGENT: { ar: "وكيل مبيعات", en: "Sales Agent" },
  PROPERTY_MANAGER: { ar: "مدير عقارات", en: "Property Manager" },
  FINANCE_OFFICER: { ar: "مسؤول مالي", en: "Finance Officer" },
  TECHNICIAN: { ar: "فني صيانة", en: "Technician" },
  BUYER: { ar: "مشتري", en: "Buyer" },
  TENANT: { ar: "مستأجر", en: "Tenant" },
  USER: { ar: "مستخدم", en: "User" },
};

type InvitationData = {
  email: string;
  role: string;
  orgName: string;
  inviterName: string;
  status: string;
};

export default function InviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [lang, setLang] = React.useState<"ar" | "en">("ar");
  const [name, setName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [agreed, setAgreed] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);

  const [fetching, setFetching] = React.useState(true);
  const [invitation, setInvitation] = React.useState<InvitationData | null>(
    null
  );
  const [inviteError, setInviteError] = React.useState<{
    ar: string;
    en: string;
  } | null>(null);

  React.useEffect(() => {
    async function load() {
      try {
        const result = await getInvitationByToken(token);
        if (!result.valid) {
          setInviteError({
            ar: "هذه الدعوة غير صالحة أو منتهية الصلاحية",
            en: result.error || "This invitation is invalid or expired",
          });
        } else {
          setInvitation({
            email: result.email!,
            role: result.role as string,
            orgName: result.orgName!,
            inviterName: result.inviterName ?? "",
            status: "PENDING_INVITE",
          });
        }
      } catch {
        setInviteError({
          ar: "حدث خطأ في تحميل الدعوة",
          en: "Error loading invitation",
        });
      } finally {
        setFetching(false);
      }
    }
    load();
  }, [token]);

  const handleAccept = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await acceptInvitation({ token, name, password });
      if (!result.success) {
        setError(result.error || (lang === "ar" ? "حدث خطأ." : "An error occurred."));
      } else {
        router.push(result.redirect || "/dashboard");
      }
    } catch {
      setError(lang === "ar" ? "حدث خطأ في النظام." : "System error.");
    } finally {
      setLoading(false);
    }
  };

  const roleLang = invitation
    ? roleLabels[invitation.role]?.[lang] || invitation.role
    : "";

  return (
    <div
      className="flex min-h-screen w-full flex-col lg:flex-row"
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      {/* Brand Visual Panel */}
      <div className="relative hidden w-full bg-primary lg:flex lg:w-1/2 xl:w-5/12 overflow-hidden shadow-2xl">
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 10 L10 40 L40 40' stroke='white' fill='none'/%3E%3Ccircle cx='40' cy='40' r='2' fill='white'/%3E%3Cpath d='M60 10 L60 20 L80 20' stroke='white' fill='none'/%3E%3Ccircle cx='80' cy='20' r='2' fill='white'/%3E%3C/svg%3E\")",
          }}
        />
        <div className="relative z-20 flex h-full flex-col justify-between p-12 text-white">
          <MimaricLogo width={180} variant="dark" priority />
          <div className="space-y-6">
            <h1 className="text-4xl font-bold leading-tight xl:text-5xl text-white">
              {lang === "ar"
                ? "انضم إلى فريقك على ميماريك"
                : "Join Your Team on Mimaric"}
            </h1>
            <p className="text-lg text-white/80 max-w-md">
              {lang === "ar"
                ? "تعاون مع فريقك لإدارة عقاراتك بكفاءة واحترافية."
                : "Collaborate with your team to manage properties efficiently and professionally."}
            </p>
          </div>
          <p className="text-xs font-latin uppercase tracking-widest text-white opacity-50">
            © 2026 Mimaric PropTech
          </p>
        </div>
        <div className="absolute -bottom-10 -end-20 opacity-10 transform rotate-3">
          <Building2 className="h-[400px] w-[400px] text-secondary" />
        </div>
      </div>

      {/* Form Area */}
      <div className="flex w-full flex-1 flex-col bg-background lg:w-1/2 xl:w-7/12">
        <div className="flex items-center justify-between p-6 lg:px-12">
          <div className="lg:hidden">
            <MimaricLogo width={100} />
          </div>
          <button
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            <Globe className="h-5 w-5" />
            <span>{lang === "ar" ? "English" : "العربية"}</span>
          </button>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 sm:px-6 pb-12 lg:px-12 lg:pt-0">
          {/* Loading State */}
          {fetching && (
            <div className="flex flex-col items-center justify-center gap-4 py-20">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground font-dm-sans">
                {lang === "ar"
                  ? "جاري تحميل الدعوة..."
                  : "Loading invitation..."}
              </p>
            </div>
          )}

          {/* Error State */}
          {!fetching && inviteError && (
            <div className="flex flex-col items-center justify-center gap-6 py-20 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-primary">
                  {inviteError[lang]}
                </h2>
                <p className="text-sm text-muted-foreground font-dm-sans">
                  {lang === "ar"
                    ? "يرجى التواصل مع مسؤول الفريق للحصول على دعوة جديدة."
                    : "Please contact your team administrator for a new invitation."}
                </p>
              </div>
              <Link
                href="/auth/login"
                className="text-sm font-semibold text-primary hover:underline"
              >
                {lang === "ar"
                  ? "العودة إلى تسجيل الدخول"
                  : "Back to Login"}
              </Link>
            </div>
          )}

          {/* Valid Invitation */}
          {!fetching && invitation && !inviteError && (
            <>
              <div className="mb-8 text-center">
                <h2 className="text-2xl font-bold text-primary">
                  {lang === "ar" ? "قبول الدعوة" : "Accept Invitation"}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground font-dm-sans">
                  {lang === "ar"
                    ? "أكمل بياناتك للانضمام إلى الفريق"
                    : "Complete your details to join the team"}
                </p>
              </div>

              {/* Invitation Info Card */}
              <div className="mb-6 rounded-lg border border-secondary/20 bg-secondary/5 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck
                    className="h-6 w-6 mt-0.5 shrink-0 text-secondary"
                  />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-primary font-dm-sans">
                      {lang === "ar"
                        ? `لقد تمت دعوتك للانضمام إلى ${invitation.orgName} بصفة ${roleLang}`
                        : `You've been invited to join ${invitation.orgName} as ${roleLang}`}
                    </p>
                    <p className="text-xs text-muted-foreground font-dm-sans">
                      {lang === "ar"
                        ? `بواسطة ${invitation.inviterName}`
                        : `Invited by ${invitation.inviterName}`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Form */}
              <div className="space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                    {lang === "ar" ? "الاسم الكامل" : "Full Name"}
                  </label>
                  <Input
                    placeholder={
                      lang === "ar" ? "عمر الغامدي" : "Omar Alghamdi"
                    }
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                    {lang === "ar" ? "البريد الإلكتروني" : "Email"}
                  </label>
                  <Input
                    type="email"
                    value={invitation.email}
                    disabled
                    className="bg-muted cursor-not-allowed opacity-70"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                    {lang === "ar" ? "كلمة المرور" : "Password"}
                  </label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                    </button>
                  </div>
                  <PasswordStrengthHint
                    password={password}
                    lang={lang}
                    context={{ name, email: invitation.email }}
                  />
                </div>

                <div className="flex items-start gap-3 py-2">
                  <input
                    type="checkbox"
                    id="terms"
                    className="mt-1 accent-secondary"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                  />
                  <label
                    htmlFor="terms"
                    className="text-xs text-muted-foreground leading-relaxed font-dm-sans"
                  >
                    {lang === "ar"
                      ? "أوافق على شروط الخدمة وسياسة الخصوصية الخاصة بـ Mimaric"
                      : "I agree to Mimaric's Terms of Service and Privacy Policy"}
                  </label>
                </div>

                <Button
                  className="w-full"
                 
                  onClick={handleAccept}
                  disabled={loading || !name || !password || !agreed}
                >
                  {loading ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <>
                      {lang === "ar" ? "قبول والانضمام" : "Accept & Join"}
                      <DirectionalIcon icon={ArrowRight} className="ms-2" />
                    </>
                  )}
                </Button>
              </div>

              <p className="mt-6 text-center text-sm text-muted-foreground font-dm-sans">
                {lang === "ar" ? "لديك حساب بالفعل؟" : "Already have an account?"}{" "}
                <Link
                  href="/auth/login"
                  className="font-semibold text-primary hover:underline"
                >
                  {lang === "ar" ? "تسجيل الدخول" : "Login"}
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
