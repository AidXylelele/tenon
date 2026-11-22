import { Skeleton } from "@/libs/ui/components/skeleton";

const ROWS = [0, 1, 2, 3, 4, 5];

export function ColumnLoading() {
  return (
    <div className="flex flex-col gap-6" role="status">
      <span className="sr-only">Loading…</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="flex flex-col gap-2 rounded-xl border p-4">
        {ROWS.map((row) => (
          <Skeleton key={row} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}
