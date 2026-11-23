import { ChevronRightIcon } from "lucide-react";
import type {
  FailingWorkflow,
  FailingWorkflows,
  ListedInstance,
} from "@/libs/data-access/types";
import { Link } from "@/libs/routing/link";
import { runHref, runsHref } from "@/libs/routing/routes";
import { AbsoluteTime } from "@/libs/ui/composites/absolute-time";
import { type Period, periodPhrase } from "@/operations/run-periods";
import { PhaseStatus } from "@/features/run-status";
import { ResumeButton } from "./resume-button";
import { SectionHead } from "./section-head";

const SHOWN = 5;

const numbers = new Intl.NumberFormat("en-US");

const ROW =
  "relative flex min-h-12 flex-wrap items-start gap-x-4 gap-y-1 px-4 py-2.5 transition-colors duration-(--duration-fast) hover:bg-muted";

const STRETCHED =
  "font-medium underline-offset-4 after:absolute after:inset-0 hover:underline";

interface NeedsAttentionProps {
  readonly period: Period;
  readonly failed: number;
  readonly failing: FailingWorkflows;
  readonly paused: readonly ListedInstance[];
  readonly failedHref: string;
  readonly operator: boolean;
}

export function NeedsAttention({
  period,
  failed,
  failing,
  paused,
  failedHref,
  operator,
}: NeedsAttentionProps) {
  const failedText = numbers.format(failed);
  const more = { href: failedHref, label: `All ${failedText} failed runs` };
  const phrase = periodPhrase(period);
  const calm = failing.items.length === 0 && paused.length === 0;
  const shown = failing.items.slice(0, SHOWN);
  const rest = failing.items.slice(SHOWN);
  const workflows = numbers.format(failing.workflows);
  const tally = `${workflows} workflows · ${failedText} failed runs, the same as the figure above.`;

  return (
    <section aria-labelledby="attention" className="flex flex-col gap-1.5">
      <div className="flex flex-col rounded-xl border bg-card">
        <SectionHead id="attention" title="Needs attention" more={more} />
        {calm ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            Nothing needs attention {phrase}.
          </p>
        ) : (
          <ul className="flex flex-col divide-y">
            {shown.map((workflow) => (
              <FailingRow
                key={`${workflow.namespace}/${workflow.name}`}
                workflow={workflow}
                period={period}
              />
            ))}
            {rest.length > 0 && (
              <RestRow rest={rest} period={period} failedHref={failedHref} />
            )}
            {paused.map((run) => (
              <PausedRow key={run.id} run={run} operator={operator} />
            ))}
          </ul>
        )}
      </div>
      {failing.workflows > 0 && (
        <p className="text-caption text-muted-foreground">{tally}</p>
      )}
    </section>
  );
}

function failedHrefOf(workflow: FailingWorkflow, period: Period): string {
  return runsHref({
    namespace: workflow.namespace,
    name: workflow.name,
    status: "failed",
    started: period,
  });
}

function FailingRow({
  workflow,
  period,
}: {
  readonly workflow: FailingWorkflow;
  readonly period: Period;
}) {
  const href = failedHrefOf(workflow, period);
  const title = workflow.title ?? workflow.name;
  const share = `${numbers.format(workflow.failed)} of ${numbers.format(workflow.runs)} runs failed`;
  const state = workflow.stillFailing ? "still failing" : "last run succeeded";
  const tone = workflow.stillFailing
    ? "text-destructive"
    : "text-muted-foreground";
  const why = whyOf(workflow);

  return (
    <li className={ROW}>
      <PhaseStatus phase="faulted" className="shrink-0 sm:w-28" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
        <span>
          <Link href={href} className={STRETCHED}>
            {title}
            <span className="sr-only">: see its failed runs</span>
          </Link>
          <span className="text-muted-foreground">
            {" "}
            · {share} · since <AbsoluteTime value={workflow.firstFailedAt} /> ·
            last <AbsoluteTime value={workflow.lastFailedAt} /> ·{" "}
          </span>
          <span className={tone}>{state}</span>
        </span>
        {why !== null && (
          <span className="truncate text-muted-foreground">{why}</span>
        )}
      </span>
      <ChevronRightIcon
        className="size-4 self-center text-muted-foreground"
        aria-hidden
      />
    </li>
  );
}

function RestRow({
  rest,
  period,
  failedHref,
}: {
  readonly rest: readonly FailingWorkflow[];
  readonly period: Period;
  readonly failedHref: string;
}) {
  const count = rest.length;
  const noun = count === 1 ? "workflow" : "workflows";
  const lead = `+ ${String(count)} more ${noun} failed: `;

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
      <span className="min-w-0 flex-1 text-muted-foreground">
        {lead}
        {rest.map((workflow, index) => (
          <span key={`${workflow.namespace}/${workflow.name}`}>
            {index > 0 && ", "}
            <Link
              href={failedHrefOf(workflow, period)}
              className="text-accent-text underline-offset-4 hover:underline"
            >
              {workflow.title ?? workflow.name}
            </Link>{" "}
            ({numbers.format(workflow.failed)})
          </span>
        ))}
      </span>
      <Link
        href={failedHref}
        className="text-caption text-accent-text underline-offset-4 hover:underline"
      >
        Show all failed runs
      </Link>
    </li>
  );
}

function PausedRow({
  run,
  operator,
}: {
  readonly run: ListedInstance;
  readonly operator: boolean;
}) {
  const href = runHref(run.id);
  const title = run.title ?? run.name;
  const by = run.startedBy?.name;

  return (
    <li className={ROW}>
      <PhaseStatus phase={run.phase} className="shrink-0 sm:w-28" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
        <span>
          <Link href={href} className={STRETCHED}>
            {title}
          </Link>
          <span className="text-muted-foreground">
            {" "}
            · 1 run paused · started <AbsoluteTime value={run.startedAt} />
            {by !== undefined && ` by ${by}`}
          </span>
        </span>
        <span className="text-muted-foreground">
          Paused runs wait for a person; nothing happens until it is resumed or
          cancelled.
        </span>
      </span>
      {operator && <ResumeButton id={run.id} />}
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
