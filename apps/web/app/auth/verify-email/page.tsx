"use client";

import * as React from "react";
import { Suspense } from "react";
import { Button } from "@repo/ui";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Globe, MailCheck, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { MimarekLogo } from "../../../components/brand/MimarekLogo";
import { ThemeToggle } from "../../../components/ThemeToggle";
import { confirmEmailVerificationAction, resendVerificationAction } from "../../actions/auth";

type Phase = "confirm" | "success" | "error";

function VerifyEmailInner() {
  const [lang, setLang] = React.useState<"ar" | "en">("ar");
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [phase, setPhase] = React.useState<Phase>("confirm");
  type VerifyErrorReason = "invalid" | "expired" | "used";
  const [reason, setReason] = React.useState<VerifyErrorReason | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Resend affordance (shown on error)
  const [resendEmail, setResendEmail] = React.useState("");
  const [resending, setResending] = React.useState(false);
  const [resent, setResent] = React.useState(false);

  const errorCopy: Record<string, { ar: string; en: string }> = {
    invalid: {
      ar: "رابط التأكيد غير صالح. اطلب رابطاً جديداً بإدخال بريدك أدناه.",
      en: "This verification link is invalid. Request a new one by entering your email below.",
    },
    expired: {
      ar: "انتهت صلاحية رابط التأكيد. اطلب رابطاً جديداً بإدخال بريدك أدناه.",
      en: "This verification link has expired. Request a new one by entering your email below.",
    },
    used: {
      ar: "تم استخدام هذا الرابط بالفعل. إذا لم تؤكد بعد، اطلب رابطاً جديداً أدناه.",
      en: "This link has already been used. If you haven't verified yet, request a new one below.",
    },
  };

  const handleConfirm = async () => {
    if (!token) {
      setReason("invalid");
      setPhase("error");
      return;
    }
    setLoading(true);
    try {
      const result = await confirmEmailVerificationAction(token);
      if (result.success) {
        setPhase("success");
      } else {
        setReason((result.error as VerifyErrorReason) ?? "invalid");
        setPhase("error");
      }
    } catch {
      setReason("invalid");
      setPhase("error");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await resendVerificationAction(resendEmail);
      setResent(true);
    } catch {
      // Anti-enumeration: still show the generic confirmation.
      setResent(true);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* Brand Panel */}
      <aside className="relative hidden w-full mesh-bg lg:flex lg:w-1/2 xl:w-5/12 overflow-hidden">
        <div className="absolute top-1/3 start-1/4 w-72 h-72 rounded-full bg-secondary/10 blur-[100px] animate-mesh-drift" />
        <div className="relative z-20 flex h-full flex-col justify-between p-12 text-white">
          <MimarekLogo width={140} variant="dark" priority />
          <div className="space-y-4">
            <h1 className="text-4xl font-bold leading-tight xl:text-5xl text-white">
              {lang === "ar" ? "تأكيد بريدك الإلكتروني" : "Verify your email"}
            </h1>
            <p className="text-base text-white/70 max-w-md">
              {lang === "ar"
                ? "خطوة أخيرة لتفعيل حسابك في معمارك."
                : "One last step to activate your Mimarek account."}
            </p>
          </div>
          <p className="text-xs text-white/40 uppercase tracking-widest">© 2026 Mimarek PropTech</p>
        </div>
      </aside>

      {/* Content Area */}
      <main className="flex w-full flex-1 flex-col bg-background lg:w-1/2 xl:w-7/12">
        <div className="flex items-center justify-between p-5 lg:px-10">
          <div className="lg:hidden dark:brightness-0 dark:invert"><MimarekLogo width={100} /></div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLang(lang === "ar" ? "en" : "ar")}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <Globe className="h-4 w-4" />
              <span>{lang === "ar" ? "English" : "العربية"}</span>
            </Button>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 sm:px-6 pb-12">
          <div className="rounded-xl border border-border bg-card p-6 shadow-card">
            {phase === "success" ? (
              <div className="text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h2 className="text-xl font-bold text-foreground">
                  {lang === "ar" ? "تم تأكيد بريدك" : "Email verified"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {lang === "ar"
                    ? "تم تفعيل حسابك. يمكنك الآن تسجيل الدخول."
                    : "Your account is active. You can now sign in."}
                </p>
                <Link href="/auth/login">
                  <Button className="mt-2 w-full">{lang === "ar" ? "تسجيل الدخول" : "Sign in"}</Button>
                </Link>
              </div>
            ) : phase === "error" ? (
              <div className="space-y-4">
                <div className="text-center space-y-3">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <AlertCircle className="h-8 w-8" />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">
                    {lang === "ar" ? "تعذّر تأكيد البريد" : "Couldn't verify email"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {(errorCopy[reason ?? "invalid"] ?? errorCopy.invalid)![lang]}
                  </p>
                </div>

                {resent ? (
                  <div className="rounded-lg border border-secondary/20 bg-secondary/10 p-3 text-center text-sm text-foreground">
                    {lang === "ar"
                      ? "إذا كان الحساب يحتاج إلى تأكيد، فقد أرسلنا رابطاً جديداً."
                      : "If an account needs verification, we've sent a new link."}
                  </div>
                ) : (
                  <div className="space-y-2 border-t border-border pt-4">
                    <label htmlFor="resend-email" className="text-sm font-medium text-foreground">
                      {lang === "ar" ? "البريد الإلكتروني" : "Email"}
                    </label>
                    <input
                      id="resend-email"
                      type="email"
                      autoComplete="email"
                      placeholder="name@example.com"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    />
                    <Button
                      className="w-full"
                      variant="secondary"
                      onClick={handleResend}
                      disabled={resending || !resendEmail}
                    >
                      {resending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        lang === "ar" ? "إرسال رابط تأكيد جديد" : "Resend verification email"
                      )}
                    </Button>
                  </div>
                )}

                <p className="text-center text-sm text-muted-foreground">
                  <Link href="/auth/login" className="font-medium text-primary hover:underline">
                    {lang === "ar" ? "العودة لتسجيل الدخول" : "Back to sign in"}
                  </Link>
                </p>
              </div>
            ) : (
              <div className="text-center space-y-5">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <MailCheck className="h-8 w-8" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-foreground">
                    {lang === "ar" ? "تأكيد بريدك الإلكتروني" : "Verify your email"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {lang === "ar"
                      ? "اضغط الزر أدناه لتأكيد بريدك وتفعيل حسابك في معمارك."
                      : "Press the button below to confirm your email and activate your Mimarek account."}
                  </p>
                </div>
                <Button className="w-full" onClick={handleConfirm} disabled={loading || !token}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    lang === "ar" ? "تأكيد البريد الإلكتروني" : "Verify email"
                  )}
                </Button>
                {!token && (
                  <p className="text-xs text-destructive">
                    {lang === "ar" ? "رابط التأكيد مفقود أو غير صالح." : "The verification link is missing or invalid."}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailInner />
    </Suspense>
  );
}
