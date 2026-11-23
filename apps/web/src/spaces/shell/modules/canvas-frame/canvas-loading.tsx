import { Skeleton } from "@/libs/ui/components/skeleton";
import { PageLoading } from "../../__shared_context/page-loading";

export function CanvasLoading() {
  return (
    <PageLoading className="flex flex-1 flex-col">
      <div className="flex h-(--topbar-height) items-center gap-3 border-b px-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="ml-auto h-8 w-28" />
      </div>
      <div className="flex flex-1 items-center justify-center gap-16 bg-canvas">
        <Skeleton className="h-16 w-52 rounded-lg" />
        <Skeleton className="h-16 w-60 rounded-lg" />
        <Skeleton className="h-16 w-60 rounded-lg" />
      </div>
    </PageLoading>
  );
}
