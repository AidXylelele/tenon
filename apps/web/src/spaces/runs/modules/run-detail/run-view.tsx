"use client";

import { ChevronLeftIcon } from "lucide-react";
import type { Step, WorkflowStructure } from "language-server/protocol";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import type {
  CloudEvent,
  Instance,
  TaskRecord,
} from "@/libs/data-access/types";
import { Button } from "@/libs/ui/components/button";
import { Spinner } from "@/libs/ui/components/spinner";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/libs/ui/components/tabs";
import { JsonBlock } from "@/libs/ui/composites/json-block";
import {
  isUnended,
  progressOf,
  recordsOf,
  type TaskProgress,
} from "@/operations/run-progress";
import { stepsIn, stepsUnder } from "@/operations/workflow-graph";
import { kindInfoOf } from "@/operations/step-kinds";
import { TaskStatusOf } from "@/features/run-status";
import { TaskTile, WorkflowCanvas } from "@/features/workflow-canvas";
import { EventList } from "./event-list";
import { FaultStrip } from "./fault-strip";
import type { RunPanel } from "./query";
import { Timeline } from "./timeline";

interface RunViewProps {
  readonly instance: Instance;
  readonly workflow: WorkflowStructure | null;
  readonly records: readonly TaskRecord[];
  readonly more: boolean;
  readonly panel: RunPanel;
  readonly events: readonly CloudEvent[] | null;
  readonly canEdit: boolean;
}

export function RunView({
  instance,
  workflow,
  records,
  more,
  panel,
  events,
  canEdit,
}: RunViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [selected, setSelected] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ readonly step: string } | null>(null);
  const showStep = (step: string) => {
    setSelected(step);
    setReveal({ step });
  };
  const [shown, setShown] = useState<RunPanel>(panel);
  const [, startShowing] = useTransition();
  const show = (value: string) => {
    const chosen = value as RunPanel;
    const address = `${pathname}?view=${chosen}`;
    setShown(chosen);
    startShowing(() => {
      router.replace(address, { scroll: false });
    });
  };
  const steps = useMemo(
    () => (workflow === null ? [] : stepsIn(workflow.steps)),
    [workflow],
  );
  const progress = useMemo(() => progressOf(records, steps), [records, steps]);
  const status = useCallback(
    (step: Step) => <StepProgress progress={progress.get(step.id)} />,
    [progress],
  );
  const faulted = faultedStep(instance, records, steps);
  const step = steps.find((each) => each.id === selected) ?? null;
  const stepRecords = step === null ? [] : recordsOf(records, stepsUnder(step));
  const live = isUnended(instance.phase);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {instance.phase === "faulted" && (
        <FaultStrip
          instance={instance}
          step={faulted}
          canEdit={canEdit}
          onShow={showStep}
        />
      )}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative h-[50svh] min-h-80 flex-1 lg:h-auto">
          {workflow === null ? (
            <p className="p-6 text-sm text-muted-foreground">
              The version is no longer readable.
            </p>
          ) : (
            <WorkflowCanvas
              workflow={workflow}
              scope={`${instance.namespace}/${instance.name}`}
              selected={selected}
              onSelect={setSelected}
              status={status}
              reveal={reveal}
            />
          )}
        </div>
        <aside className="flex min-h-0 flex-col border-t bg-background lg:w-[28rem] lg:shrink-0 lg:overflow-y-auto lg:border-t-0 lg:border-l">
          {step === null ? (
            <Tabs value={shown} onValueChange={show} className="p-4">
              <TabsList className="w-full">
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                <TabsTrigger value="result">
                  {instance.phase === "faulted" ? "Error" : "Output"}
                </TabsTrigger>
                <TabsTrigger value="input">Input</TabsTrigger>
                <TabsTrigger value="events">Events</TabsTrigger>
              </TabsList>
              <TabsContent value="timeline">
                <Timeline records={records} more={more} />
              </TabsContent>
              <TabsContent value="result">
                <JsonBlock
                  value={
                    instance.phase === "faulted"
                      ? instance.error
                      : instance.output
                  }
                  empty={
                    live
                      ? "The output appears when the run completes."
                      : "No output."
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
                  onClick={() => {
                    setSelected(null);
                  }}
                >
                  <ChevronLeftIcon />
                </Button>
                <TaskTile kind={step.kind} size="sm" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    {step.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {kindInfoOf(step.kind).label},{" "}
                    {stepRecords.length === 1
                      ? "1 execution"
                      : `${String(stepRecords.length)} executions`}
                  </div>
                </div>
              </div>
              {stepRecords.length === 0 ? (
                <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  {live
                    ? "This task has not run yet."
                    : "This task did not run."}
                </p>
              ) : (
                <Timeline records={stepRecords} more={false} open />
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function StepProgress({
  progress,
}: {
  readonly progress: TaskProgress | undefined;
}) {
  if (progress === undefined) return null;

  return (
    <span className="flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-xs shadow-xs">
      <TaskStatusOf status={progress.status} />
      {progress.runs > 1 && (
        <span className="text-muted-foreground tabular-nums">
          ×{progress.runs}
        </span>
      )}
    </span>
  );
}

function faultedStep(
  instance: Instance,
  records: readonly TaskRecord[],
  steps: readonly Step[],
): Step | null {
  if (instance.phase !== "faulted") return null;

  const pointer = instance.error?.instance ?? null;
  const named = steps.find((each) => each.pointer === pointer);
  const failed = records.findLast((record) => record.status === "faulted");
  const recorded = steps.find((each) => each.pointer === failed?.reference);
  return named ?? recorded ?? null;
}
