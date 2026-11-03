import { Skeleton } from '../components/skeleton';

// The frame of a page while its data arrives: a heading and a block of rows, so navigation
// shows where it goes at once (spec FR-018).
export function PageSkeleton({ rows = 6 }: { readonly rows?: number }) {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="flex flex-col gap-2 rounded-lg border p-4">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}
