"use client";

import * as React from "react";
import { Button, Input } from "@repo/ui";
import Link from "next/link";
import { Globe, Building2, ArrowRight, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { MimaricLogo } from "../../../components/brand/MimaricLogo";
import { requestPasswordReset } from "../../actions/password";

export default function ForgotPasswordPage() {
  const [lang, setLang] = React.useState<"ar" | "en">("ar");
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch {
      // Always show success to prevent email enumeration
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* Brand Panel */}
      <div className="relative hidden w-full bg-primary lg:flex lg:w-1/2 xl:w-5/12 overflow-hidden shadow-2xl">
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 10 L10 40 L40 40' stroke='white' fill='none'/%3E%3Ccircle cx='40' cy='40' r='2' fill='white'/%3E%3Cpath d='M60 10 L60 20 L80 20' stroke='white' fill='none'/%3E%3Ccircle cx='80' cy='20' r='2' fill='white'/%3E%3C/svg%3E")`
          }}
        />
        <div className="relative z-20 flex h-full flex-col justify-between p-12 text-white">
          <MimaricLogo width={180} variant="dark" priority />
          <div className="space-y-6">
            <h1 className="text-4xl font-bold leading-tight xl:text-5xl text-white">
              {lang === "ar" ? "استعادة كلمة المرور" : "Password Recovery"}
            </h1>
            <p className="text-lg text-white/80 max-w-md">
              {lang === "ar"
                ? "سنساعدك في استعادة الوصول إلى حسابك بأمان."
                : "We'll help you securely recover access to your account."}
            </p>
          </div>
          <p className="text-xs font-latin uppercase tracking-widest text-white opacity-50">© 2026 Mimaric PropTech</p>
        </div>
        <div className="absolute -bottom-10 -end-20 opacity-10 transform rotate-3">
          <Building2 className="h-[400px] w-[400px] text-secondary" />
        </div>
      </div>

      {/* Form Area */}
      <div className="flex w-full flex-1 flex-col bg-background lg:w-1/2 xl:w-7/12">
        <div className="flex items-center justify-between p-6 lg:px-12">
          <div className="lg:hidden"><MimaricLogo width={100} /></div>
          <button onClick={() => setLang(lang === "ar" ? "en" : "ar")} className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
            <Globe className="h-5 w-5" />

            <span>{lang === "ar" ? "English" : "العربية"}</span>
          </button>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 sm:px-6 pb-12 lg:px-12">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h2 className="text-xl font-bold text-primary">
                {lang === "ar" ? "تم إرسال الرابط" : "Reset Link Sent"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {lang === "ar"
                  ? "إذا كان هذا البريد مسجلاً لدينا، ستتلقى رابط إعادة تعيين كلمة المرور."
                  : "If this email is registered, you'll receive a password reset link."}
              </p>
              <Link href="/auth/login">
                <Button variant="secondary" className="mt-4">
                  {lang === "ar" ? "العودة لتسجيل الدخول" : "Back to Login"}
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-8 text-start">
                <h2 className="text-2xl font-bold text-primary">
                  {lang === "ar" ? "نسيت كلمة المرور؟" : "Forgot Password?"}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {lang === "ar"
                    ? "أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين."
                    : "Enter your email and we'll send you a reset link."}
                </p>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                    {lang === "ar" ? "البريد الإلكتروني" : "Email"}
                  </label>
                  <Input
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <Button
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={loading || !email}
                >
                  {loading ? <Loader2 className="animate-spin" /> : (lang === "ar" ? "إرسال رابط الاستعادة" : "Send Reset Link")}
                </Button>
              </div>

              <p className="mt-8 text-center text-sm text-muted-foreground">
                <Link href="/auth/login" className="font-semibold text-primary hover:underline">
                  {lang === "ar" ? "العودة لتسجيل الدخول" : "Back to Login"}
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
