"use client";

import * as React from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@repo/ui";
import { useLanguage } from "../LanguageProvider";
import type { EntitlementResult } from "../../lib/entitlements";
import { AccessDenied } from "../../app/dashboard/_components/AccessDenied";

/**
 * UpgradeGate — renders children only when the org is entitled; otherwise shows
 * a "locked — upgrade your plan" card with a CTA to billing (§6.12 blocked-state,
 * §6.11.4 friendly copy).
 *
 * Use AFTER `getTenantPageAccess` (role) — this handles the PLAN lock, not the
 * permission denial (a `!granted && !upgradeRequired` result is a permission /
 * no-org case the caller should route to `<AccessDenied>` instead).
 *
 * Optional `preview` renders a dimmed, non-interactive teaser behind the lock
 * for upsell. `featureNameAr`/`featureNameEn` personalize the copy.
 */
export function UpgradeGate({
  result,
  featureNameAr,
  featureNameEn,
  preview,
  children,
}: {
  result: EntitlementResult;
  featureNameAr?: string;
  featureNameEn?: string;
  preview?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const { t } = useLanguage();
  if (result.granted) return <>{children}</>;
  // A non-plan denial (no org / permission, `upgradeRequired` false) is not an
  // upsell moment — fall back to the standard access-denied state per the docstring.
  if (!result.upgradeRequired) return <AccessDenied />;

  const named = Boolean(featureNameAr && featureNameEn);
  const description = named
    ? t(
        `${featureNameAr} غير متاح في خطتك الحالية. قم بترقية خطتك للوصول إليها.`,
        `${featureNameEn} isn't included in your current plan. Upgrade to unlock it.`,
      )
    : t(
        "هذه الميزة غير متاحة في خطتك الحالية. قم بترقية خطتك للوصول إليها.",
        "This feature isn't included in your current plan. Upgrade to unlock it.",
      );

  const card = (
    <div className="flex max-w-md flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-center shadow-sm">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Lock className="h-8 w-8" aria-hidden="true" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold text-foreground">
          {t("هذه الميزة تتطلب ترقية", "This feature needs an upgrade")}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Button variant="primary" asChild>
        <Link href="/dashboard/billing">{t("ترقية الخطة", "Upgrade plan")}</Link>
      </Button>
    </div>
  );

  if (preview) {
    return (
      <div className="relative isolate">
        <div className="pointer-events-none select-none opacity-40 blur-[2px]" aria-hidden="true">
          {preview}
        </div>
        <div className="absolute inset-0 flex items-center justify-center p-4">{card}</div>
      </div>
    );
  }

  return <div className="flex min-h-[60vh] flex-col items-center justify-center">{card}</div>;
}
