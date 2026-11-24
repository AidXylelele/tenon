import { ArrowDownIcon, ArrowUpDownIcon } from "lucide-react";
import type { InstanceOrder, ListedInstance } from "@/libs/data-access/types";
import { Link } from "@/libs/routing/link";
import { runHref } from "@/libs/routing/routes";
import { Badge } from "@/libs/ui/components/badge";
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
import { AbsoluteTime } from "@/libs/ui/composites/absolute-time";
import { Duration } from "@/libs/ui/composites/time";
import { phaseLabel, triggerLabel } from "@/operations/run-progress";
import type { RunOrder, RunTableProps } from "./interfaces";

export function RunTable({
  runs,
  Status,
  showWorkflow = true,
  order,
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
            <SortableHead sort="started" label="Started" order={order} />
            <SortableHead
              sort="duration"
              label="Duration"
              order={order}
              className="hidden text-right sm:table-cell"
            />
            <TableHead className="hidden md:table-cell">Started by</TableHead>
            <TableHead className="hidden text-right md:table-cell">
              Version
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => (
            <RunRow
              key={run.id}
              run={run}
              Status={Status}
              showWorkflow={showWorkflow}
            />
          ))}
        </TableBody>
      </Table>
    </TableFrame>
  );
}

function RunRow({
  run,
  Status,
  showWorkflow,
}: {
  readonly run: ListedInstance;
  readonly Status: RunTableProps["Status"];
  readonly showWorkflow: boolean;
}) {
  const phase = phaseLabel(run.phase);
  const started = run.startedAt ?? run.createdAt;
  const startedText = utcText(started);
  const title = run.title ?? run.name;
  const named = `${run.namespace}/${run.name}`;
  const name = `, open the ${phase} run of ${title} started ${startedText}`;
  const href = runHref(run.id);
  const starter = run.startedBy?.name ?? triggerLabel(run.trigger);

  return (
    <TableRow className="relative">
      <TableCell>
        <span className="flex items-center gap-2">
          <Status phase={run.phase} />
          {run.test && (
            <Badge
              variant="outline"
              title="A test run of the draft; not counted in the period"
            >
              Test
            </Badge>
          )}
        </span>
      </TableCell>
      {showWorkflow && (
        <TableCell>
          <span className="block font-medium">{title}</span>
          <span className="block font-mono text-xs text-muted-foreground">
            {named}
          </span>
        </TableCell>
      )}
      <TableCell>
        <Link href={href} className="after:absolute after:inset-0">
          <AbsoluteTime value={started} seconds />
          <span className="sr-only">{name}</span>
        </Link>
      </TableCell>
      <TableCell className="hidden text-right sm:table-cell">
        <Duration from={run.startedAt} to={run.endedAt} />
      </TableCell>
      <TableCell className="hidden md:table-cell">{starter}</TableCell>
      <TableCell className="hidden text-right tabular-nums text-muted-foreground md:table-cell">
        {run.version}
      </TableCell>
    </TableRow>
  );
}

function SortableHead({
  sort,
  label,
  order,
  className,
}: {
  readonly sort: InstanceOrder;
  readonly label: string;
  readonly order: RunOrder | undefined;
  readonly className?: string;
}) {
  if (order === undefined)
    return <TableHead className={className}>{label}</TableHead>;

  const active = order.sort === sort;
  const href = order.hrefOf(sort);
  const Icon = active ? ArrowDownIcon : ArrowUpDownIcon;
  const sorted = active ? "descending" : "none";

  return (
    <TableHead className={className} aria-sort={sorted}>
      <Link
        href={href}
        className="relative z-10 inline-flex items-center gap-1 underline-offset-4 hover:underline"
      >
        {label}
        <Icon className="size-3.5" aria-hidden />
      </Link>
    </TableHead>
  );
}
