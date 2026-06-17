"use client";

import * as React from "react";
import Link from "next/link";
import {
  User,
  Settings,
  ShieldCheck,
  HelpCircle,
  Globe,
  Sun,
  Moon,
  LogOut,
  ChevronRight,
  Monitor,
} from "lucide-react";
import { signOut as nextAuthSignOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { BottomSheet, DirectionalIcon, Button } from "@repo/ui";
import { cn } from "@repo/ui/lib/utils";
import { useSession } from "../SimpleSessionProvider";
import { useLanguage } from "../LanguageProvider";
import { roleLabels } from "./nav-items";

interface MobileUserMenuSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgName?: string;
}

export function MobileUserMenuSheet({ open, onOpenChange, orgName }: MobileUserMenuSheetProps) {
  const { data: session } = useSession();
  const { t, lang, setLang } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const userName = session?.user?.name ?? (t("مستخدم", "User"));
  const userRole = (session?.user as any)?.role ?? "USER";
  const roleLabel = roleLabels[userRole] ?? { ar: "مستخدم", en: "User" };
  const userEmail = session?.user?.email;

  const navLinks = [
    {
      href: "/dashboard/settings",
      icon: Settings,
      label: { ar: "الإعدادات", en: "Settings" },
    },
    {
      href: "/dashboard/settings/security",
      icon: ShieldCheck,
      label: { ar: "الأمان", en: "Security" },
    },
    {
      href: "/dashboard/help",
      icon: HelpCircle,
      label: { ar: "المساعدة", en: "Help" },
    },
  ];

  const themeCycle = () => {
    const next = theme === "dark" ? "light" : theme === "light" ? "system" : "dark";
    setTheme(next);
  };

  const ThemeIcon = !mounted || theme === "system" ? Monitor : theme === "dark" ? Moon : Sun;
  const themeLabel = !mounted
    ? { ar: "السمة", en: "Theme" }
    : theme === "dark"
      ? { ar: "داكن", en: "Dark" }
      : theme === "light"
        ? { ar: "فاتح", en: "Light" }
        : { ar: "النظام", en: "System" };

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <div className="space-y-4">
        {/* Profile header → settings profile section */}
        <Link
          href="/dashboard/settings#profile"
          onClick={() => onOpenChange(false)}
          aria-label={t("الملف الشخصي", "Profile")}
          className="-mx-1 flex items-center gap-3 rounded-xl border-b border-border px-1 pb-3 transition-colors hover:bg-muted/30 active:bg-muted/50"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 ring-2 ring-primary/20">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{userName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{roleLabel[lang]}</p>
            {orgName && (
              <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5">{orgName}</p>
            )}
            {userEmail && (
              <p className="text-[11px] text-muted-foreground/70 mt-1 truncate" dir="ltr">
                {userEmail}
              </p>
            )}
          </div>
          <DirectionalIcon icon={ChevronRight} className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>

        {/* Navigation rows */}
        <div className="space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => onOpenChange(false)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-3 transition-colors",
                "hover:bg-muted/40 active:bg-muted/60"
              )}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <link.icon className="h-4 w-4 text-primary" />
              </div>
              <span className="flex-1 text-sm font-medium text-foreground">
                {link.label[lang]}
              </span>
              <DirectionalIcon icon={ChevronRight} className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </div>

        {/* Language + Theme toggles */}
        <div className="space-y-1 pt-3 border-t border-border">
          <Button
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            variant="ghost"
            className="w-full justify-start gap-3 rounded-xl px-3 py-3 h-auto hover:bg-muted/40 active:bg-muted/60"
            aria-label={t("تغيير اللغة", "Change language")}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Globe className="h-4 w-4 text-primary" />
            </div>
            <span className="flex-1 text-start text-sm font-medium text-foreground">
              {t("اللغة", "Language")}
            </span>
            <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-semibold text-foreground">
              {t("العربية", "English")}
            </span>
          </Button>

          <Button
            onClick={themeCycle}
            variant="ghost"
            className="w-full justify-start gap-3 rounded-xl px-3 py-3 h-auto hover:bg-muted/40 active:bg-muted/60"
            aria-label={t("تغيير السمة", "Change theme")}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <ThemeIcon className="h-4 w-4 text-primary" />
            </div>
            <span className="flex-1 text-start text-sm font-medium text-foreground">
              {t("السمة", "Theme")}
            </span>
            <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-semibold text-foreground">
              {themeLabel[lang]}
            </span>
          </Button>
        </div>

        {/* Sign out */}
        <div className="pt-3 border-t border-border">
          <Button
            onClick={() => {
              onOpenChange(false);
              nextAuthSignOut({ callbackUrl: "/auth/login" });
            }}
            variant="ghost"
            className="w-full justify-start gap-3 rounded-xl px-3 py-3 h-auto text-destructive hover:bg-destructive/10 hover:text-destructive active:bg-destructive/15"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
              <DirectionalIcon icon={LogOut} className="h-4 w-4 text-destructive" />
            </div>
            <span className="flex-1 text-start text-sm font-semibold">
              {t("تسجيل الخروج", "Sign out")}
            </span>
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
