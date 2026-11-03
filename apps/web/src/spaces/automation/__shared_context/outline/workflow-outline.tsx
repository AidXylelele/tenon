import { cn } from 'cn';
import type { JsonObject, TaskStatus } from '@/libs/data-access/types';
import { summaryOf } from '../document/summary';
import {
  entriesAt,
  nestedListsOf,
  ROOT_LIST,
  type TaskEntry,
} from '../document/tasks';
import { describeTrigger, triggerOf } from '../document/trigger';
import { infoOf } from '../document/kinds';
import { type Tone, taskStatusLabel, taskStatusTone } from '../vocabulary';
import { RunLine, Station } from './run-line';
import { TaskIcon } from './task-icon';

export interface TaskProgress {
  readonly status: TaskStatus;
  // How many times the task ran (iterations, retries, later visits).
  readonly runs: number;
}

interface WorkflowOutlineProps {
  readonly document: JsonObject;
  // The latest progress of each task by its pointer, on an instance; absent on a version.
  readonly progress?: ReadonlyMap<string, TaskProgress>;
  // The pointer of the task that faulted the instance.
  readonly faultAt?: string | null;
  readonly startTone?: Tone;
}

// A version's tasks on the run line, read-only; on an instance, each station shows its task's
// latest status, and the faulting task is marked.
export function WorkflowOutline({
  document,
  progress,
  faultAt = null,
  startTone = 'done',
}: WorkflowOutlineProps) {
  const trigger = describeTrigger(triggerOf(document));
  const entries = entriesAt(document, ROOT_LIST);

  return (
    <RunLine>
      <Station
        tone={progress === undefined ? 'idle' : startTone}
        last={entries.length === 0}
      >
        <div className="text-sm font-medium">Start</div>
        <div className="text-xs text-muted-foreground">{trigger}</div>
      </Station>
      <Entries
        document={document}
        entries={entries}
        progress={progress}
        faultAt={faultAt}
      />
    </RunLine>
  );
}

interface EntriesProps {
  readonly document: JsonObject;
  readonly entries: readonly TaskEntry[];
  readonly progress?: ReadonlyMap<string, TaskProgress>;
  readonly faultAt: string | null;
}

function Entries({ document, entries, progress, faultAt }: EntriesProps) {
  return entries.map((entry, index) => {
    const seen = progress?.get(entry.pointer);
    const tone: Tone =
      seen === undefined ? 'idle' : taskStatusTone(seen.status);
    const faulted =
      faultAt !== null &&
      (faultAt === entry.pointer || faultAt.startsWith(`${entry.pointer}/`));
    const lists = nestedListsOf(entry);

    return (
      <Station
        key={entry.pointer}
        tone={faulted ? 'failed' : tone}
        live={seen?.status === 'running'}
        last={index === entries.length - 1}
        flagged={faulted}
      >
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <TaskIcon
              kind={entry.kind}
              className="size-3.5 text-muted-foreground"
            />
            {entry.name}
          </span>
          <span className="text-xs text-muted-foreground">
            {infoOf(entry.kind).label}
          </span>
          {seen !== undefined && (
            <span
              className={cn(
                'text-xs',
                faulted
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-muted-foreground',
              )}
            >
              {taskStatusLabel(seen.status)}
              {seen.runs > 1 && `, ${seen.runs} runs`}
            </span>
          )}
        </div>
        <div className="truncate font-mono text-xs text-muted-foreground">
          {summaryOf(entry)}
        </div>
        {lists.map((list) => {
          const nested = entriesAt(document, list.pointer);

          if (nested.length === 0) return null;

          return (
            <div
              key={list.pointer}
              className="mt-2 rounded-lg border border-dashed px-3 pt-2"
            >
              <div className="mb-1 text-xs text-muted-foreground">
                {list.label}
              </div>
              <RunLine>
                <Entries
                  document={document}
                  entries={nested}
                  progress={progress}
                  faultAt={faultAt}
                />
              </RunLine>
            </div>
          );
        })}
      </Station>
    );
  });
}
