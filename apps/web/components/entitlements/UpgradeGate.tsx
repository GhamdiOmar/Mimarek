"use client";

import * as React from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { Button, EmptyState } from "@repo/ui";
import { useLanguage } from "../LanguageProvider";
import type { EntitlementResult } from "../../lib/entitlements";
import { AccessDenied } from "../../app/dashboard/_components/AccessDenied";

/**
 * UpgradeGate — renders children when the org is entitled; otherwise shows a
 * "locked — upgrade your plan" state via the `<EmptyState>` primitive (§6.12),
 * matching `<AccessDenied>` so the two blocked-state surfaces read identically.
 *
 * Use AFTER `getTenantPageAccess` (role) — this handles the PLAN lock. A
 * `!granted && !upgradeRequired` result is a permission / no-org case, so it
 * falls through to `<AccessDenied>`.
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
  // Arabic is phrased so the feature name is the OBJECT of "لا تتضمّن" (agrees with
  // خطتك), never the subject of an adjective — so it stays grammatical for any
  // feature-name gender (e.g. الصيانة / لوحة التمويل, both feminine).
  const description = named
    ? t(
        `خطتك الحالية لا تتضمن ${featureNameAr}. قم بترقية خطتك للوصول.`,
        `${featureNameEn} isn't included in your current plan. Upgrade to unlock it.`,
      )
    : t(
        "هذه الميزة غير متاحة في خطتك الحالية. قم بترقية خطتك للوصول.",
        "This feature isn't included in your current plan. Upgrade to unlock it.",
      );

  const state = (
    <EmptyState
      variant="forbidden"
      icon={<Lock className="h-12 w-12" aria-hidden="true" />}
      title={t("هذه الميزة تتطلب ترقية", "This feature needs an upgrade")}
      description={description}
      action={
        <Button variant="primary" asChild>
          <Link href="/dashboard/billing">{t("ترقية الخطة", "Upgrade plan")}</Link>
        </Button>
      }
    />
  );

  if (preview) {
    return (
      <div className="relative isolate">
        <div className="pointer-events-none select-none opacity-40 blur-[2px]" aria-hidden="true">
          {preview}
        </div>
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="rounded-xl border border-border bg-card/95 shadow-lg backdrop-blur-sm">
            {state}
          </div>
        </div>
      </div>
    );
  }

  return <div className="flex min-h-[60vh] flex-col items-center justify-center">{state}</div>;
}
