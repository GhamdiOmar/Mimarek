"use client";

// ────────────────────────────────────────────────────────────
// Shared route-segment not-found UI.
// CLAUDE.md § 6.12 — friendly headline + primary action back to safety.
// ────────────────────────────────────────────────────────────
import { SearchX } from "lucide-react";
import Link from "next/link";
import { Button, EmptyState } from "@repo/ui";
import { useLanguage } from "../../../components/LanguageProvider";

export function RouteNotFound() {
  const { lang } = useLanguage();

  const title = lang === "ar" ? "الصفحة غير موجودة" : "Page not found";
  const description =
    lang === "ar"
      ? "الصفحة التي تبحث عنها غير موجودة أو تم نقلها."
      : "The page you're looking for doesn't exist or has been moved.";
  const backLabel =
    lang === "ar" ? "العودة إلى لوحة التحكم" : "Back to dashboard";

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <EmptyState
        variant="default"
        icon={<SearchX className="h-12 w-12" aria-hidden="true" />}
        title={title}
        description={description}
        action={
          <Button asChild variant="primary">
            <Link href="/dashboard">{backLabel}</Link>
          </Button>
        }
      />
    </div>
  );
}
