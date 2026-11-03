'use client';

import { ChevronLeftIcon } from 'lucide-react';
import { useState } from 'react';
import type {
  CloudEvent,
  Instance,
  JsonObject,
  TaskRecord,
} from '@/libs/data-access/types';
import { Button } from '@/libs/ui/components/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/libs/ui/components/tabs';
import { JsonBlock } from '@/libs/ui/composites/json-block';
import { isWithin } from '@/libs/document-text/json-pointer';
import { START } from '../../__shared_context/canvas/graph';
import { WorkflowCanvas } from '../../__shared_context/canvas/workflow-canvas';
import { infoOf } from '../../__shared_context/document/kinds';
import { allEntries, entryAt } from '../../__shared_context/document/tasks';
import { progressOf } from '../../__shared_context/outline/progress';
import { tileOf } from '../../__shared_context/outline/families';
import { TaskIcon } from '../../__shared_context/outline/task-icon';
import { isUnended } from '../../__shared_context/vocabulary';
import { EventList } from './event-list';
import { Timeline } from './timeline';

interface RunViewProps {
  readonly instance: Instance;
  readonly document: JsonObject | null;
  readonly records: readonly TaskRecord[];
  readonly more: boolean;
  readonly events: readonly CloudEvent[];
}

// A run on the canvas (FR-024): each step coloured by its latest status and each connection
// it took, and beside it the run's output, input, timeline and events, or, for a picked step,
// every execution of that step.
export function RunView({
  instance,
  document,
  records,
  more,
  events,
}: RunViewProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const pointers =
    document === null
      ? []
      : allEntries(document).map(({ entry }) => entry.pointer);
  const progress = progressOf(records, pointers);
  const faultAt =
    instance.phase === 'faulted' ? (instance.error?.instance ?? null) : null;
  const step =
    selected === null || selected === START || document === null
      ? null
      : entryAt(document, selected);
  const stepRecords =
    step === null
      ? []
      : records.filter((record) => isWithin(record.reference, step.pointer));
  const live = isUnended(instance.phase);

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className="relative h-[50svh] min-h-80 flex-1 lg:h-auto">
        {document === null ? (
          <p className="p-6 text-sm text-muted-foreground">
            The version is no longer readable.
          </p>
        ) : (
          <WorkflowCanvas
            document={document}
            progress={progress}
            faultAt={faultAt}
            phase={instance.phase}
            selected={selected}
            onSelect={setSelected}
          />
        )}
      </div>
      <aside className="flex min-h-0 flex-col border-t bg-background lg:w-[28rem] lg:shrink-0 lg:overflow-y-auto lg:border-t-0 lg:border-l">
        {step === null ? (
          <Tabs
            defaultValue={
              instance.phase === 'faulted' || instance.phase === 'completed'
                ? 'output'
                : 'timeline'
            }
            className="p-4"
          >
            <TabsList className="w-full">
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="output">
                {instance.phase === 'faulted' ? 'Error' : 'Output'}
              </TabsTrigger>
              <TabsTrigger value="input">Input</TabsTrigger>
              <TabsTrigger value="events">Events {events.length}</TabsTrigger>
            </TabsList>
            <TabsContent value="timeline">
              <Timeline records={records} more={more} />
            </TabsContent>
            <TabsContent value="output">
              <JsonBlock
                value={
                  instance.phase === 'faulted'
                    ? instance.error
                    : instance.output
                }
                empty={
                  live
                    ? 'The output appears when the run completes.'
                    : 'No output.'
                }
              />
            </TabsContent>
            <TabsContent value="input">
              <JsonBlock value={instance.input} empty="No input." />
            </TabsContent>
            <TabsContent value="events">
              <EventList events={events} />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex flex-col gap-4 p-4">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Back to the run"
                onClick={() => setSelected(null)}
              >
                <ChevronLeftIcon />
              </Button>
              <span
                className={`flex size-9 items-center justify-center rounded-xl ring-1 ${tileOf(step.kind)}`}
              >
                <TaskIcon kind={step.kind} className="size-4" />
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">
                  {step.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {infoOf(step.kind).label},{' '}
                  {stepRecords.length === 1
                    ? '1 execution'
                    : `${stepRecords.length} executions`}
                </div>
              </div>
            </div>
            {stepRecords.length === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                {live ? 'This step has not run yet.' : 'This step did not run.'}
              </p>
            ) : (
              <Timeline records={stepRecords} more={false} open />
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
