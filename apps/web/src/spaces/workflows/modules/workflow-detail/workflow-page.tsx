import { ArchiveIcon, PencilIcon, WorkflowIcon } from "lucide-react";
import type {
  InstanceSummary,
  Page,
  Read,
  Version,
  VersionStructure,
  Workflow,
} from "@/libs/data-access/types";
import { RefreshControl } from "@/libs/live/refresh-control";
import { Link } from "@/libs/routing/link";
import {
  editorHref,
  runsHref,
  versionHref,
  workflowHref,
} from "@/libs/routing/routes";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/libs/ui/components/alert";
import { Badge } from "@/libs/ui/components/badge";
import { Button } from "@/libs/ui/components/button";
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
import { isUnended } from "@/operations/run-progress";
import { PhaseStatus } from "@/features/run-status";
import { RunTable } from "@/features/run-table";
import { ViewerLine } from "@/features/viewer-notice";
import { WorkflowFlow } from "@/features/workflow-flow";
import { StartDialog } from "../../__shared_context/start-dialog";
import { workflowStartOf } from "../../__shared_context/workflow-start";
import { AutomaticStarts } from "./automatic-starts";
import type { YamlFile } from "../../__shared_context/yaml-file";
import { WorkflowMenu } from "./workflow-menu";

export type WorkflowTab = "overview" | "runs" | "versions";

export interface WorkflowPageProps {
  readonly workflow: Workflow;
  readonly tab: WorkflowTab;
  readonly versions: readonly Version[];
  readonly runs: Read<Page<InstanceSummary>>;
  readonly structure: VersionStructure | null;
  readonly yaml: YamlFile | null;
  readonly author: boolean;
  readonly operator: boolean;
  readonly starting: boolean;
}

const READ = { kind: "read" } as const;

export function WorkflowPage({
  workflow,
  tab,
  versions,
  runs,
  structure,
  yaml,
  author,
  operator,
  starting,
}: WorkflowPageProps) {
  const namespace = workflow.namespace;
  const name = workflow.name;
  const current = workflow.currentVersion;
  const archived = workflow.status === "archived";
  const edits = author && !archived;
  const runsIt = operator && !archived && current !== null;
  const start = workflowStartOf(workflow.schedule);
  const title = structure?.title ?? name;
  const published = versions.find((version) => version.current);
  const versionNames = versions.map((version) => version.version);
  const versionCount = String(versions.length);
  const inputSchema = structure?.input.schema ?? null;
  const overview = workflowHref(namespace, name);
  const runsTab = workflowHref(namespace, name, { tab: "runs" });
  const versionsTab = workflowHref(namespace, name, { tab: "versions" });
  const editor = editorHref(namespace, name);
  const allRuns = runsHref({ namespace, name });
  const viewer = !author && !operator;
  const tabs = [
    {
      href: overview,
      label: "Overview",
      current: tab === "overview",
    },
    {
      href: runsTab,
      label: "Runs",
      current: tab === "runs",
    },
    {
      href: versionsTab,
      label: (
        <>
          Versions
          <span className="text-muted-foreground tabular-nums">
            {versionCount}
          </span>
        </>
      ),
      current: tab === "versions",
    },
  ];

  return (
    <>
      <PageHeader
        title={title}
        description={
          <span className="flex flex-wrap gap-x-1">
            <span className="font-mono">
              {namespace}/{name}
            </span>
            <span>· {start.words}</span>
            <span>
              ·{" "}
              {published === undefined ? (
                "not published yet"
              ) : (
                <>
                  version {published.version}, published by{" "}
                  {published.publishedBy.name}{" "}
                  <Time value={published.publishedAt} />
                </>
              )}
            </span>
          </span>
        }
        actions={
          <>
            {viewer && <ViewerLine />}
            {edits && (
              <Button variant="outline" asChild>
                <Link href={editor}>
                  <PencilIcon data-icon="inline-start" />
                  Edit
                </Link>
              </Button>
            )}
            {runsIt && (
              <StartDialog
                namespace={namespace}
                name={name}
                title={title}
                versions={versionNames}
                currentVersion={current}
                inputSchema={inputSchema}
                defaultOpen={starting}
              />
            )}
            {(edits || yaml !== null) && (
              <WorkflowMenu
                namespace={namespace}
                name={name}
                on={workflow.on}
                automatic={start.automatic}
                author={edits}
                yaml={yaml}
              />
            )}
          </>
        }
      />
      {archived ? (
        <Alert>
          <ArchiveIcon />
          <AlertTitle>Archived</AlertTitle>
          <AlertDescription>
            It starts no run and takes no version. Its versions and runs stay
            readable.
          </AlertDescription>
        </Alert>
      ) : (
        start.automatic && (
          <AutomaticStarts
            namespace={namespace}
            name={name}
            on={workflow.on}
            disabled={!edits}
          />
        )
      )}
      <RouteTabs tabs={tabs} label="Workflow" />
      {tab === "overview" && (
        <Overview
          workflow={workflow}
          runs={runs}
          structure={structure}
          edits={edits}
        />
      )}
      {tab === "runs" && (
        <Runs
          runs={runs}
          title="Runs"
          more={allRuns}
          moreLabel="Find runs of this workflow"
        />
      )}
      {tab === "versions" && <Versions versions={versions} />}
    </>
  );
}

function Overview({
  workflow,
  runs,
  structure,
  edits,
}: {
  readonly workflow: Workflow;
  readonly runs: Read<Page<InstanceSummary>>;
  readonly structure: VersionStructure | null;
  readonly edits: boolean;
}) {
  const namespace = workflow.namespace;
  const name = workflow.name;
  const current = workflow.currentVersion;
  const editor = editorHref(namespace, name);
  const runsTab = workflowHref(namespace, name, { tab: "runs" });

  if (current === null || structure === null)
    return (
      <EmptyState
        icon={<WorkflowIcon />}
        title="Nothing is published yet"
        description="Runs use the current version. Publish the draft in the editor to run this workflow."
        action={
          edits ? (
            <Button variant="outline" asChild>
              <Link href={editor}>
                <PencilIcon data-icon="inline-start" />
                Open the editor
              </Link>
            </Button>
          ) : undefined
        }
      />
    );

  const version = versionHref(namespace, name, current);
  const opensVersion = `Open version ${current}`;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <Runs
        runs={runs}
        title="Recent runs"
        more={runsTab}
        moreLabel="All runs of this workflow"
      />
      <section aria-labelledby="what-it-does" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="what-it-does" className="text-body font-semibold">
            What it does
          </h2>
          <Button variant="link" size="sm" asChild>
            <Link href={version}>{opensVersion}</Link>
          </Button>
        </div>
        <div className="h-[28rem] overflow-hidden rounded-lg border bg-canvas">
          <WorkflowFlow workflow={structure} mode={READ} />
        </div>
      </section>
    </div>
  );
}

function Runs({
  runs,
  title,
  more,
  moreLabel,
}: {
  readonly runs: Read<Page<InstanceSummary>>;
  readonly title: string;
  readonly more: string;
  readonly moreLabel: string;
}) {
  const live = runs.items.some((instance) => isUnended(instance.phase));
  const activity = live ? "in-flight" : "open";

  return (
    <section aria-labelledby="workflow-runs" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="workflow-runs" className="text-body font-semibold">
          {title}
        </h2>
        <div className="flex items-center gap-3">
          <RefreshControl activity={activity} renderedAt={runs.readAt} />
          <Button variant="link" size="sm" asChild>
            <Link href={more}>{moreLabel}</Link>
          </Button>
        </div>
      </div>
      <RunTable
        runs={runs.items}
        Status={PhaseStatus}
        showWorkflow={false}
        empty={
          <EmptyState
            title="No runs yet"
            description="Each run shows here with its status as soon as it starts."
          />
        }
      />
    </section>
  );
}

function Versions({ versions }: { readonly versions: readonly Version[] }) {
  if (versions.length === 0)
    return (
      <EmptyState
        title="No versions yet"
        description="Each publish from the editor adds a version; runs use the current one."
      />
    );

  return (
    <TableFrame>
      <div role="region" aria-label="Versions" tabIndex={0}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Version</TableHead>
              <TableHead>Published</TableHead>
              <TableHead>By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {versions.map((version) => (
              <VersionRow key={version.version} version={version} />
            ))}
          </TableBody>
        </Table>
      </div>
    </TableFrame>
  );
}

function VersionRow({ version }: { readonly version: Version }) {
  const href = versionHref(version.namespace, version.name, version.version);

  return (
    <TableRow className="relative">
      <TableCell>
        <span className="flex items-center gap-2">
          <Link
            href={href}
            className="font-semibold tabular-nums after:absolute after:inset-0 hover:underline"
          >
            {version.version}
          </Link>
          {version.current && <Badge>Current</Badge>}
        </span>
      </TableCell>
      <TableCell>
        <Time value={version.publishedAt} />
      </TableCell>
      <TableCell>{version.publishedBy.name}</TableCell>
    </TableRow>
  );
}
