"use client";

import { useLanguage } from "../../../../components/LanguageProvider";
import * as React from "react";
import {
  Button,
  Input,
  PageHeader,
  AppBar,
  DataCard,
  ResponsiveDialog,
  DirectionalIcon,
} from "@repo/ui";
import { Lock, CheckCircle2, ArrowLeft, KeyRound, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useSession } from "../../../../components/SimpleSessionProvider";
import { PasswordStrengthHint } from "../../../../components/PasswordStrengthHint";
import { changePassword } from "../../../actions/password";

export default function SecuritySettingsPage() {
  const { lang } = useLanguage();
  const { data: session } = useSession();
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [mobileDialogOpen, setMobileDialogOpen] = React.useState(false);

  const errorMessages: Record<string, { ar: string; en: string }> = {
    WRONG_PASSWORD: { ar: "كلمة المرور الحالية غير صحيحة.", en: "Current password is incorrect." },
    SAME_PASSWORD: { ar: "كلمة المرور الجديدة يجب أن تختلف عن الحالية.", en: "New password must be different from current." },
    MISMATCH: { ar: "كلمتا المرور غير متطابقتين.", en: "Passwords do not match." },
  };

  const handleChange = async () => {
    if (newPassword !== confirmPassword) {
      setError(errorMessages.MISMATCH![lang]);
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const result = await changePassword({ currentPassword, newPassword });
      if (result.error) {
        if (result.error === "WEAK_PASSWORD" && result.details) {
          setError(result.details.map((e: any) => e[lang]).join(" "));
        } else {
          const msg = errorMessages[result.error];
          setError(msg ? msg[lang] : (lang === "ar" ? "حدث خطأ." : "An error occurred."));
        }
      } else {
        setSuccess(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        // Close mobile dialog on success after a moment
        setTimeout(() => {
          setMobileDialogOpen(false);
          setSuccess(false);
        }, 1500);
      }
    } catch {
      setError(lang === "ar" ? "حدث خطأ في النظام." : "System error.");
    } finally {
      setLoading(false);
    }
  };

  const passwordForm = (
    <div className="space-y-5">
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-success/10 border border-success/30 text-success text-sm rounded-lg flex items-center gap-2">
          <CheckCircle2 className="h-[18px] w-[18px]" />
          {lang === "ar" ? "تم تحديث كلمة المرور بنجاح." : "Password updated successfully."}
        </div>
      )}

      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {lang === "ar" ? "كلمة المرور الحالية" : "Current Password"}
        </label>
        <Input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          disabled={loading}
          className="h-11"
        />
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {lang === "ar" ? "كلمة المرور الجديدة" : "New Password"}
        </label>
        <Input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          disabled={loading}
          className="h-11"
        />
        <PasswordStrengthHint
          password={newPassword}
          lang={lang}
          context={{ name: session?.user?.name ?? undefined, email: session?.user?.email ?? undefined }}
        />
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {lang === "ar" ? "تأكيد كلمة المرور الجديدة" : "Confirm New Password"}
        </label>
        <Input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={loading}
          className="h-11"
        />
      </div>

      <Button
        className="w-full gap-2 min-h-[44px]"
        onClick={handleChange}
        disabled={loading || !currentPassword || !newPassword || !confirmPassword}
        style={{ display: "inline-flex" }}
      >
        <CheckCircle2 className="h-[18px] w-[18px]" />
        {loading
          ? (lang === "ar" ? "جاري التحديث..." : "Updating...")
          : (lang === "ar" ? "تحديث كلمة المرور" : "Update Password")}
      </Button>
    </div>
  );

  return (
    <>
      {/* ─── Mobile (< md) ─────────────────────────────────────────────── */}
      <div
        className="md:hidden -m-4 sm:-m-6 min-h-dvh flex flex-col bg-background"
        dir={lang === "ar" ? "rtl" : "ltr"}
      >
        <AppBar
          title={lang === "ar" ? "الأمان" : "Security"}
          subtitle={
            lang === "ar"
              ? "إدارة كلمة المرور والأمان."
              : "Manage password & security."
          }
          lang={lang}
          onBack={() => { window.history.back(); }}
        />

        <div className="flex-1 px-4 py-4 space-y-4 pb-28">
          {/* Password section header */}
          <div className="pt-2">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
              {lang === "ar" ? "الحساب" : "Account"}
            </h2>
          </div>

          {/* Password row */}
          <div className="rounded-lg border border-border bg-card px-4">
            <DataCard
              icon={KeyRound}
              iconTone="purple"
              title={lang === "ar" ? "كلمة المرور" : "Password"}
              subtitle={
                lang === "ar"
                  ? "قم بتغيير كلمة المرور الخاصة بك"
                  : "Change your account password"
              }
              trailing={
                <span className="text-muted-foreground">
                  ›
                </span>
              }
              onClick={() => {
                setError(null);
                setSuccess(false);
                setMobileDialogOpen(true);
              }}
              divider={false}
            />
          </div>

          {/* Security tips */}
          <div className="pt-4">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
              {lang === "ar" ? "نصائح الأمان" : "Security tips"}
            </h2>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {lang === "ar" ? "استخدم عبارة مرور قوية" : "Use a strong passphrase"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {lang === "ar"
                  ? "استخدم عبارة من 3 كلمات عشوائية أو أكثر لحماية حسابك."
                  : "Use a passphrase of 3+ random words to protect your account."}
              </p>
            </div>
          </div>
        </div>

        {/* Mobile change password dialog */}
        <ResponsiveDialog
          open={mobileDialogOpen}
          onOpenChange={(open) => {
            setMobileDialogOpen(open);
            if (!open) {
              setError(null);
              setSuccess(false);
              setCurrentPassword("");
              setNewPassword("");
              setConfirmPassword("");
            }
          }}
          title={lang === "ar" ? "تغيير كلمة المرور" : "Change Password"}
          description={
            lang === "ar"
              ? "استخدم عبارة من 3+ كلمات عشوائية"
              : "Use a passphrase of 3+ random words"
          }
        >
          {passwordForm}
        </ResponsiveDialog>
      </div>

      {/* ─── Desktop (≥ md) ────────────────────────────────────────────── */}
      <div className="hidden md:block space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-2">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link href="/dashboard/settings" className="text-muted-foreground hover:text-foreground transition-colors">
                <DirectionalIcon icon={ArrowLeft} className="h-5 w-5" />
              </Link>
              <h1 className="text-2xl font-bold text-foreground">
                {lang === "ar" ? "الأمان" : "Security"}
              </h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {lang === "ar" ? "تغيير كلمة المرور وإعدادات الأمان." : "Change your password and security settings."}
            </p>
          </div>
        </div>

        <div className="max-w-lg">
          <div className="bg-card rounded-md shadow-card border border-border overflow-hidden">
            <div className="p-6 border-b border-border bg-muted/5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/5 rounded-md text-primary">
                  <Lock className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground">{lang === "ar" ? "تغيير كلمة المرور" : "Change Password"}</h2>
                  <p className="text-[10px] text-muted-foreground">{lang === "ar" ? "استخدم عبارة من 3+ كلمات عشوائية" : "Use a passphrase of 3+ random words"}</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              {passwordForm}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
