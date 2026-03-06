import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-4 w-52" />
        </div>
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {[88, 64, 80, 104, 80].map((w, i) => (
          <Skeleton key={i} className="h-8 rounded-full" style={{ width: w }} />
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {/* Header row */}
        <div className="hidden sm:flex gap-4 px-5 py-2.5 bg-slate-50/80 border-b border-slate-100">
          <Skeleton className="h-3 w-full max-w-xs" />
        </div>

        {/* Row skeletons */}
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="flex sm:grid sm:grid-cols-[2fr_1.2fr_120px_160px_auto] gap-4 px-5 py-4 items-center"
            >
              {/* Client */}
              <div className="flex items-center gap-3 flex-1 sm:flex-none">
                <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                <div className="space-y-1.5 min-w-0">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              {/* Type */}
              <Skeleton className="hidden sm:block h-4 w-28" />
              {/* Status */}
              <Skeleton className="h-6 w-20 rounded-full shrink-0" />
              {/* Created */}
              <Skeleton className="hidden sm:block h-3 w-28" />
              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <Skeleton className="w-7 h-7 rounded-md" />
                <Skeleton className="w-7 h-7 rounded-md" />
                <Skeleton className="w-7 h-7 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
