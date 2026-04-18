"use client";

import * as React from "react";
import { Button, Input, DirectionalIcon } from "@repo/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Globe, ArrowRight, User, Briefcase, Loader2, Eye, EyeOff } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { MimaricLogo } from "../../../components/brand/MimaricLogo";
import { ThemeToggle } from "../../../components/ThemeToggle";
import { PasswordStrengthHint } from "../../../components/PasswordStrengthHint";
import { registerUser } from "../../actions/auth";

export default function RegisterPage() {
  const [lang, setLang] = React.useState<"ar" | "en">("ar");
  const [userType, setUserType] = React.useState<"individual" | "company">("individual");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [agreed, setAgreed] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const router = useRouter();

  const handleRegister = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await registerUser({ name, email, password, accountType: userType });
      if (result.error) {
        if (result.error === "EMAIL_EXISTS") {
          setError(lang === "ar" ? "هذا البريد الإلكتروني مسجل بالفعل." : "This email is already registered.");
        } else if (result.error === "WEAK_PASSWORD" && result.details) {
          setError(result.details.map((e: any) => e[lang]).join(" "));
        } else {
          setError(lang === "ar" ? "حدث خطأ." : "An error occurred.");
        }
      } else {
        router.push(result.redirect || "/dashboard/onboarding");
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
      <div className="relative hidden w-full mesh-bg lg:flex lg:w-1/2 xl:w-5/12 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="arch-register" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse">
                <rect x="10" y="10" width="100" height="100" stroke="white" strokeWidth="0.4" fill="none" rx="4" />
                <rect x="30" y="30" width="60" height="60" stroke="white" strokeWidth="0.2" fill="none" rx="2" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#arch-register)" />
          </svg>
        </div>

        <div className="absolute top-1/3 start-1/4 w-72 h-72 rounded-full bg-secondary/10 blur-[100px] animate-mesh-drift" />

        <div className="relative z-20 flex h-full flex-col justify-between p-12 text-white">
          <MimaricLogo width={140} variant="dark" priority />
          <div className="space-y-4">
            <h1 className="text-4xl font-bold leading-tight xl:text-5xl text-white">
              {lang === "ar" ? "ارتقِ بإدارة عقاراتك" : "Elevate Your Real Estate"}
            </h1>
            <p className="text-base text-white/70 max-w-md">
              {lang === "ar"
                ? "مستقبل إدارة العقارات في المملكة العربية السعودية يبدأ من هنا."
                : "The future of property management in Saudi Arabia starts here."}
            </p>
          </div>
          <p className="text-xs text-white/40 uppercase tracking-widest">© 2026 Mimaric PropTech</p>
        </div>
      </div>

      {/* Form Area */}
      <div className="flex w-full flex-1 flex-col bg-background lg:w-1/2 xl:w-7/12">
        <div className="flex items-center justify-between p-5 lg:px-10">
          <div className="lg:hidden dark:brightness-0 dark:invert"><MimaricLogo width={100} /></div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button onClick={() => setLang(lang === "ar" ? "en" : "ar")} className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              <Globe className="h-4 w-4" />
              <span>{lang === "ar" ? "English" : "العربية"}</span>
            </button>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 sm:px-6 pb-12">
          <div className="rounded-xl border border-border bg-card p-6 shadow-card">
            <div className="mb-6 text-center">
              <h2 className="text-xl font-bold text-foreground">
                {lang === "ar" ? "إنشاء حساب جديد" : "Create Account"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {lang === "ar"
                  ? "انضم إلى نخبة المطورين العقاريين في المملكة"
                  : "Join the elite property developers in the Kingdom"}
              </p>
            </div>

            {/* User Type Switcher */}
            <div className="mb-6 flex rounded-lg bg-muted/50 p-1">
              <button
                onClick={() => setUserType("individual")}
                className={cn(
                  "flex flex-nowrap flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium whitespace-nowrap transition-all",
                  userType === "individual" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <User className="h-4 w-4" />
                {lang === "ar" ? "فرد" : "Individual"}
              </button>
              <button
                onClick={() => setUserType("company")}
                className={cn(
                  "flex flex-nowrap flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium whitespace-nowrap transition-all",
                  userType === "company" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Briefcase className="h-4 w-4" />
                {lang === "ar" ? "شركة" : "Company"}
              </button>
            </div>

            <div className="space-y-4">
              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">{error}</div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  {lang === "ar" ? (userType === "company" ? "اسم الشركة" : "الاسم الكامل") : (userType === "company" ? "Company Name" : "Full Name")}
                </label>
                <Input
                  placeholder={lang === "ar" ? (userType === "company" ? "اسم المؤسسة" : "عمر الغامدي") : (userType === "company" ? "Company name" : "Omar Alghamdi")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
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

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
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
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <PasswordStrengthHint password={password} lang={lang} context={{ name, email }} />
              </div>

              <div className="flex items-start gap-3 py-1">
                <input type="checkbox" id="terms" className="mt-1 accent-secondary" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                <label htmlFor="terms" className="text-xs text-muted-foreground leading-relaxed">
                  {lang === "ar"
                    ? "أوافق على شروط الخدمة وسياسة الخصوصية الخاصة بـ Mimaric"
                    : "I agree to Mimaric's Terms of Service and Privacy Policy"}
                </label>
              </div>

              <Button
                className="w-full"
                onClick={handleRegister}
                disabled={loading || !name || !email || !password || !agreed}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    {lang === "ar" ? "إنشاء حساب" : "Create Account"}
                    <DirectionalIcon icon={ArrowRight} className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {lang === "ar" ? "لديك حساب بالفعل؟" : "Already have an account?"}{" "}
              <Link href="/auth/login" className="font-medium text-primary hover:underline">
                {lang === "ar" ? "تسجيل الدخول" : "Sign in"}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
