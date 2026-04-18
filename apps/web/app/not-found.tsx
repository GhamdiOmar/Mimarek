import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@repo/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <FileQuestion className="h-7 w-7" aria-hidden="true" />
      </div>
      <h1 className="mb-1 text-xl font-semibold text-foreground">
        Page not found
      </h1>
      <p className="mb-6 max-w-md text-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="flex items-center gap-2">
        <Button asChild variant="primary">
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/">Home</Link>
        </Button>
      </div>
    </div>
  );
}
