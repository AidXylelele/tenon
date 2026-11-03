import { Skeleton } from '@/libs/ui/components/skeleton';

export default function CanvasLoading() {
  return (
    <div className="flex flex-1 flex-col" aria-busy="true" aria-label="Loading">
      <div className="flex h-14 items-center gap-3 border-b px-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="ml-auto h-8 w-28" />
      </div>
      <div className="flex flex-1 items-center justify-center gap-16 bg-muted/20">
        <Skeleton className="h-16 w-52 rounded-2xl" />
        <Skeleton className="h-16 w-60 rounded-2xl" />
        <Skeleton className="h-16 w-60 rounded-2xl" />
      </div>
    </div>
  );
}
