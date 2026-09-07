import { Skeleton } from '@/components/ui/skeleton';

export function DashboardSkeleton() {
  return (
    <div className="container max-w-[1160px] py-8">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-7 w-72" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-6 w-40 rounded-full" />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4">
            <Skeleton className="mb-3 h-3 w-24" />
            <Skeleton className="h-7 w-14" />
          </div>
        ))}
      </div>

      <div className="mb-4 rounded-lg border p-4">
        <Skeleton className="mb-3 h-4 w-32" />
        <Skeleton className="h-2.5 w-full rounded-full" />
      </div>

      <Skeleton className="mb-4 h-9 w-full" />

      <div className="space-y-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
