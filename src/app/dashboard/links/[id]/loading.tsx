import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6 max-w-[1080px]">
      <Skeleton className="h-4 w-20" />

      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-start gap-4">
          <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <Skeleton className="h-7 w-44" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
        <div className="flex flex-wrap gap-6 mt-5 pt-5 border-t border-border">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-36" />
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">
        <div className="bg-card rounded-xl border border-border p-6 space-y-1">
          <Skeleton className="h-3 w-36 mb-6" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="flex flex-col items-center">
                <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                {i < 3 && <div className="w-px h-8 bg-border my-1" />}
              </div>
              <div className="space-y-1.5 pt-2 pb-4">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-5">
          <div className="bg-card rounded-xl border border-border p-5 space-y-2">
            <Skeleton className="h-3 w-16 mb-1" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
          <div className="bg-card rounded-xl border border-border p-5 space-y-3">
            <Skeleton className="h-3 w-28 mb-1" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex justify-between gap-4">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-3.5 w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
