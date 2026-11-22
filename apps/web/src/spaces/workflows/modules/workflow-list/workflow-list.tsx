import { ArchiveIcon, PlusIcon, SearchIcon, WaypointsIcon } from "lucide-react";
import { workflows } from "@/libs/data-access/automation";
import { available, UNAVAILABLE } from "@/libs/data-access/http";
import { currentSession } from "@/libs/data-access/identity";
import type { Workflow, WorkflowStatus } from "@/libs/data-access/types";
import { Link } from "@/libs/routing/link";
import {
  NEW_WORKFLOW_HREF,
  runHref,
  workflowHref,
  WORKFLOWS_HREF,
  workflowsHref,
} from "@/libs/routing/routes";
import type { Query } from "@/libs/routing/segment";
import { Button } from "@/libs/ui/components/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/libs/ui/components/input-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/libs/ui/components/table";
import { EmptyState } from "@/libs/ui/composites/empty-state";
import { PageHeader } from "@/libs/ui/composites/page-header";
import { RouteTabs } from "@/libs/ui/composites/route-tabs";
import { TableFrame } from "@/libs/ui/composites/table-frame";
import { Time } from "@/libs/ui/composites/time";
import { PhaseStatus } from "@/features/run-status";
import { Unavailable } from "@/libs/ui/composites/unavailable";
import { scheduleText } from "@/operations/schedule-words";
import { WorkflowListQuery } from "./query";

export async function WorkflowList({ query }: { readonly query: Query }) {
  const address = WorkflowListQuery.parse(query);
  const status = address.status;
  const cursor = address.cursor;
  const q = address.q;
  const read = await available(
    Promise.all([currentSession(), workflows(status, cursor, q)]),
  );

  if (read === UNAVAILABLE) return <Unavailable />;

  const [session, page] = read;
  const author = session?.capabilities.author === true;
  const tabs = [
    { href: WORKFLOWS_HREF, label: "Active", current: status === "active" },
    {
      href: workflowsHref({ status: "archived" }),
      label: "Archived",
      current: status === "archived",
    },
  ];
  const next =
    page.next === null ? null : workflowsHref({ status, cursor: page.next, q });

  return (
    <>
      <PageHeader
        title="Workflows"
        description="Each publish adds a version; runs use the current one."
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RouteTabs tabs={tabs} label="Workflow status" />
        <form action={WORKFLOWS_HREF} role="search" className="w-full sm:w-72">
          {status === "archived" && (
            <input type="hidden" name="status" value={status} />
          )}
          <InputGroup>
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Find by namespace or name"
              aria-label="Find a workflow"
            />
          </InputGroup>
        </form>
      </div>
      {page.items.length === 0 && q !== undefined ? (
        <EmptyState
          icon={<SearchIcon />}
          title="No workflow matches"
          description={`Nothing named like “${q}”.`}
        />
      ) : page.items.length === 0 ? (
        <NoWorkflows status={status} author={author} />
      ) : (
        <TableFrame>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workflow</TableHead>
                <TableHead>Starts</TableHead>
                <TableHead className="hidden md:table-cell">Runs</TableHead>
                <TableHead className="hidden md:table-cell">Last run</TableHead>
                <TableHead className="hidden sm:table-cell">Version</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.items.map((workflow) => (
                <WorkflowRow
                  key={`${workflow.namespace}/${workflow.name}`}
                  workflow={workflow}
                />
              ))}
            </TableBody>
          </Table>
        </TableFrame>
      )}
      <div className="flex justify-end gap-2">
        {cursor !== undefined && (
          <Button variant="outline" asChild>
            <Link href={workflowsHref({ status, q })}>First page</Link>
          </Button>
        )}
        {next !== null && (
          <Button variant="outline" asChild>
            <Link href={next}>Next page</Link>
          </Button>
        )}
      </div>
    </>
  );
}

function WorkflowRow({ workflow }: { readonly workflow: Workflow }) {
  const href = workflowHref(workflow.namespace, workflow.name);
  const schedule = workflow.schedule;
  const lastRun = workflow.lastRun;
  const starts =
    schedule === null
      ? "By hand"
      : `${scheduleText(schedule)}${workflow.on ? "" : " (off)"}`;

  return (
    <TableRow className="relative">
      <TableCell>
        <Link
          href={href}
          className="font-medium after:absolute after:inset-0 hover:underline"
        >
          {workflow.name}
        </Link>
        <span className="block text-xs text-muted-foreground">
          {workflow.namespace}
        </span>
      </TableCell>
      <TableCell>
        {workflow.status === "archived" ? (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <ArchiveIcon className="size-4" aria-hidden />
            Archived
          </span>
        ) : (
          <span className="text-sm">{starts}</span>
        )}
      </TableCell>
      <TableCell className="hidden tabular-nums md:table-cell">
        {workflow.starts}
      </TableCell>
      <TableCell className="hidden md:table-cell">
        {lastRun === null ? (
          <span className="text-muted-foreground">None yet</span>
        ) : (
          <span className="relative z-10 flex items-center gap-2">
            <Link href={runHref(lastRun.id)} className="hover:underline">
              <PhaseStatus phase={lastRun.phase} />
            </Link>
            <span className="text-xs text-muted-foreground">
              <Time value={lastRun.createdAt} />
            </span>
          </span>
        )}
      </TableCell>
      <TableCell className="hidden tabular-nums sm:table-cell">
        {workflow.currentVersion ?? "—"}
      </TableCell>
    </TableRow>
  );
}

function NoWorkflows({
  status,
  author,
}: {
  readonly status: WorkflowStatus;
  readonly author: boolean;
}) {
  if (status === "archived")
    return (
      <EmptyState
        icon={<ArchiveIcon />}
        title="Nothing archived"
        description="Archived workflows keep their versions and runs, and start nothing new."
      />
    );

  const action = author ? (
    <Button asChild>
      <Link href={NEW_WORKFLOW_HREF}>
        <PlusIcon data-icon="inline-start" />
        New workflow
      </Link>
    </Button>
  ) : undefined;

  const description = author
    ? "Build one from tasks on a canvas, or paste a document."
    : "Workflows show here once an editor publishes one.";

  return (
    <EmptyState
      icon={<WaypointsIcon />}
      title="No workflows yet"
      description={description}
      action={action}
    />
  );
}
