import { ChevronRightIcon } from 'lucide-react';
import type { CloudEvent } from '@/libs/data-access/types';
import { JsonBlock } from '@/libs/ui/composites/json-block';
import { Time } from '@/libs/ui/composites/time';

// The run's lifecycle events and the events it emitted, in the order the platform accepted
// them (002 FR-030).
export function EventList({
  events,
}: {
  readonly events: readonly CloudEvent[];
}) {
  if (events.length === 0)
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No events yet.
      </p>
    );

  return (
    <ol className="flex flex-col divide-y rounded-lg border">
      {events.map((event) => (
        <li key={`${event.source}/${event.id}`}>
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2 hover:bg-muted/50">
              <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-xs font-medium">
                  {event.type}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {event.source}
                </span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                <Time value={event.time ?? null} />
              </span>
            </summary>
            <div className="border-t bg-muted/20 p-3">
              <JsonBlock value={event} />
            </div>
          </details>
        </li>
      ))}
    </ol>
  );
}
