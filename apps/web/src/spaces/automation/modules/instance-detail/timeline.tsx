import { ChevronRightIcon } from 'lucide-react';
import type { TaskRecord } from '@/libs/data-access/types';
import { JsonBlock } from '@/libs/ui/composites/json-block';
import { Countdown, Duration, Time } from '@/libs/ui/composites/time';
import { attemptsOf } from '../../__shared_context/outline/progress';
import {
  Status,
  taskStatusLabel,
  taskStatusTone,
} from '../../__shared_context/vocabulary';

// The task records in start order, one per execution (002 FR-016), each attempt of a retried
// step its own; each opens to its input, output and error, and a retried attempt says when the
// next one starts (FR-033).
export function Timeline({
  records,
  more,
  advancing,
  open = false,
}: {
  readonly records: readonly TaskRecord[];
  readonly more: boolean;
  // The run moves on its own, so an attempt that is retried counts down to the next.
  readonly advancing: boolean;
  // Opens a single record at once, as when one step is picked.
  readonly open?: boolean;
}) {
  // The panel beside the canvas is narrow: names get the room, and the start time moves into
  // the record, where it is exact.
  if (records.length === 0)
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No step has started yet.
      </p>
    );

  const attempts = attemptsOf(records);

  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col divide-y rounded-lg border">
        {records.map((record) => {
          const seen = attempts.get(record.execution);
          const attempt = seen?.attempt ?? record.attempt;
          const retried = seen?.retried ?? false;
          const waiting = advancing && record.retryAt !== null && !retried;

          return (
            <li key={record.execution}>
              <details className="group" open={open && records.length === 1}>
                <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2 hover:bg-muted/50">
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {record.name}
                      </span>
                      {attempt > 1 && (
                        <span className="shrink-0 rounded-full bg-muted px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                          Attempt {attempt}
                        </span>
                      )}
                    </span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">
                      {record.execution}
                    </span>
                  </span>
                  <Status
                    tone={waiting ? 'waiting' : taskStatusTone(record.status)}
                    label={
                      waiting ? 'Tries again' : taskStatusLabel(record.status)
                    }
                    live={record.status === 'running' || waiting}
                    className="shrink-0"
                  />

                  <span className="w-20 shrink-0 text-right text-xs">
                    <Duration from={record.startedAt} to={record.endedAt} />
                  </span>
                </summary>
                <div className="flex flex-col gap-3 border-t bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">
                    Started <Time value={record.startedAt} />
                    {record.endedAt !== null && (
                      <>
                        , ended <Time value={record.endedAt} />
                      </>
                    )}
                    {record.retryAt !== null && waiting && (
                      <>
                        . The next attempt starts{' '}
                        <Countdown to={record.retryAt} />
                      </>
                    )}
                    {record.retryAt !== null && retried && (
                      <>
                        . Tried again <Time value={record.retryAt} />
                      </>
                    )}
                  </div>
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
          );
        })}
      </ol>
      {more && (
        <p className="text-xs text-muted-foreground">
          The first {records.length} records are shown; the run has more.
        </p>
      )}
    </div>
  );
}
