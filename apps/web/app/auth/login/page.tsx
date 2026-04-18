"use client";

import * as React from "react";
import { Button, Input, DirectionalIcon } from "@repo/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Globe, ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";
import { MimaricLogo } from "../../../components/brand/MimaricLogo";
import { ThemeToggle } from "../../../components/ThemeToggle";
import { loginAction } from "../../actions/auth";

export default function LoginPage() {
  const [lang, setLang] = React.useState<"ar" | "en">("ar");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [rateLimitSeconds, setRateLimitSeconds] = React.useState(0);
  const [showPassword, setShowPassword] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    if (rateLimitSeconds <= 0) return;
    const timer = setInterval(() => {
      setRateLimitSeconds((s) => {
        if (s <= 1) { setError(null); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [rateLimitSeconds]);

  const errorMessages: Record<string, { ar: string; en: string }> = {
    INVALID_CREDENTIALS: {
      ar: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
      en: "Invalid email or password."
    },
    DATABASE_ERROR: {
      ar: "فشل الاتصال بقاعدة البيانات. يرجى المحاولة لاحقاً.",
      en: "Database connection failed. Please try again later."
    },
    AUTH_ERROR: {
      ar: "حدث خطأ أثناء تسجيل الدخول.",
      en: "An error occurred during authentication."
    },
    UNKNOWN_ERROR: {
      ar: "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.",
      en: "An unexpected error occurred. Please try again."
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("email", email);
    formData.append("password", password);

    try {
      const result = await loginAction(formData);
      if (result?.error) {
        if (result.error.startsWith("RATE_LIMITED")) {
          const seconds = parseInt(result.error.split(":")[1] ?? "30", 10);
          setRateLimitSeconds(seconds);
          setError(lang === "ar"
            ? `محاولات كثيرة جدًا. حاول مرة أخرى بعد ${seconds} ثانية.`
            : `Too many attempts. Try again in ${seconds} seconds.`);
          setLoading(false);
          return;
        }
        const msg = errorMessages[result.error] ||
                   (lang === "ar" ? "حدث خطأ ما." : "Something went wrong.");
        setError(typeof msg === 'string' ? msg : msg[lang]);
        setLoading(false);
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      if (err.message?.includes("NEXT_REDIRECT")) return;
      setError(lang === "ar" ? "حدث خطأ في النظام. يرجى المحاولة لاحقاً." : "System error. Please try again later.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* Brand Panel */}
      <aside className="relative hidden w-full mesh-bg lg:flex lg:w-1/2 xl:w-5/12 overflow-hidden" aria-label={lang === "ar" ? "لوحة العلامة التجارية" : "Brand panel"}>
        {/* Subtle pattern */}
        <div className="absolute inset-0 opacity-[0.03]">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="arch-login" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse">
                <rect x="10" y="10" width="100" height="100" stroke="white" strokeWidth="0.4" fill="none" rx="4" />
                <rect x="30" y="30" width="60" height="60" stroke="white" strokeWidth="0.2" fill="none" rx="2" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#arch-login)" />
          </svg>
        </div>

        {/* Single subtle blob */}
        <div className="absolute top-1/3 start-1/4 w-72 h-72 rounded-full bg-secondary/10 blur-[100px] animate-mesh-drift" />

        <div className="relative z-20 flex h-full flex-col justify-between p-12 text-white">
          <MimaricLogo width={140} variant="dark" priority />

          <div className="space-y-4">
            <h1 className="text-4xl font-bold leading-tight xl:text-5xl text-white">
              {lang === "ar" ? "أهلاً بك في ميماريك" : "Welcome to Mimaric"}
            </h1>
            <p className="text-base text-white/70 max-w-md">
              {lang === "ar"
                ? "أتمتة وإدارة العقارات بذكاء وفق أرقى المعايير السعودية."
                : "Real estate automation and management with Saudi-first standards."}
            </p>
          </div>

          <p className="text-xs text-white/40 uppercase tracking-widest">
            © 2026 Mimaric PropTech
          </p>
        </div>
      </aside>

      {/* Form Area */}
      <main className="flex w-full flex-1 flex-col bg-background lg:w-1/2 xl:w-7/12">
        {/* Top bar */}
        <div className="flex items-center justify-between p-5 lg:px-10">
          <div className="lg:hidden dark:brightness-0 dark:invert">
            <MimaricLogo width={100} />
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setLang(lang === "ar" ? "en" : "ar")}
              className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <Globe className="h-4 w-4" />
              <span>{lang === "ar" ? "English" : "العربية"}</span>
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 sm:px-6 pb-12">
          <div className="rounded-xl border border-border bg-card p-6 shadow-card">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-foreground">
                {lang === "ar" ? "تسجيل الدخول" : "Sign in"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {lang === "ar"
                  ? "أدخل بياناتك للوصول إلى لوحة التحكم"
                  : "Enter your credentials to access your dashboard"}
              </p>
            </div>

            <div className="space-y-4">
              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="login-email" className="text-sm font-medium text-foreground">
                  {lang === "ar" ? "البريد الإلكتروني" : "Email"}
                </label>
                <Input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && email && password && !loading && rateLimitSeconds <= 0) handleLogin(); }}
                  disabled={loading}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="login-password" className="text-sm font-medium text-foreground">
                    {lang === "ar" ? "كلمة المرور" : "Password"}
                  </label>
                  <Link href="/auth/forgot-password" className="text-xs font-medium text-primary hover:underline">
                    {lang === "ar" ? "نسيت كلمة المرور؟" : "Forgot password?"}
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="login-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && email && password && !loading && rateLimitSeconds <= 0) handleLogin(); }}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                    aria-label={
                      showPassword
                        ? (lang === "ar" ? "إخفاء كلمة المرور" : "Hide password")
                        : (lang === "ar" ? "إظهار كلمة المرور" : "Show password")
                    }
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={handleLogin}
                disabled={loading || !email || !password || rateLimitSeconds > 0}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    {lang === "ar" ? "تسجيل الدخول" : "Sign in"}
                    <DirectionalIcon icon={ArrowRight} className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {lang === "ar" ? "ليس لديك حساب؟" : "Don't have an account?"}{" "}
              <Link href="/auth/register" className="font-medium text-primary hover:underline">
                {lang === "ar" ? "إنشاء حساب جديد" : "Register"}
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
