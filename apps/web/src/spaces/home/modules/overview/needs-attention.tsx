import type {
  FailingWorkflow,
  FailingWorkflows,
  ListedInstance,
} from "@/libs/data-access/types";
import { Link } from "@/libs/routing/link";
import { runHref, runsHref } from "@/libs/routing/routes";
import { Time } from "@/libs/ui/composites/time";
import { type Period, periodPhrase } from "@/operations/run-periods";
import { PhaseStatus } from "@/features/run-status";
import { SectionHead } from "./section-head";

const numbers = new Intl.NumberFormat("en-US");

const ROW =
  "flex min-h-12 flex-wrap items-start gap-x-4 gap-y-1 px-4 py-2.5 transition-colors duration-(--duration-fast) hover:bg-muted";

export function NeedsAttention({
  period,
  failing,
  paused,
  failedHref,
}: {
  readonly period: Period;
  readonly failing: FailingWorkflows;
  readonly paused: readonly ListedInstance[];
  readonly failedHref: string;
}) {
  const failed = numbers.format(failing.failed);
  const more = { href: failedHref, label: `All ${failed} failed runs` };
  const phrase = periodPhrase(period);
  const calm = failing.items.length === 0 && paused.length === 0;
  const tally = `${numbers.format(failing.workflows)} workflows · ${failed} failed runs ${phrase}.`;

  return (
    <section
      aria-labelledby="attention"
      className="flex flex-col rounded-xl border bg-card"
    >
      <SectionHead id="attention" title="Needs attention" more={more} />
      {calm ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          Nothing needs attention {phrase}.
        </p>
      ) : (
        <ul className="flex flex-col divide-y">
          {failing.items.map((workflow) => (
            <FailingRow
              key={`${workflow.namespace}/${workflow.name}`}
              workflow={workflow}
              period={period}
            />
          ))}
          {paused.map((run) => (
            <PausedRow key={run.id} run={run} />
          ))}
        </ul>
      )}
      {failing.workflows > 0 && (
        <p className="border-t px-4 py-2 text-caption text-muted-foreground">
          {tally}
        </p>
      )}
    </section>
  );
}

function FailingRow({
  workflow,
  period,
}: {
  readonly workflow: FailingWorkflow;
  readonly period: Period;
}) {
  const href = runsHref({
    namespace: workflow.namespace,
    name: workflow.name,
    status: "failed",
    started: period,
  });
  const share = `${numbers.format(workflow.failed)} of ${numbers.format(workflow.runs)} runs failed`;
  const state = workflow.stillFailing ? "still failing" : "last run succeeded";
  const tone = workflow.stillFailing
    ? "text-destructive"
    : "text-muted-foreground";
  const why = whyOf(workflow);

  return (
    <li>
      <Link href={href} className={ROW}>
        <PhaseStatus phase="faulted" className="shrink-0 sm:w-28" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
          <span>
            <span className="font-medium">{workflow.name}</span>
            <span className="text-muted-foreground">
              {" "}
              · {share} · since <Time value={workflow.firstFailedAt} /> · last{" "}
              <Time value={workflow.lastFailedAt} /> ·{" "}
            </span>
            <span className={tone}>{state}</span>
          </span>
          {why !== null && (
            <span className="truncate text-muted-foreground">{why}</span>
          )}
        </span>
      </Link>
    </li>
  );
}

function PausedRow({ run }: { readonly run: ListedInstance }) {
  const href = runHref(run.id);
  const by = run.startedBy?.name;

  return (
    <li>
      <Link href={href} className={ROW}>
        <PhaseStatus phase={run.phase} className="shrink-0 sm:w-28" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
          <span>
            <span className="font-medium">{run.name}</span>
            <span className="text-muted-foreground">
              {" "}
              · started <Time value={run.startedAt} />
              {by !== undefined && ` by ${by}`}
            </span>
          </span>
          <span className="text-muted-foreground">
            Paused runs wait for a person; nothing happens until it is resumed
            or cancelled.
          </span>
        </span>
      </Link>
    </li>
  );
}

function whyOf(workflow: FailingWorkflow): string | null {
  const error = workflow.lastError;
  const words = [error.title, error.detail].filter(
    (each): each is string => each !== null && each !== "",
  );

  if (words.length === 0) return null;

  return words.join(": ");
}
