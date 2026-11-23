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
import { Time } from "@/libs/ui/composites/time";
import { scheduleText } from "@/operations/schedule-words";
import { SectionHead } from "./section-head";

const more = { href: WORKFLOWS_HREF, label: "All workflows" };

export function AutomaticStarts({
  expected,
}: {
  readonly expected: readonly ExpectedStarts[];
}) {
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
                <TableHead>Next start</TableHead>
                <TableHead>Missed starts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expected.map((workflow) => (
                <StartRow
                  key={`${workflow.namespace}/${workflow.name}`}
                  workflow={workflow}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

function StartRow({ workflow }: { readonly workflow: ExpectedStarts }) {
  const href = workflowHref(workflow.namespace, workflow.name);
  const starts =
    workflow.schedule === null ? "—" : scheduleText(workflow.schedule);
  const next = workflow.next[0] ?? null;

  return (
    <TableRow>
      <TableCell className="pl-4">
        <Link
          href={href}
          className="font-medium underline-offset-4 hover:underline"
        >
          {workflow.name}
        </Link>
        <span className="block text-xs text-muted-foreground">
          {workflow.namespace}
        </span>
      </TableCell>
      <TableCell>{starts}</TableCell>
      <TableCell>
        <Time value={next} />
      </TableCell>
      <TableCell>
        {workflow.missed === 0 ? (
          <span className="text-muted-foreground">none</span>
        ) : (
          <span className="text-warning">
            {workflow.missed} missed since <Time value={workflow.missedSince} />
          </span>
        )}
      </TableCell>
    </TableRow>
  );
}
