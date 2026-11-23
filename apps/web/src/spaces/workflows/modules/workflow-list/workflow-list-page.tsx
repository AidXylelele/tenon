import { ArchiveIcon, PlusIcon, SearchIcon, WorkflowIcon } from "lucide-react";
import type { Workflow, WorkflowStatus } from "@/libs/data-access/types";
import { Link } from "@/libs/routing/link";
import {
  NEW_WORKFLOW_HREF,
  WORKFLOWS_HREF,
  workflowHref,
  workflowsHref,
} from "@/libs/routing/routes";
import { Badge } from "@/libs/ui/components/badge";
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
import { workflowStartOf } from "../../__shared_context/workflow-start";

export interface WorkflowListPageProps {
  readonly status: WorkflowStatus;
  readonly q: string | undefined;
  readonly workflows: readonly Workflow[];
  readonly author: boolean;
  readonly firstPage: string | null;
  readonly nextPage: string | null;
}

const PURPOSE = "Every workflow, how it starts and how its last run went.";

const FIRST_WORKFLOW =
  "A workflow is a list of steps — call a service, run a script, wait, decide — that Tenon runs for you by hand, on a schedule or when another app calls it.";

export function WorkflowListPage({
  status,
  q,
  workflows,
  author,
  firstPage,
  nextPage,
}: WorkflowListPageProps) {
  const none = workflows.length === 0;
  const first = none && status === "active" && q === undefined;
  const creates = author && !first;
  const archivedHref = workflowsHref({ status: "archived" });
  const tabs = [
    { href: WORKFLOWS_HREF, label: "Active", current: status === "active" },
    { href: archivedHref, label: "Archived", current: status === "archived" },
  ];
  const cleared = status === "active" ? WORKFLOWS_HREF : archivedHref;

  return (
    <>
      <PageHeader
        title="Workflows"
        description={first ? "No workflows yet" : PURPOSE}
        actions={creates ? <NewWorkflow /> : undefined}
      />
      {first ? (
        <FirstWorkflow author={author} />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <RouteTabs tabs={tabs} label="Workflow status" />
            <form
              action={WORKFLOWS_HREF}
              role="search"
              className="w-full sm:w-72"
            >
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
                  aria-label="Find a workflow by namespace or name"
                />
              </InputGroup>
            </form>
          </div>
          {none ? (
            <NoWorkflow status={status} q={q} cleared={cleared} />
          ) : (
            <WorkflowTable workflows={workflows} />
          )}
          <nav aria-label="Pages" className="flex justify-end gap-2">
            {firstPage !== null && (
              <Button variant="outline" asChild>
                <Link href={firstPage}>First page</Link>
              </Button>
            )}
            {nextPage !== null && (
              <Button variant="outline" asChild>
                <Link href={nextPage}>Next page</Link>
              </Button>
            )}
          </nav>
        </>
      )}
    </>
  );
}

function NewWorkflow() {
  return (
    <Button asChild>
      <Link href={NEW_WORKFLOW_HREF}>
        <PlusIcon data-icon="inline-start" />
        New workflow
      </Link>
    </Button>
  );
}

function FirstWorkflow({ author }: { readonly author: boolean }) {
  const action = author ? (
    <Button size="lg" asChild>
      <Link href={NEW_WORKFLOW_HREF}>
        <PlusIcon data-icon="inline-start" />
        Create your first workflow
      </Link>
    </Button>
  ) : undefined;
  const description = author
    ? FIRST_WORKFLOW
    : `${FIRST_WORKFLOW} They show here once an editor publishes one.`;

  return (
    <EmptyState
      icon={<WorkflowIcon />}
      title="Build your first workflow"
      description={description}
      action={action}
    />
  );
}

function NoWorkflow({
  status,
  q,
  cleared,
}: {
  readonly status: WorkflowStatus;
  readonly q: string | undefined;
  readonly cleared: string;
}) {
  if (q !== undefined)
    return (
      <EmptyState
        icon={<SearchIcon />}
        title="No workflow matches"
        description={`No ${status} workflow is named like “${q}”.`}
        action={
          <Button variant="outline" asChild>
            <Link href={cleared}>Clear the search</Link>
          </Button>
        }
      />
    );

  return (
    <EmptyState
      icon={<ArchiveIcon />}
      title="No archived workflows"
      description="Archived workflows keep their versions and runs, and start nothing new."
    />
  );
}

function WorkflowTable({
  workflows,
}: {
  readonly workflows: readonly Workflow[];
}) {
  return (
    <TableFrame>
      <div role="region" aria-label="Workflows" tabIndex={0}>
        <Table className="min-w-[44rem] table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30%]">Workflow</TableHead>
              <TableHead className="w-[30%]">Starts</TableHead>
              <TableHead className="w-[12%] text-right">Runs</TableHead>
              <TableHead className="w-[18%]">Last run</TableHead>
              <TableHead className="w-[10%] text-right">Version</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workflows.map((workflow) => (
              <WorkflowRow
                key={`${workflow.namespace}/${workflow.name}`}
                workflow={workflow}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </TableFrame>
  );
}

function WorkflowRow({ workflow }: { readonly workflow: Workflow }) {
  const href = workflowHref(workflow.namespace, workflow.name);
  const start = workflowStartOf(workflow.schedule);
  const StartIcon = start.icon;
  const lastRun = workflow.lastRun;
  const version = workflow.currentVersion;
  const archived = workflow.status === "archived";

  return (
    <TableRow className="relative">
      <TableCell className="truncate">
        <Link
          href={href}
          className="font-semibold after:absolute after:inset-0 hover:underline"
        >
          {workflow.name}
        </Link>
        <span className="block truncate font-mono text-caption text-muted-foreground">
          {workflow.namespace}/{workflow.name}
        </span>
      </TableCell>
      <TableCell>
        <span className="flex flex-wrap items-center gap-1.5">
          <StartIcon className="size-4 text-muted-foreground" aria-hidden />
          <span className="min-w-0">{start.words}</span>
          {archived ? (
            <Badge variant="secondary">Archived</Badge>
          ) : (
            start.automatic && <OnOff on={workflow.on} />
          )}
        </span>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {workflow.starts}
      </TableCell>
      <TableCell>
        {lastRun === null ? (
          <span className="text-muted-foreground">Never run</span>
        ) : (
          <span className="flex flex-col">
            <PhaseStatus phase={lastRun.phase} />
            <span className="text-caption text-muted-foreground">
              <Time value={lastRun.createdAt} />
            </span>
          </span>
        )}
      </TableCell>
      <TableCell className="text-right">
        {version === null ? (
          <Badge variant="secondary">Draft</Badge>
        ) : (
          <span className="tabular-nums text-muted-foreground">{version}</span>
        )}
      </TableCell>
    </TableRow>
  );
}

function OnOff({ on }: { readonly on: boolean }) {
  return on ? (
    <Badge variant="success">On</Badge>
  ) : (
    <Badge variant="secondary">Off</Badge>
  );
}
