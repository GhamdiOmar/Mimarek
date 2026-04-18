"use client";

import * as React from "react";
import { Suspense } from "react";
import { Button, Input } from "@repo/ui";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Globe, Building2, Loader2, CheckCircle2 } from "lucide-react";
import { MimaricLogo } from "../../../components/brand/MimaricLogo";
import { PasswordStrengthHint } from "../../../components/PasswordStrengthHint";
import { resetPassword } from "../../actions/password";

function ResetPasswordInner() {
  const [lang, setLang] = React.useState<"ar" | "en">("ar");
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const errorMessages: Record<string, { ar: string; en: string }> = {
    INVALID_TOKEN: { ar: "رابط إعادة التعيين غير صالح.", en: "Invalid reset link." },
    TOKEN_USED: { ar: "تم استخدام هذا الرابط بالفعل.", en: "This reset link has already been used." },
    TOKEN_EXPIRED: { ar: "انتهت صلاحية رابط الاستعادة.", en: "This reset link has expired." },
    MISMATCH: { ar: "كلمتا المرور غير متطابقتين.", en: "Passwords do not match." },
  };

  const handleReset = async () => {
    if (password !== confirm) {
      setError(errorMessages.MISMATCH![lang]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await resetPassword(token, password);
      if (result.error) {
        if (result.error === "WEAK_PASSWORD" && result.details) {
          setError(result.details.map((e: any) => e[lang]).join(" "));
        } else {
          const msg = errorMessages[result.error];
          setError(msg ? msg[lang] : (lang === "ar" ? "حدث خطأ." : "An error occurred."));
        }
      } else {
        setSuccess(true);
      }
    } catch {
      setError(lang === "ar" ? "حدث خطأ في النظام." : "System error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* Brand Panel */}
      <div className="relative hidden w-full bg-primary lg:flex lg:w-1/2 xl:w-5/12 overflow-hidden shadow-2xl">
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 10 L10 40 L40 40' stroke='white' fill='none'/%3E%3Ccircle cx='40' cy='40' r='2' fill='white'/%3E%3C/svg%3E")` }} />
        <div className="relative z-20 flex h-full flex-col justify-between p-12 text-white">
          <MimaricLogo width={180} variant="dark" priority />
          <div className="space-y-6">
            <h1 className="text-4xl font-bold leading-tight xl:text-5xl text-white">
              {lang === "ar" ? "إعادة تعيين كلمة المرور" : "Reset Password"}
            </h1>
          </div>
          <p className="text-xs font-latin uppercase tracking-widest text-white opacity-50">© 2026 Mimaric PropTech</p>
        </div>
        <div className="absolute -bottom-10 -end-20 opacity-10 transform rotate-3">
          <Building2 className="h-[400px] w-[400px] text-secondary" />
        </div>
      </div>

      {/* Form */}
      <div className="flex w-full flex-1 flex-col bg-background lg:w-1/2 xl:w-7/12">
        <div className="flex items-center justify-between p-6 lg:px-12">
          <div className="lg:hidden"><MimaricLogo width={100} /></div>
          <button onClick={() => setLang(lang === "ar" ? "en" : "ar")} className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
            <Globe className="h-5 w-5" />
            <span>{lang === "ar" ? "English" : "العربية"}</span>
          </button>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 sm:px-6 pb-12 lg:px-12">
          {success ? (
            <div className="text-center space-y-4">
              <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h2 className="text-xl font-bold text-primary">
                {lang === "ar" ? "تم تحديث كلمة المرور" : "Password Updated"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {lang === "ar" ? "يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة." : "You can now login with your new password."}
              </p>
              <Link href="/auth/login">
                <Button className="mt-4">{lang === "ar" ? "تسجيل الدخول" : "Login"}</Button>
              </Link>
            </div>
          ) : !token ? (
            <div className="text-center space-y-4">
              <h2 className="text-xl font-bold text-primary">
                {lang === "ar" ? "رابط غير صالح" : "Invalid Link"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {lang === "ar" ? "رابط إعادة التعيين مفقود أو غير صالح." : "The reset link is missing or invalid."}
              </p>
              <Link href="/auth/forgot-password">
                <Button variant="secondary" className="mt-4">{lang === "ar" ? "طلب رابط جديد" : "Request New Link"}</Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-primary">
                  {lang === "ar" ? "كلمة مرور جديدة" : "New Password"}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {lang === "ar" ? "اختر كلمة مرور قوية لحسابك." : "Choose a strong password for your account."}
                </p>
              </div>

              <div className="space-y-5">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">{error}</div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                    {lang === "ar" ? "كلمة المرور الجديدة" : "New Password"}
                  </label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} />
                  <PasswordStrengthHint password={password} lang={lang} />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                    {lang === "ar" ? "تأكيد كلمة المرور" : "Confirm Password"}
                  </label>
                  <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={loading} />
                </div>

                <Button className="w-full" onClick={handleReset} disabled={loading || !password || !confirm}>
                  {loading ? <Loader2 className="animate-spin" /> : (lang === "ar" ? "تحديث كلمة المرور" : "Update Password")}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordInner />
    </Suspense>
  );
}
