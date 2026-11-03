'use client';

import { ChevronLeftIcon } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import type {
  CloudEvent,
  Instance,
  TaskRecord,
} from '@/libs/data-access/types';
import type { JsonObject } from '@/libs/document-text/json';
import { Button } from '@/libs/ui/components/button';
import { Spinner } from '@/libs/ui/components/spinner';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/libs/ui/components/tabs';
import { JsonBlock } from '@/libs/ui/composites/json-block';
import { isWithin } from '@/libs/document-text/json-pointer';
import { isAdvancing, isUnended, progressOf } from '@/operations/run-progress';
import {
  allEntries,
  entryAt,
  infoOf,
  protectionOf,
} from '@/operations/workflow-document';
import { START } from '../../__shared_context/canvas/graph';
import {
  type Reveal,
  WorkflowCanvas,
} from '../../__shared_context/canvas/workflow-canvas';
import { tileOf } from '../../__shared_context/outline/families';
import { TaskIcon } from '../../__shared_context/outline/task-icon';
import { EventList } from './event-list';
import { FaultStrip } from './fault-strip';
import { Timeline } from './timeline';

export type RunPanel = 'timeline' | 'result' | 'input' | 'events';

interface RunViewProps {
  readonly instance: Instance;
  readonly document: JsonObject | null;
  readonly records: readonly TaskRecord[];
  readonly more: boolean;
  readonly panel: RunPanel;
  // Read only while the events panel is shown.
  readonly events: readonly CloudEvent[] | null;
  // Authors may open the workflow in the editor from a fault.
  readonly canEdit: boolean;
}

// A run on the canvas (FR-024): each step coloured by its latest status and each connection
// it took, and beside it the run's output, input, timeline and events, or, for a picked step,
// every execution of that step. A faulted run says above them why, and where (FR-033).
export function RunView({
  instance,
  document,
  records,
  more,
  panel,
  events,
  canEdit,
}: RunViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [selected, setSelected] = useState<string | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  // The fault's step, picked and brought into view.
  const showStep = (id: string) => {
    setSelected(id);
    setReveal({ id });
  };
  const [shown, setShown] = useState<RunPanel>(panel);
  const [, startShowing] = useTransition();
  // The panel lives in the address, so the server reads the events only when they are shown.
  const show = (value: string) => {
    const chosen = value as RunPanel;
    const address = `${pathname}?view=${chosen}`;
    setShown(chosen);
    startShowing(() => router.replace(address, { scroll: false }));
  };
  // Kept across renders that bring the same run, so a live refresh redraws only what changed.
  const pointers = useMemo(
    () =>
      document === null
        ? []
        : allEntries(document).map(({ entry }) => entry.pointer),
    [document],
  );
  const progress = useMemo(
    () => progressOf(records, pointers),
    [records, pointers],
  );
  const faultAt =
    instance.phase === 'faulted' ? (instance.error?.instance ?? null) : null;
  const step =
    selected === null || selected === START || document === null
      ? null
      : entryAt(document, selected);
  // A step a `try` protects on its own is drawn as that step, and shown as it.
  const protection =
    step === null || document === null ? null : protectionOf(document, step);
  const picked = protection?.step ?? step;
  const stepRecords =
    picked === null
      ? []
      : records.filter((record) => isWithin(record.reference, picked.pointer));
  const live = isUnended(instance.phase);
  const advancing = isAdvancing(instance.phase);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {instance.phase === 'faulted' && (
        <FaultStrip
          instance={instance}
          document={document}
          canEdit={canEdit}
          onShow={showStep}
        />
      )}
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
              reveal={reveal}
            />
          )}
        </div>
        <aside className="flex min-h-0 flex-col border-t bg-background lg:w-[28rem] lg:shrink-0 lg:overflow-y-auto lg:border-t-0 lg:border-l">
          {picked === null ? (
            <Tabs value={shown} onValueChange={show} className="p-4">
              <TabsList className="w-full">
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                <TabsTrigger value="result">
                  {instance.phase === 'faulted' ? 'Error' : 'Output'}
                </TabsTrigger>
                <TabsTrigger value="input">Input</TabsTrigger>
                <TabsTrigger value="events">Events</TabsTrigger>
              </TabsList>
              <TabsContent value="timeline">
                <Timeline records={records} more={more} advancing={advancing} />
              </TabsContent>
              <TabsContent value="result">
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
                {events === null ? (
                  <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                    <Spinner /> Reading the run&apos;s events…
                  </p>
                ) : (
                  <EventList events={events} />
                )}
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
                  className={`flex size-9 items-center justify-center rounded-xl ring-1 ${tileOf(picked.kind)}`}
                >
                  <TaskIcon kind={picked.kind} className="size-4" />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    {picked.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {infoOf(picked.kind).label},{' '}
                    {stepRecords.length === 1
                      ? '1 execution'
                      : `${stepRecords.length} executions`}
                  </div>
                </div>
              </div>
              {stepRecords.length === 0 ? (
                <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  {live
                    ? 'This step has not run yet.'
                    : 'This step did not run.'}
                </p>
              ) : (
                <Timeline
                  records={stepRecords}
                  more={false}
                  advancing={advancing}
                  open
                />
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
