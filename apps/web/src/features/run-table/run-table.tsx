import { Link } from '@/libs/routing/link';
import type { InstanceSummary } from '@/libs/data-access/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/libs/ui/components/table';
import { Status } from '@/libs/ui/composites/status';
import { Duration, Time } from '@/libs/ui/composites/time';
import { instanceHref } from '@/operations/app-routes';
import { phaseStatusOf, triggerLabel } from '@/operations/run-progress';

interface RunTableProps {
  readonly runs: readonly InstanceSummary[];
  // Whether each row names its workflow; a workflow's own page leaves it out.
  readonly showWorkflow?: boolean;
  // What the page shows instead of a table without rows.
  readonly empty: React.ReactNode;
}

// Runs as rows: phase, what started them, when, and for how long; a row opens its run.
export function RunTable({ runs, showWorkflow = true, empty }: RunTableProps) {
  if (runs.length === 0) return empty;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Phase</TableHead>
            {showWorkflow && <TableHead>Workflow</TableHead>}
            <TableHead className="hidden md:table-cell">Version</TableHead>
            <TableHead className="hidden sm:table-cell">Started by</TableHead>
            <TableHead>Started</TableHead>
            <TableHead className="text-right">Duration</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => (
            <TableRow key={run.id} className="relative">
              <TableCell>
                <Link
                  href={instanceHref(run.id)}
                  className="after:absolute after:inset-0"
                  aria-label={`Run ${run.id}`}
                >
                  <Status {...phaseStatusOf(run.phase)} />
                </Link>
              </TableCell>
              {showWorkflow && (
                <TableCell>
                  <span className="font-medium">{run.name}</span>
                  <span className="text-muted-foreground">
                    {' '}
                    in {run.namespace}
                  </span>
                </TableCell>
              )}
              <TableCell className="hidden tabular-nums md:table-cell">
                {run.version}
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                {triggerLabel(run.trigger)}
              </TableCell>
              <TableCell>
                <Time value={run.startedAt ?? run.createdAt} />
              </TableCell>
              <TableCell className="text-right">
                <Duration from={run.startedAt} to={run.endedAt} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
