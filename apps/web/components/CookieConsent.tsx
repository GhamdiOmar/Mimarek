"use client";

import * as React from "react";
import Link from "next/link";
import { Button, ResponsiveDialog, Switch, cn } from "@repo/ui";

type Lang = "ar" | "en";

const t = (lang: Lang, ar: string, en: string) => (lang === "ar" ? ar : en);

const COPY = {
  title: { ar: "نحترم خصوصيتك", en: "We respect your privacy" },
  body: {
    ar: "نستخدم ملفات تعريف الارتباط الضرورية لتشغيل المنصة، وملفات اختيارية للتحليلات تساعدنا على تحسين الخدمة. لن نُفعّل التحليلات إلا بموافقتك.",
    en: "We use necessary cookies to run the platform, and optional analytics cookies to help us improve it. We won't enable analytics without your consent.",
  },
  acceptAll: { ar: "قبول الكل", en: "Accept all" },
  rejectNonEssential: { ar: "رفض غير الضروري", en: "Reject non-essential" },
  managePreferences: { ar: "إدارة التفضيلات", en: "Manage preferences" },
  savePreferences: { ar: "حفظ التفضيلات", en: "Save preferences" },
  cancel: { ar: "إلغاء", en: "Cancel" },
  policyLink: { ar: "اقرأ سياسة ملفات تعريف الارتباط", en: "Read our Cookie Policy" },
  prefsTitle: { ar: "تفضيلات ملفات تعريف الارتباط", en: "Cookie preferences" },
  prefsDesc: {
    ar: "اختر أنواع ملفات تعريف الارتباط التي توافق عليها. يمكنك تغيير اختيارك في أي وقت.",
    en: "Choose which cookies you allow. You can change your choice at any time.",
  },
  necessaryName: { ar: "ضرورية", en: "Necessary" },
  necessaryDesc: {
    ar: "لازمة لعمل المنصة وتسجيل الدخول وتذكّر لغتك. لا يمكن إيقافها.",
    en: "Required for the platform to work, for sign-in, and to remember your language. Cannot be turned off.",
  },
  alwaysActive: { ar: "مُفعّلة دائمًا", en: "Always active" },
  analyticsName: { ar: "التحليلات", en: "Analytics" },
  analyticsDesc: {
    ar: "تساعدنا على فهم كيفية استخدام المنصة لتحسين الأداء. معطّلة افتراضيًا.",
    en: "Help us understand how the platform is used so we can improve performance. Off by default.",
  },
} as const;

function CategoryRow({
  name,
  desc,
  checked,
  disabled,
  helper,
  onCheckedChange,
}: {
  name: string;
  desc: string;
  checked: boolean;
  disabled?: boolean;
  helper?: string;
  onCheckedChange?: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border border-border bg-muted/30 p-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{name}</p>
        <p className="mt-1 text-caption text-muted-foreground">{desc}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Switch
          checked={checked}
          disabled={disabled}
          onCheckedChange={onCheckedChange}
          aria-label={name}
        />
        {helper ? (
          <span className="text-[11px] text-muted-foreground">{helper}</span>
        ) : null}
      </div>
    </div>
  );
}

export function CookieConsent({
  lang,
  bannerOpen,
  prefsOpen,
  currentAnalytics,
  onAcceptAll,
  onRejectAll,
  onSavePreferences,
  onOpenPreferences,
  onClosePreferences,
}: {
  lang: Lang;
  bannerOpen: boolean;
  prefsOpen: boolean;
  currentAnalytics: boolean;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onSavePreferences: (analytics: boolean) => void;
  onOpenPreferences: () => void;
  onClosePreferences: () => void;
}) {
  // Draft toggle state for the preferences sheet, seeded from the live choice.
  const [analyticsDraft, setAnalyticsDraft] = React.useState(currentAnalytics);
  React.useEffect(() => {
    if (prefsOpen) setAnalyticsDraft(currentAnalytics);
  }, [prefsOpen, currentAnalytics]);

  const tt = (k: keyof typeof COPY) => COPY[k][lang];

  return (
    <>
      {bannerOpen ? (
        <div
          role="dialog"
          aria-modal="false"
          aria-label={tt("title")}
          className={cn(
            // Non-blocking corner card (CX-005): never spans the full width or
            // covers center content / the Kanban Add column buttons, and on
            // mobile sits ABOVE the bottom tab bar (h-16) so it never eats a
            // third of the screen or the FAB.
            "fixed z-[1080] start-3 end-3 sm:end-auto sm:start-4 sm:max-w-[400px]",
            "bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-4",
          )}
        >
          <div className="rounded-lg border border-border bg-card text-card-foreground shadow-lg p-4">
            <p className="text-sm font-semibold text-foreground">{tt("title")}</p>
            <p className="mt-1 text-caption text-muted-foreground line-clamp-3">
              {tt("body")}{" "}
              <Link
                href="/cookie-policy"
                className="text-primary underline-offset-4 hover:underline"
              >
                {tt("policyLink")}
              </Link>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {/* Reject given equal prominence to Accept (PDPL) */}
              <Button variant="secondary" size="sm" onClick={onRejectAll}>
                {tt("rejectNonEssential")}
              </Button>
              <Button variant="primary" size="sm" onClick={onAcceptAll}>
                {tt("acceptAll")}
              </Button>
              <Button variant="ghost" size="sm" onClick={onOpenPreferences}>
                {tt("managePreferences")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <ResponsiveDialog
        open={prefsOpen}
        onOpenChange={(o) => (o ? onOpenPreferences() : onClosePreferences())}
        title={tt("prefsTitle")}
        description={tt("prefsDesc")}
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" size="md" onClick={onClosePreferences}>
              {tt("cancel")}
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => onSavePreferences(analyticsDraft)}
            >
              {tt("savePreferences")}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <CategoryRow
            name={tt("necessaryName")}
            desc={tt("necessaryDesc")}
            checked
            disabled
            helper={tt("alwaysActive")}
          />
          <CategoryRow
            name={tt("analyticsName")}
            desc={tt("analyticsDesc")}
            checked={analyticsDraft}
            onCheckedChange={setAnalyticsDraft}
          />
          <Link
            href="/cookie-policy"
            className="text-caption text-primary underline-offset-4 hover:underline"
          >
            {tt("policyLink")}
          </Link>
        </div>
      </ResponsiveDialog>
    </>
  );
}
