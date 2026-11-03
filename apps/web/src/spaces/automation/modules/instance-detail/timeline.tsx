import { ChevronRightIcon } from 'lucide-react';
import type { TaskRecord } from '@/libs/data-access/types';
import { JsonBlock } from '@/libs/ui/composites/json-block';
import { Duration, Time } from '@/libs/ui/composites/time';
import {
  Status,
  taskStatusLabel,
  taskStatusTone,
} from '../../__shared_context/vocabulary';

// The task records in start order, one per execution (002 FR-016); each opens to its input,
// output and error.
export function Timeline({
  records,
  more,
  open = false,
}: {
  readonly records: readonly TaskRecord[];
  readonly more: boolean;
  // Opens a single record at once, as when one step is picked.
  readonly open?: boolean;
}) {
  if (records.length === 0)
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No step has started yet.
      </p>
    );

  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col divide-y rounded-lg border">
        {records.map((record) => (
          <li key={record.execution}>
            <details className="group" open={open && records.length === 1}>
              <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2 hover:bg-muted/50">
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {record.name}
                  </span>
                  <span className="block truncate font-mono text-xs text-muted-foreground">
                    {record.execution}
                  </span>
                </span>
                <Status
                  tone={taskStatusTone(record.status)}
                  label={taskStatusLabel(record.status)}
                  live={record.status === 'running'}
                  className="shrink-0"
                />
                <span className="hidden w-24 shrink-0 text-right text-xs text-muted-foreground sm:block">
                  <Time value={record.startedAt} />
                </span>
                <span className="w-20 shrink-0 text-right text-xs">
                  <Duration from={record.startedAt} to={record.endedAt} />
                </span>
              </summary>
              <div className="grid gap-3 border-t bg-muted/20 p-3 md:grid-cols-2">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="text-xs font-medium text-muted-foreground">
                    Input
                  </div>
                  <JsonBlock value={record.input} empty="None" />
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="text-xs font-medium text-muted-foreground">
                    {record.error !== null ? 'Error' : 'Output'}
                  </div>
                  <JsonBlock
                    value={record.error ?? record.output}
                    empty={
                      record.status === 'running' ? 'Still running' : 'None'
                    }
                  />
                </div>
              </div>
            </details>
          </li>
        ))}
      </ol>
      {more && (
        <p className="text-xs text-muted-foreground">
          The first {records.length} records are shown; the run has more.
        </p>
      )}
    </div>
  );
}
