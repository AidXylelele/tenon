import { ChevronRightIcon } from "lucide-react";
import {
  instanceCounts,
  instances,
  workflows,
} from "@/libs/data-access/automation";
import { available, UNAVAILABLE } from "@/libs/data-access/http";
import type { InstanceSummary, Workflow } from "@/libs/data-access/types";
import { RefreshControl } from "@/libs/live/refresh-control";
import { Link } from "@/libs/routing/link";
import {
  runHref,
  runsHref,
  workflowHref,
  WORKFLOWS_HREF,
} from "@/libs/routing/routes";
import { PageHeader } from "@/libs/ui/composites/page-header";
import { Time } from "@/libs/ui/composites/time";
import { PhaseCounts, PhaseStatus } from "@/features/run-status";
import { Unavailable } from "@/libs/ui/composites/unavailable";

const DAY_MS = 24 * 3_600_000;
const LIST_LENGTH = 6;

export async function Overview() {
  const { startedFrom, startedTo } = lastDay();
  const read = await available(
    Promise.all([
      workflows("active"),
      instanceCounts(startedFrom, startedTo),
      instances({ phase: "faulted", startedFrom, limit: LIST_LENGTH }),
      instances({ phase: "suspended", limit: LIST_LENGTH }),
      instances({ phase: "running", limit: LIST_LENGTH }),
      instances({ phase: "waiting", limit: LIST_LENGTH }),
    ]),
  );

  if (read === UNAVAILABLE) return <Unavailable />;

  const [active, day, faulted, suspended, running, waiting] = read;
  const automatic = active.items.filter((workflow) => workflow.on);
  const attention = faulted.items.concat(suspended.items);
  const inFlight = running.items.concat(waiting.items);
  const activity = inFlight.length > 0 ? "in-flight" : "open";
  const faultedRuns = runsHref({ phase: "faulted" });
  const runningRuns = runsHref({ phase: "running" });

  return (
    <>
      <PageHeader
        title="Home"
        actions={<RefreshControl activity={activity} renderedAt={day.readAt} />}
      />
      <PhaseCounts
        id="last-day"
        title="Last 24 hours"
        counts={day.counts}
        hrefOf={(phase) => runsHref({ phase })}
      />
      <RunSection
        id="attention"
        title="Needs attention"
        more={{ href: faultedRuns, label: "All faulted" }}
        runs={attention}
        empty="Nothing needs attention."
      />
      <RunSection
        id="running"
        title="Running now"
        more={{ href: runningRuns, label: "All running" }}
        runs={inFlight}
        empty="Nothing is running."
      />
      <AutomaticStarts workflows={automatic} />
    </>
  );
}

function RunSection({
  id,
  title,
  more,
  runs,
  empty,
}: {
  readonly id: string;
  readonly title: string;
  readonly more: { readonly href: string; readonly label: string };
  readonly runs: readonly InstanceSummary[];
  readonly empty: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col rounded-xl border bg-card"
    >
      <SectionHead id={id} title={title} more={more} />
      {runs.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ol className="flex flex-col divide-y">
          {runs.map((run) => (
            <RunRow key={run.id} run={run} />
          ))}
        </ol>
      )}
    </section>
  );
}

function RunRow({ run }: { readonly run: InstanceSummary }) {
  const href = runHref(run.id);

  return (
    <li>
      <Link
        href={href}
        className="flex min-h-10 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 transition-colors duration-(--duration-fast) hover:bg-muted"
      >
        <PhaseStatus phase={run.phase} className="shrink-0 sm:w-28" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {run.name}
          <span className="font-normal text-muted-foreground">
            {" "}
            {run.namespace}
          </span>
        </span>
        <span className="text-xs text-muted-foreground">
          <Time value={run.startedAt ?? run.createdAt} />
        </span>
      </Link>
    </li>
  );
}

function AutomaticStarts({
  workflows,
}: {
  readonly workflows: readonly Workflow[];
}) {
  return (
    <section
      aria-labelledby="automatic"
      className="flex flex-col rounded-xl border bg-card"
    >
      <SectionHead
        id="automatic"
        title="Automatic starts on"
        more={{ href: WORKFLOWS_HREF, label: "Workflows" }}
      />
      {workflows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          No workflow starts by itself. Give one a schedule or an event, publish
          it, and turn on its automatic starts.
        </p>
      ) : (
        <ul className="flex flex-col divide-y">
          {workflows.map((workflow) => (
            <li key={`${workflow.namespace}/${workflow.name}`}>
              <Link
                href={workflowHref(workflow.namespace, workflow.name)}
                className="flex min-h-10 items-center gap-4 px-4 py-2 text-sm transition-colors duration-(--duration-fast) hover:bg-muted"
              >
                <span className="min-w-0 flex-1 truncate font-medium">
                  {workflow.name}
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    {workflow.namespace}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {workflow.currentVersion}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SectionHead({
  id,
  title,
  more,
}: {
  readonly id: string;
  readonly title: string;
  readonly more: { readonly href: string; readonly label: string };
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
      <h2 id={id} className="heading-3">
        {title}
      </h2>
      <Link
        href={more.href}
        className="flex items-center gap-0.5 text-sm text-primary underline-offset-4 hover:underline"
      >
        {more.label}
        <ChevronRightIcon className="size-4" aria-hidden />
      </Link>
    </div>
  );
}

function lastDay(): {
  readonly startedFrom: string;
  readonly startedTo: string;
} {
  const now = Date.now();
  const startedFrom = new Date(now - DAY_MS).toISOString();
  const startedTo = new Date(now).toISOString();
  return { startedFrom, startedTo };
}
