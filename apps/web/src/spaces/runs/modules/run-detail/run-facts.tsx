import { Fragment } from "react";
import type { Instance, Wait } from "@/libs/data-access/types";
import { Link } from "@/libs/routing/link";
import { runHref, versionHref } from "@/libs/routing/routes";
import { AbsoluteTime } from "@/libs/ui/composites/absolute-time";
import { Countdown, Duration } from "@/libs/ui/composites/time";
import { startedBy } from "@/operations/run-progress";

const LINK = "underline-offset-4 hover:underline";

export function RunFacts({ instance }: { readonly instance: Instance }) {
  const version = versionHref(
    instance.namespace,
    instance.name,
    instance.version,
  );
  const starter =
    instance.startedBy === null
      ? startedBy(instance.trigger)
      : `Started by ${instance.startedBy.name}`;
  const took = instance.endedAt === null ? "running for" : "took";
  const origin = instance.originId;
  const facts = [
    <span key="version">
      Version{" "}
      <Link href={version} className={`tabular-nums ${LINK}`}>
        {instance.version}
      </Link>
    </span>,
    <span key="starter">{starter}</span>,
    <AbsoluteTime
      key="started"
      value={instance.startedAt ?? instance.createdAt}
    />,
    <span key="took">
      {took} <Duration from={instance.startedAt} to={instance.endedAt} />
    </span>,
    origin !== null && (
      <Link key="origin" href={runHref(origin)} className={LINK}>
        {instance.trigger === "restart"
          ? "Run again from an earlier run"
          : "Started by its parent run"}
      </Link>
    ),
    instance.cancelReason !== null && (
      <span key="cancel">Cancelled: {instance.cancelReason}</span>
    ),
    ...instance.waits.map((wait, index) => (
      <WaitFact key={`wait-${String(index)}`} wait={wait} />
    )),
    <span key="id">
      run <span className="font-mono">{instance.id}</span>
    </span>,
  ].filter((fact) => fact !== false);

  return (
    <p className="mt-1 text-sm text-muted-foreground">
      {facts.map((fact, index) => (
        <Fragment key={fact.key}>
          {index > 0 && " · "}
          {fact}
        </Fragment>
      ))}
    </p>
  );
}

function WaitFact({ wait }: { readonly wait: Wait }) {
  if (wait.kind === "timer" && wait.until !== null)
    return (
      <span>
        waits; resumes <Countdown to={wait.until} />
      </span>
    );

  if (wait.kind === "event")
    return <span>waits for an event on {wait.stream ?? "its stream"}</span>;

  if (wait.kind === "child" && wait.instanceId !== null)
    return (
      <Link href={runHref(wait.instanceId)} className={LINK}>
        waits for a child run
      </Link>
    );

  if (wait.kind === "message") return <span>waits for a message</span>;

  return <span>waits</span>;
}
