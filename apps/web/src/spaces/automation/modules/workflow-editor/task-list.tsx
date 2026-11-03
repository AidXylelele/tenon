'use client';

import { cn } from 'cn';
import { CircleAlertIcon, PlusIcon } from 'lucide-react';
import type { JsonObject } from '@/libs/data-access/types';
import { Button } from '@/libs/ui/components/button';
import { infoOf } from '../../__shared_context/document/kinds';
import { summaryOf } from '../../__shared_context/document/summary';
import {
  entriesAt,
  nestedListsOf,
  type TaskKind,
} from '../../__shared_context/document/tasks';
import { RunLine, Station } from '../../__shared_context/outline/run-line';
import { TaskIcon } from '../../__shared_context/outline/task-icon';
import { AddTaskMenu } from './add-task-menu';

interface TaskListProps {
  readonly draft: JsonObject;
  readonly listPointer: string;
  readonly selected: string | null;
  // The task the check's problem lies in.
  readonly flagged: string | null;
  readonly onSelect: (pointer: string) => void;
  readonly onInsert: (
    listPointer: string,
    index: number,
    kind: TaskKind,
  ) => void;
  readonly addLabel?: string;
}

// The steps of one list on the run line, each a button that opens it in the inspector, with
// the lists it holds inside it and a way to add a step at the end.
export function TaskList({
  draft,
  listPointer,
  selected,
  flagged,
  onSelect,
  onInsert,
  addLabel = 'Add a step',
}: TaskListProps) {
  const entries = entriesAt(draft, listPointer);

  return (
    <div className="flex flex-col gap-2">
      {entries.length > 0 && (
        <RunLine>
          {entries.map((entry, index) => {
            const isSelected = selected === entry.pointer;
            const isFlagged =
              flagged !== null &&
              (flagged === entry.pointer ||
                flagged.startsWith(`${entry.pointer}/`));
            const ownProblem = flagged === entry.pointer;

            return (
              <Station
                key={entry.pointer}
                tone={ownProblem ? 'failed' : isSelected ? 'busy' : 'idle'}
                selected={isSelected}
                flagged={ownProblem}
                last={index === entries.length - 1}
              >
                <div className="group/step relative">
                  <button
                    type="button"
                    onClick={() => onSelect(entry.pointer)}
                    aria-pressed={isSelected}
                    className={cn(
                      'flex w-full min-w-0 flex-col gap-0.5 rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:border-foreground/20',
                      isSelected && 'border-sky-500/60 ring-3 ring-sky-500/15',
                      ownProblem && 'border-red-500/60',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <TaskIcon
                        kind={entry.kind}
                        className="size-3.5 shrink-0 text-muted-foreground"
                      />
                      <span className="truncate text-sm font-medium">
                        {entry.name}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {infoOf(entry.kind).label}
                      </span>
                      {isFlagged && (
                        <CircleAlertIcon
                          className="ml-auto size-4 shrink-0 text-red-500"
                          aria-label="Has a problem"
                        />
                      )}
                    </span>
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      {summaryOf(entry)}
                    </span>
                  </button>
                  <AddTaskMenu
                    onPick={(kind) => onInsert(listPointer, index + 1, kind)}
                  >
                    <button
                      type="button"
                      aria-label={`Add a step after ${entry.name}`}
                      className="absolute -bottom-3.5 left-1/2 z-10 flex size-6 -translate-x-1/2 items-center justify-center rounded-full border bg-background text-muted-foreground opacity-0 shadow-xs transition-opacity group-hover/step:opacity-100 hover:text-foreground focus-visible:opacity-100 data-[state=open]:opacity-100"
                    >
                      <PlusIcon className="size-3.5" />
                    </button>
                  </AddTaskMenu>
                </div>
                {nestedListsOf(entry).map((list) => (
                  <div
                    key={list.pointer}
                    className="mt-3 ml-1 rounded-lg border border-dashed p-3"
                  >
                    <div className="mb-2 text-xs font-medium text-muted-foreground">
                      {list.label}
                    </div>
                    <TaskList
                      draft={draft}
                      listPointer={list.pointer}
                      selected={selected}
                      flagged={flagged}
                      onSelect={onSelect}
                      onInsert={onInsert}
                      addLabel="Add a step here"
                    />
                  </div>
                ))}
              </Station>
            );
          })}
        </RunLine>
      )}
      <AddTaskMenu
        onPick={(kind) => onInsert(listPointer, entries.length, kind)}
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start border-dashed"
        >
          <PlusIcon data-icon="inline-start" />
          {addLabel}
        </Button>
      </AddTaskMenu>
    </div>
  );
}
