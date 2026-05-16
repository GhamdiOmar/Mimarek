import { Skeleton } from "@repo/ui";

export default function ListingDetailLoading() {
  return (
    <div className="space-y-6 p-6 max-w-3xl mx-auto">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-10 w-40" />
    </div>
  );
}
