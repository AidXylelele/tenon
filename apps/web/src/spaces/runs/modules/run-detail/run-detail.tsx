import { available, UNAVAILABLE } from "@/libs/data-access/http";
import { Link } from "@/libs/routing/link";
import { notFound } from "next/navigation";
import {
  instance as instanceOf,
  hostProfile,
  instanceEvents,
  taskRecords,
  versionStructure,
} from "@/libs/data-access/automation";
import { currentSession } from "@/libs/data-access/identity";
import type { Instance, Wait } from "@/libs/data-access/types";
import { RefreshControl } from "@/libs/live/refresh-control";
import { type Query, segment } from "@/libs/routing/segment";
import { Countdown, Duration, Time } from "@/libs/ui/composites/time";
import { runHref, versionHref } from "@/libs/routing/routes";
import { Unavailable } from "@/libs/ui/composites/unavailable";
import { isUnended, startedBy } from "@/operations/run-progress";
import { PhaseStatus } from "@/features/run-status";
import { ViewerLine } from "@/features/viewer-notice";
import { Controls } from "./controls";
import { type RunPanel, RunQuery } from "./query";
import { RunView } from "./run-view";

interface RunDetailProps {
  readonly params: { readonly id: string };
  readonly query: Query;
}

export async function RunDetail({ params, query }: RunDetailProps) {
  const id = segment(params.id);
  const address = RunQuery.parse(query);
  const read = await available(
    Promise.all([currentSession(), instanceOf(id), taskRecords(id)]),
  );

  if (read === UNAVAILABLE) return <Unavailable />;

  const [session, instance, records] = read;

  if (instance === null) notFound();

  const panel = address.view ?? defaultPanelOf(instance);
  const reading = panel === "events";
  const shown = await available(
    Promise.all([
      reading ? instanceEvents(id) : null,
      reading ? hostProfile() : null,
      versionStructure(instance.namespace, instance.name, instance.version),
    ]),
  );

  if (shown === UNAVAILABLE) return <Unavailable />;

  const [events, profile, workflow] = shown;
  const twins = new Set(
    (profile?.lifecycleEvents ?? []).flatMap((event) => event.types.slice(1)),
  );
  const live = isUnended(instance.phase);
  const author = session?.capabilities.author === true;
  const operator = session?.capabilities.operator === true;
  const activity = live ? "in-flight" : "ended";
  const more = records.next !== null;
  const eventItems =
    events?.items.filter((event) => !twins.has(event.type)) ?? null;

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
        events={eventItems}
        canEdit={author}
      />
    </div>
  );
}

function defaultPanelOf(instance: Instance): RunPanel {
  return isUnended(instance.phase) ? "timeline" : "result";
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
