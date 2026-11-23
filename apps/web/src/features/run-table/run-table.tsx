import type { InstanceSummary, Phase } from "@/libs/data-access/types";
import { Link } from "@/libs/routing/link";
import { runHref } from "@/libs/routing/routes";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/libs/ui/components/table";
import { utcText } from "@/libs/ui/composites/format";
import { TableFrame } from "@/libs/ui/composites/table-frame";
import { Duration, Time } from "@/libs/ui/composites/time";
import { phaseLabel, triggerLabel } from "@/operations/run-progress";

interface RunTableProps {
  readonly runs: readonly InstanceSummary[];
  readonly Status: React.ComponentType<{ readonly phase: Phase }>;
  readonly showWorkflow?: boolean;
  readonly empty: React.ReactNode;
}

export function RunTable({
  runs,
  Status,
  showWorkflow = true,
  empty,
}: RunTableProps) {
  if (runs.length === 0) return empty;

  return (
    <TableFrame>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            {showWorkflow && <TableHead>Workflow</TableHead>}
            <TableHead className="hidden md:table-cell">Version</TableHead>
            <TableHead className="hidden md:table-cell">Started by</TableHead>
            <TableHead>Started</TableHead>
            <TableHead className="hidden text-right sm:table-cell">
              Duration
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => {
            const phase = phaseLabel(run.phase);
            const started = run.startedAt ?? run.createdAt;
            const startedText = utcText(started);
            const name = `${phase} run of ${run.name}, started ${startedText}`;
            const href = runHref(run.id);

            return (
              <TableRow key={run.id} className="relative">
                <TableCell>
                  <Link
                    href={href}
                    className="after:absolute after:inset-0"
                    aria-label={name}
                  >
                    <Status phase={run.phase} />
                  </Link>
                </TableCell>
                {showWorkflow && (
                  <TableCell>
                    <span className="block font-medium">{run.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {run.namespace}
                    </span>
                  </TableCell>
                )}
                <TableCell className="hidden tabular-nums md:table-cell">
                  {run.version}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {triggerLabel(run.trigger)}
                </TableCell>
                <TableCell>
                  <Time value={started} />
                </TableCell>
                <TableCell className="hidden text-right sm:table-cell">
                  <Duration from={run.startedAt} to={run.endedAt} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableFrame>
  );
}
