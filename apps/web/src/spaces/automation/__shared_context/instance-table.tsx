import Link from 'next/link';
import type { InstanceSummary } from '@/libs/data-access/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/libs/ui/components/table';
import { Duration, Time } from '@/libs/ui/composites/time';
import { instanceHref } from './links';
import { PhaseStatus, triggerLabel } from './vocabulary';

interface InstanceTableProps {
  readonly instances: readonly InstanceSummary[];
  // Whether each row names its workflow; a workflow's own page leaves it out.
  readonly showWorkflow?: boolean;
}

// Runs as rows: phase, what started them, when, and for how long; a row opens its run.
export function InstanceTable({
  instances,
  showWorkflow = true,
}: InstanceTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Phase</TableHead>
            {showWorkflow && <TableHead>Workflow</TableHead>}
            <TableHead>Version</TableHead>
            <TableHead>Started by</TableHead>
            <TableHead>Started</TableHead>
            <TableHead className="text-right">Duration</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {instances.map((instance) => (
            <TableRow key={instance.id} className="relative">
              <TableCell>
                <Link
                  href={instanceHref(instance.id)}
                  className="after:absolute after:inset-0"
                  aria-label={`Run ${instance.id}`}
                >
                  <PhaseStatus phase={instance.phase} />
                </Link>
              </TableCell>
              {showWorkflow && (
                <TableCell>
                  <span className="font-medium">{instance.name}</span>
                  <span className="text-muted-foreground">
                    {' '}
                    in {instance.namespace}
                  </span>
                </TableCell>
              )}
              <TableCell className="tabular-nums">{instance.version}</TableCell>
              <TableCell>{triggerLabel(instance.trigger)}</TableCell>
              <TableCell>
                <Time value={instance.startedAt ?? instance.createdAt} />
              </TableCell>
              <TableCell className="text-right">
                <Duration from={instance.startedAt} to={instance.endedAt} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
