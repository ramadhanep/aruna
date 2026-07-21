import { Skeleton } from "@/components/ui/skeleton";

export function TickerRowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton className="h-3 w-16 rounded-full" />
        <Skeleton className="h-3 w-32 rounded-full" />
      </div>
      <Skeleton className="w-[72px] h-[36px] rounded-xl" />
      <div className="flex flex-col items-end gap-1">
        <Skeleton className="h-3 w-20 rounded-full" />
        <Skeleton className="h-3 w-16 rounded-full" />
      </div>
    </div>
  );
}
