"use client";

import * as React from "react";
import { Suspense } from "react";
import { Button } from "@repo/ui";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Globe, MailCheck, Loader2 } from "lucide-react";
import { MimaricLogo } from "../../../../components/brand/MimaricLogo";
import { ThemeToggle } from "../../../../components/ThemeToggle";
import { resendVerificationAction } from "../../../actions/auth";

function VerifyEmailSentInner() {
  const [lang, setLang] = React.useState<"ar" | "en">("ar");
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [resending, setResending] = React.useState(false);
  const [resent, setResent] = React.useState(false);

  const handleResend = async () => {
    setResending(true);
    try {
      await resendVerificationAction(email);
    } catch {
      // Anti-enumeration: still show the generic confirmation.
    } finally {
      setResending(false);
      setResent(true);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* Brand Panel */}
      <aside className="relative hidden w-full mesh-bg lg:flex lg:w-1/2 xl:w-5/12 overflow-hidden">
        <div className="absolute top-1/3 start-1/4 w-72 h-72 rounded-full bg-secondary/10 blur-[100px] animate-mesh-drift" />
        <div className="relative z-20 flex h-full flex-col justify-between p-12 text-white">
          <MimaricLogo width={140} variant="dark" priority />
          <div className="space-y-4">
            <h1 className="text-4xl font-bold leading-tight xl:text-5xl text-white">
              {lang === "ar" ? "تحقّق من بريدك" : "Check your inbox"}
            </h1>
            <p className="text-base text-white/70 max-w-md">
              {lang === "ar"
                ? "أرسلنا رابط تأكيد لتفعيل حسابك في ميماريك."
                : "We've sent a verification link to activate your Mimaric account."}
            </p>
          </div>
          <p className="text-xs text-white/40 uppercase tracking-widest">© 2026 Mimaric PropTech</p>
        </div>
      </aside>

      {/* Content Area */}
      <main className="flex w-full flex-1 flex-col bg-background lg:w-1/2 xl:w-7/12">
        <div className="flex items-center justify-between p-5 lg:px-10">
          <div className="lg:hidden dark:brightness-0 dark:invert"><MimaricLogo width={100} /></div>
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
          <div className="rounded-xl border border-border bg-card p-6 shadow-card text-center space-y-5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MailCheck className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-foreground">
                {lang === "ar" ? "تحقّق من بريدك الإلكتروني" : "Check your email"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {lang === "ar" ? (
                  <>
                    أرسلنا رابط تأكيد{email ? <> إلى <span dir="ltr" className="font-medium text-foreground">{email}</span></> : null}. افتح الرابط لتفعيل حسابك. ينتهي الرابط خلال 24 ساعة.
                  </>
                ) : (
                  <>
                    We&apos;ve sent a verification link{email ? <> to <span dir="ltr" className="font-medium text-foreground">{email}</span></> : null}. Open it to activate your account. The link expires in 24 hours.
                  </>
                )}
              </p>
            </div>

            {resent ? (
              <div className="rounded-lg border border-secondary/20 bg-secondary/10 p-3 text-sm text-foreground">
                {lang === "ar"
                  ? "إذا كان الحساب يحتاج إلى تأكيد، فقد أرسلنا رابطاً جديداً."
                  : "If an account needs verification, we've sent a new link."}
              </div>
            ) : (
              <Button
                className="w-full"
                variant="secondary"
                onClick={handleResend}
                disabled={resending}
              >
                {resending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  lang === "ar" ? "إعادة إرسال البريد" : "Resend email"
                )}
              </Button>
            )}

            <p className="text-sm text-muted-foreground">
              {lang === "ar" ? "أكّدت بريدك بالفعل؟" : "Already verified?"}{" "}
              <Link href="/auth/login" className="font-medium text-primary hover:underline">
                {lang === "ar" ? "تسجيل الدخول" : "Sign in"}
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function VerifyEmailSentPage() {
  return (
    <Suspense>
      <VerifyEmailSentInner />
    </Suspense>
  );
}
