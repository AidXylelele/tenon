import type { ExpectedStarts } from "@/libs/data-access/types";
import { Link } from "@/libs/routing/link";
import { workflowHref, WORKFLOWS_HREF } from "@/libs/routing/routes";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/libs/ui/components/table";
import { AbsoluteTime } from "@/libs/ui/composites/absolute-time";
import { scheduleText } from "@/operations/schedule-words";
import { AutomaticStarts } from "@/features/automatic-starts";
import { PhaseStatus } from "@/features/run-status";
import { turnAction } from "./actions";
import { SectionHead } from "./section-head";

const more = { href: WORKFLOWS_HREF, label: "All workflows" };

interface StartsProps {
  readonly expected: readonly ExpectedStarts[];
  readonly zone: string;
  readonly author: boolean;
}

export function StartsAutomatically({ expected, zone, author }: StartsProps) {
  return (
    <section
      aria-labelledby="automatic"
      className="flex flex-col rounded-xl border bg-card"
    >
      <SectionHead id="automatic" title="Starts automatically" more={more} />
      {expected.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          No workflow starts by itself. Give one a schedule, publish it, and
          turn on its automatic starts.
        </p>
      ) : (
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="automatic"
          className="overflow-x-auto"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Workflow</TableHead>
                <TableHead>Starts (UTC)</TableHead>
                <TableHead>Last run</TableHead>
                <TableHead>Missed starts</TableHead>
                <TableHead>Automatic starts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expected.map((workflow) => (
                <StartRow
                  key={`${workflow.namespace}/${workflow.name}`}
                  workflow={workflow}
                  zone={zone}
                  author={author}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

function StartRow({
  workflow,
  zone,
  author,
}: {
  readonly workflow: ExpectedStarts;
  readonly zone: string;
  readonly author: boolean;
}) {
  const href = workflowHref(workflow.namespace, workflow.name);
  const title = workflow.title ?? workflow.name;
  const starts = startsOf(workflow, zone);
  const lastRun = workflow.lastRun;
  const turn = turnAction.bind(null, workflow.namespace, workflow.name);

  return (
    <TableRow>
      <TableCell className="pl-4">
        <Link
          href={href}
          className="font-medium underline-offset-4 hover:underline"
        >
          {title}
        </Link>
        <span className="block font-mono text-xs text-muted-foreground">
          {workflow.namespace}/{workflow.name}
        </span>
      </TableCell>
      <TableCell>
        <span className="whitespace-nowrap">{starts}</span>
      </TableCell>
      <TableCell>
        {lastRun === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="flex flex-wrap items-center gap-x-2">
            <PhaseStatus phase={lastRun.phase} />
            <span className="text-caption text-muted-foreground">
              <AbsoluteTime value={lastRun.createdAt} />
            </span>
          </span>
        )}
      </TableCell>
      <TableCell>
        {workflow.missed === 0 ? (
          <span className="text-muted-foreground">none</span>
        ) : (
          <span className="text-warning">
            {workflow.missed} missed since{" "}
            <AbsoluteTime value={workflow.missedSince} />
          </span>
        )}
      </TableCell>
      <TableCell>
        <AutomaticStarts workflow={title} on disabled={!author} turn={turn} />
      </TableCell>
    </TableRow>
  );
}

function startsOf(workflow: ExpectedStarts, zone: string): string {
  const schedule = workflow.schedule;

  if (schedule === null) return "—";

  const words = scheduleText(schedule);
  const next = workflow.next[0];

  if (schedule.kind !== "cron" || next === undefined || zone === "UTC")
    return words;

  const clock = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: zone,
  });
  const local = clock.format(Date.parse(next));
  return `${words} · ${local} your time`;
}
