import { Skeleton } from "@/libs/ui/components/skeleton";
import { PageLoading } from "../../__shared_context/page-loading";

const ROWS = [0, 1, 2, 3, 4, 5];

export function ColumnLoading() {
  return (
    <PageLoading className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="flex flex-col gap-2 rounded-lg border p-4">
        {ROWS.map((row) => (
          <Skeleton key={row} className="h-8 w-full" />
        ))}
      </div>
    </PageLoading>
  );
}
