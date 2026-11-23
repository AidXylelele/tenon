import type { WorkflowStructure } from "language-server/protocol";
import type {
  CloudEvent,
  Instance,
  Page,
  Read,
  TaskRecord,
  Wait,
} from "@/libs/data-access/types";
import { RefreshControl } from "@/libs/live/refresh-control";
import { Link } from "@/libs/routing/link";
import { runHref, versionHref } from "@/libs/routing/routes";
import { Countdown, Duration, Time } from "@/libs/ui/composites/time";
import { isUnended, startedBy } from "@/operations/run-progress";
import { PhaseStatus } from "@/features/run-status";
import { ViewerLine } from "@/features/viewer-notice";
import { Controls } from "./controls";
import type { RunPanel } from "./query";
import { RunView } from "./run-view";

export interface RunPageProps {
  readonly instance: Instance;
  readonly workflow: WorkflowStructure | null;
  readonly records: Read<Page<TaskRecord>>;
  readonly panel: RunPanel;
  readonly events: readonly CloudEvent[] | null;
  readonly author: boolean;
  readonly operator: boolean;
}

export function RunPage({
  instance,
  workflow,
  records,
  panel,
  events,
  author,
  operator,
}: RunPageProps) {
  const live = isUnended(instance.phase);
  const activity = live ? "in-flight" : "ended";
  const more = records.next !== null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3 border-b px-4 py-3 md:px-6">
        <div className="min-w-60 flex-1">
          <h1 className="heading-1 flex flex-wrap items-center gap-3">
            Run of {instance.name}
            <PhaseStatus phase={instance.phase} />
          </h1>
          <Facts instance={instance} />
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          {operator ? (
            <Controls id={instance.id} controls={instance.controls} />
          ) : (
            <ViewerLine />
          )}
          <RefreshControl activity={activity} renderedAt={records.readAt} />
        </div>
      </div>
      <RunView
        instance={instance}
        workflow={workflow}
        records={records.items}
        more={more}
        panel={panel}
        events={events}
        canEdit={author}
      />
    </div>
  );
}

function Facts({ instance }: { readonly instance: Instance }) {
  return (
    <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
      <span>
        Version{" "}
        <Link
          href={versionHref(
            instance.namespace,
            instance.name,
            instance.version,
          )}
          className="tabular-nums underline-offset-4 hover:underline"
        >
          {instance.version}
        </Link>
      </span>
      <span>
        {instance.startedBy === null
          ? startedBy(instance.trigger)
          : `Started by ${instance.startedBy.name}`}
      </span>
      <span>
        <Time value={instance.startedAt ?? instance.createdAt} />
      </span>
      <span>
        {instance.endedAt === null ? "Running for" : "Took"}{" "}
        <Duration from={instance.startedAt} to={instance.endedAt} />
      </span>
      {instance.originId !== null && (
        <Link
          href={runHref(instance.originId)}
          className="underline-offset-4 hover:underline"
        >
          {instance.trigger === "restart"
            ? "Run again from an earlier run"
            : "Started by its parent run"}
        </Link>
      )}
      {instance.cancelReason !== null && (
        <span>Cancelled: {instance.cancelReason}</span>
      )}
      {instance.waits.map((wait, index) => (
        <WaitFact key={index} wait={wait} />
      ))}
    </p>
  );
}

function WaitFact({ wait }: { readonly wait: Wait }) {
  if (wait.kind === "timer" && wait.until !== null)
    return (
      <span>
        Waits; resumes <Countdown to={wait.until} />
      </span>
    );

  if (wait.kind === "event")
    return <span>Waits for an event on {wait.stream ?? "its stream"}</span>;

  if (wait.kind === "child" && wait.instanceId !== null)
    return (
      <Link
        href={runHref(wait.instanceId)}
        className="underline-offset-4 hover:underline"
      >
        Waits for a child run
      </Link>
    );

  if (wait.kind === "message") return <span>Waits for a message</span>;

  return <span>Waits</span>;
}
