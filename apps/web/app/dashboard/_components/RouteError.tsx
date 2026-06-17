"use client";

// ────────────────────────────────────────────────────────────
// Shared route-segment error boundary UI.
// CLAUDE.md § 6.11.4 — customer-facing language only, never stack traces.
// CLAUDE.md § 6.12   — every error: what happened + what to do + retry.
// ────────────────────────────────────────────────────────────
import * as React from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button, EmptyState } from "@repo/ui";
import { useLanguage } from "../../../components/LanguageProvider";

export interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export function RouteError({ error, reset }: RouteErrorProps) {
  const { t, lang } = useLanguage();

  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  const title =
    t("حدث خطأ غير متوقع", "Something went wrong");
  const description =
    t("تعذّر تحميل هذه الصفحة. حاول مرة أخرى أو تواصل مع الدعم إذا استمرت المشكلة.", "We couldn't load this page. Try again, or contact support if the problem persists.");
  const retryLabel = t("حاول مرة أخرى", "Try again");
  const supportLabel = t("تواصل مع الدعم", "Contact support");
  const referenceLabel = t("المرجع", "Reference");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <EmptyState
        variant="error"
        icon={<AlertTriangle className="h-12 w-12" aria-hidden="true" />}
        title={title}
        description={description}
        action={
          <Button type="button" variant="primary" onClick={() => reset()}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {retryLabel}
          </Button>
        }
        secondaryAction={
          <Button type="button" variant="ghost" asChild>
            <Link href="/dashboard/help">{supportLabel}</Link>
          </Button>
        }
      />
      {error.digest && (
        <p className="-mt-6 font-mono text-[11px] text-muted-foreground">
          {referenceLabel}: {error.digest}
        </p>
      )}
    </div>
  );
}
