"use client";

import * as React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@repo/ui";

export default function MarketplaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="mb-1 text-lg font-semibold text-foreground">
        حدث خطأ ما / Something went wrong
      </h2>
      <p className="mb-6 max-w-md text-sm text-muted-foreground">
        تعذّر تحميل هذه الصفحة. حاول مجدداً، أو تواصل مع الدعم إذا استمرت المشكلة.
      </p>
      <div className="flex items-center gap-2">
        <Button type="button" variant="primary" onClick={() => reset()}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          <span className="ms-1.5">إعادة المحاولة / Retry</span>
        </Button>
      </div>
      {error.digest && (
        <p className="mt-4 font-mono text-[11px] text-muted-foreground/70">
          Reference: {error.digest}
        </p>
      )}
    </div>
  );
}
