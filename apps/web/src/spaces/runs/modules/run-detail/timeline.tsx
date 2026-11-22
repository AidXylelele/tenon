import { ChevronRightIcon } from "lucide-react";
import type { TaskRecord } from "@/libs/data-access/types";
import { JsonBlock } from "@/libs/ui/composites/json-block";
import { Countdown, Duration, Time } from "@/libs/ui/composites/time";
import { TaskStatusOf } from "@/features/run-status";

export function Timeline({
  records,
  more,
  open = false,
}: {
  readonly records: readonly TaskRecord[];
  readonly more: boolean;
  readonly open?: boolean;
}) {
  if (records.length === 0)
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No task has started yet.
      </p>
    );

  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col divide-y rounded-lg border">
        {records.map((record) => (
          <li key={record.execution}>
            <details className="group" open={open && records.length === 1}>
              <summary className="flex min-h-10 cursor-pointer list-none items-center gap-3 px-3 py-2 hover:bg-muted">
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {record.name}
                    </span>
                    {record.attempt > 1 && (
                      <span className="shrink-0 rounded-full bg-muted px-1.5 py-px text-xs font-medium text-muted-foreground">
                        Attempt {record.attempt}
                      </span>
                    )}
                  </span>
                  <span className="block truncate font-mono text-xs text-muted-foreground">
                    {record.execution}
                  </span>
                </span>
                <TaskStatusOf status={record.status} />
                <span className="w-20 shrink-0 text-right text-xs">
                  <Duration from={record.startedAt} to={record.endedAt} />
                </span>
              </summary>
              <div className="flex flex-col gap-3 border-t bg-muted/40 p-3">
                <div className="text-xs text-muted-foreground">
                  Started <Time value={record.startedAt} />
                  {record.endedAt !== null && (
                    <>
                      , ended <Time value={record.endedAt} />
                    </>
                  )}
                </div>
                {record.retryAt !== null && (
                  <div className="text-xs">
                    Tries again <Countdown to={record.retryAt} />
                  </div>
                )}
                {record.input !== null && (
                  <TaskData label="Input" value={record.input} />
                )}
                {record.output !== null && (
                  <TaskData label="Output" value={record.output} />
                )}
                {record.error !== null && (
                  <TaskData label="Error" value={record.error} />
                )}
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

function TaskData({
  label,
  value,
}: {
  readonly label: string;
  readonly value: unknown;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <JsonBlock value={value} empty="None" />
    </div>
  );
}
