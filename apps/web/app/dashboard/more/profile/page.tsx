"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AppBar, DataCard } from "@repo/ui";
import {
  Bell,
  Globe,
  HelpCircle,
  Lock,
  LogOut,
  Mail,
  Phone,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { useLanguage } from "../../../../components/LanguageProvider";
import { useSession } from "../../../../components/SimpleSessionProvider";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

const ROLE_LABEL: Record<string, { ar: string; en: string }> = {
  SUPER_ADMIN: { ar: "مسؤول النظام", en: "Super Admin" },
  PLATFORM_ADMIN: { ar: "مسؤول المنصة", en: "Platform Admin" },
  ORG_ADMIN: { ar: "مسؤول المؤسسة", en: "Organization Admin" },
  ADMIN: { ar: "مسؤول", en: "Admin" },
  MANAGER: { ar: "مدير", en: "Manager" },
  SALES: { ar: "مبيعات", en: "Sales" },
  FINANCE: { ar: "مالية", en: "Finance" },
  MAINTENANCE: { ar: "صيانة", en: "Maintenance" },
  USER: { ar: "مستخدم", en: "User" },
};

export default function ProfilePage() {
  const router = useRouter();
  const { lang, setLang } = useLanguage();
  const { data: session } = useSession();

  const user = session?.user ?? {};
  const name = user.name ?? (lang === "ar" ? "مستخدم مميرك" : "Mimaric User");
  const email = user.email ?? "";
  const role = (user as any).role ?? "USER";
  const roleLabel = (ROLE_LABEL[role] ?? { ar: role, en: role })[lang];

  return (
    <div className="md:hidden -m-4 sm:-m-6 lg:-m-8 min-h-dvh flex flex-col bg-background">
      <AppBar
        title={lang === "ar" ? "الملف الشخصي" : "Profile"}
        lang={lang}
        onBack={() => router.back()}
        centered
      />

      <div className="flex-1 px-4 py-6 space-y-6">
        {/* Header: avatar + name + role badge */}
        <section className="flex flex-col items-center text-center">
          <span
            aria-hidden="true"
            className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary text-2xl font-semibold"
          >
            {initialsOf(name)}
          </span>
          <h1 className="mt-3 text-lg font-semibold text-foreground">{name}</h1>
          {email ? (
            <p className="mt-0.5 text-sm text-muted-foreground truncate max-w-full">
              {email}
            </p>
          ) : null}
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {roleLabel}
          </span>
        </section>

        {/* Contact info */}
        {email ? (
          <section>
            <h2 className="px-1 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {lang === "ar" ? "معلومات الاتصال" : "Contact"}
            </h2>
            <div className="space-y-2">
              <DataCard
                icon={Mail}
                iconTone="blue"
                title={lang === "ar" ? "البريد الإلكتروني" : "Email"}
                subtitle={email}
              />
              {(user as any).phone ? (
                <DataCard
                  icon={Phone}
                  iconTone="green"
                  title={lang === "ar" ? "رقم الهاتف" : "Phone"}
                  subtitle={(user as any).phone}
                />
              ) : null}
            </div>
          </section>
        ) : null}

        {/* Preferences */}
        <section>
          <h2 className="px-1 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {lang === "ar" ? "التفضيلات" : "Preferences"}
          </h2>
          <div className="space-y-2">
            <DataCard
              icon={Globe}
              iconTone="purple"
              title={lang === "ar" ? "اللغة" : "Language"}
              subtitle={lang === "ar" ? "العربية" : "English"}
              onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            />
            <DataCard
              icon={Bell}
              iconTone="amber"
              title={lang === "ar" ? "الإشعارات" : "Notifications"}
              subtitle={
                lang === "ar"
                  ? "إدارة تنبيهات البريد والتطبيق"
                  : "Manage email and in-app alerts"
              }
              href="/dashboard/settings"
            />
          </div>
        </section>

        {/* Security */}
        <section>
          <h2 className="px-1 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {lang === "ar" ? "الأمان" : "Security"}
          </h2>
          <div className="space-y-2">
            <DataCard
              icon={Lock}
              iconTone="default"
              title={lang === "ar" ? "تغيير كلمة المرور" : "Change password"}
              href="/dashboard/settings"
            />
            <DataCard
              icon={UserCog}
              iconTone="default"
              title={lang === "ar" ? "إعدادات الحساب" : "Account settings"}
              href="/dashboard/settings"
            />
          </div>
        </section>

        {/* Help + Sign out */}
        <section>
          <h2 className="px-1 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {lang === "ar" ? "الدعم" : "Support"}
          </h2>
          <div className="space-y-2">
            <DataCard
              icon={HelpCircle}
              iconTone="blue"
              title={lang === "ar" ? "مركز المساعدة" : "Help Center"}
              href="/dashboard/help"
            />
            <DataCard
              icon={LogOut}
              iconTone="red"
              title={lang === "ar" ? "تسجيل الخروج" : "Sign out"}
              href="/api/auth/signout"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
