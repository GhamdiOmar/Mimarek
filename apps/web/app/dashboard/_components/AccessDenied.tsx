"use client";

// ────────────────────────────────────────────────────────────
// Shared access-denied (HTTP 403) UI for tenant dashboard routes.
// Rendered by `app/dashboard/forbidden.tsx` when a tenant role lacks a
// route's permission (via `forbidden()` in `requireTenantPageAccess`).
// CLAUDE.md § 6.11.4 — customer-facing language only, never a bare bounce.
// CLAUDE.md § 6.12   — every blocked state: what happened + what to do next.
// ────────────────────────────────────────────────────────────
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button, EmptyState } from "@repo/ui";
import { useLanguage } from "../../../components/LanguageProvider";

export function AccessDenied() {
  const { lang } = useLanguage();

  const title =
    lang === "ar"
      ? "ليس لديك صلاحية الوصول إلى هذه الصفحة"
      : "You don't have access to this page";
  const description =
    lang === "ar"
      ? "صلاحيات دورك لا تشمل هذا القسم. تواصل مع مسؤول مؤسستك أو اطلب صلاحية الوصول عبر صفحة المساعدة."
      : "Your role doesn't include permission for this section. Contact your organization's administrator, or request access through Help.";
  const requestLabel = lang === "ar" ? "طلب صلاحية وصول" : "Request access";
  const backLabel = lang === "ar" ? "العودة إلى لوحة التحكم" : "Back to dashboard";

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <EmptyState
        variant="forbidden"
        icon={<ShieldAlert className="h-12 w-12" aria-hidden="true" />}
        title={title}
        description={description}
        action={
          <Button type="button" variant="primary" asChild>
            <Link href="/dashboard/help">{requestLabel}</Link>
          </Button>
        }
        secondaryAction={
          <Button type="button" variant="ghost" asChild>
            <Link href="/dashboard">{backLabel}</Link>
          </Button>
        }
      />
    </div>
  );
}
