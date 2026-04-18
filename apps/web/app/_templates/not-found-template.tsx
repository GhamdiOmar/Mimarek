// ────────────────────────────────────────────────────────────
// TEMPLATE — copy into a route segment as `not-found.tsx`.
// CLAUDE.md § 6.12 — friendly headline + action.
// ────────────────────────────────────────────────────────────
import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { Button } from "@repo/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <FileQuestion className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="mb-1 text-lg font-semibold text-foreground">
        Page not found
      </h2>
      <p className="mb-6 max-w-md text-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Button asChild variant="primary">
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}
