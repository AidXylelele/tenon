import { ArchiveIcon, PencilIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  instances,
  versionStructure,
  versions as versionsOf,
  workflow as workflowOf,
} from "@/libs/data-access/automation";
import { available, UNAVAILABLE } from "@/libs/data-access/http";
import { currentSession } from "@/libs/data-access/identity";
import type { InstancePage, Read, Version } from "@/libs/data-access/types";
import { RefreshControl } from "@/libs/live/refresh-control";
import { Link } from "@/libs/routing/link";
import {
  editorHref,
  runsHref,
  versionHref,
  workflowHref,
} from "@/libs/routing/routes";
import { type Query, segment } from "@/libs/routing/segment";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/libs/ui/components/alert";
import { Badge } from "@/libs/ui/components/badge";
import { Button } from "@/libs/ui/components/button";
import { ConfirmAction } from "@/libs/ui/composites/confirm-action";
import { PageHeader } from "@/libs/ui/composites/page-header";
import { RouteTabs } from "@/libs/ui/composites/route-tabs";
import { Time } from "@/libs/ui/composites/time";
import { Unavailable } from "@/libs/ui/composites/unavailable";
import { isUnended } from "@/operations/run-progress";
import { PhaseStatus } from "@/features/run-status";
import { RunTable } from "@/features/run-table";
import { ViewerLine } from "@/features/viewer-notice";
import { WorkflowCanvas } from "@/features/workflow-canvas";
import { archiveAction } from "./actions";
import { OnOffSwitch } from "./on-off-switch";
import { scheduleText } from "@/operations/schedule-words";
import type { WorkflowParams } from "../../__shared_context/workflow-params";
import { WorkflowQuery } from "./query";
import { StartDialog } from "./start-dialog";

export function workflowMetadata(params: WorkflowParams): Metadata {
  const name = segment(params.name);
  return { title: name };
}

export async function WorkflowDetail({
  params,
  query,
}: {
  readonly params: WorkflowParams;
  readonly query: Query;
}) {
  const namespace = segment(params.namespace);
  const name = segment(params.name);
  const address = WorkflowQuery.parse(query);
  const tab = address.tab;
  const limit = tab === "runs" ? 50 : 6;
  const read = await available(
    Promise.all([
      currentSession(),
      workflowOf(namespace, name),
      versionsOf(namespace, name),
      instances({ namespace, name, limit }),
    ]),
  );

  if (read === UNAVAILABLE) return <Unavailable />;

  const [session, workflow, versions, recent] = read;

  if (workflow === null) notFound();

  const current = workflow.currentVersion;
  const reading =
    current === null ? null : versionStructure(namespace, name, current);
  const structure = await available(Promise.resolve(reading));

  if (structure === UNAVAILABLE) return <Unavailable />;

  const archived = workflow.status === "archived";
  const capabilities = session?.capabilities;
  const author = capabilities?.author === true && !archived;
  const viewer =
    capabilities?.author !== true && capabilities?.operator !== true;
  const operator = capabilities?.operator === true && !archived;
  const newestFirst = versions.slice().reverse();
  const versionNames = newestFirst.map((version) => version.version);
  const archive = archiveAction.bind(null, namespace, name);
  const archivedNote = `${name} archived`;
  const allRuns = runsHref({ namespace, name });
  const live = recent.items.some((instance) => isUnended(instance.phase));
  const schedule = workflow.schedule;
  const automatic = schedule !== null;
  const title = structure?.title ?? name;
  const summary = structure?.summary ?? undefined;
  const versionsLabel = (
    <>
      Versions
      <span className="text-muted-foreground tabular-nums">
        {versions.length}
      </span>
    </>
  );
  const tabs = [
    {
      href: workflowHref(namespace, name),
      label: "Overview",
      current: tab === "overview",
    },
    {
      href: workflowHref(namespace, name, { tab: "runs" }),
      label: "Runs",
      current: tab === "runs",
    },
    {
      href: workflowHref(namespace, name, { tab: "versions" }),
      label: versionsLabel,
      current: tab === "versions",
    },
  ];
  const startsText =
    current === null
      ? "Nothing is published yet."
      : schedule !== null
        ? `${scheduleText(schedule)}, while automatic starts are on.`
        : "By hand, or when an application starts it.";

  return (
    <>
      <PageHeader
        title={title}
        description={summary}
        actions={
          viewer ? (
            <ViewerLine />
          ) : current === null ? undefined : (
            <>
              {operator && (
                <StartDialog
                  namespace={namespace}
                  name={name}
                  versions={versionNames}
                  currentVersion={current}
                  inputSchema={structure?.input.schema ?? null}
                  defaultOpen={address.start}
                />
              )}
              {author && (
                <>
                  <Button variant="outline" asChild>
                    <Link href={editorHref(namespace, name)}>
                      <PencilIcon data-icon="inline-start" />
                      Edit
                    </Link>
                  </Button>
                  <ConfirmAction
                    icon={<ArchiveIcon data-icon="inline-start" />}
                    label="Archive"
                    title={`Archive ${name}?`}
                    description="It starts no run and takes no version. Its versions and runs stay readable. Archiving cannot be undone."
                    actionLabel="Archive"
                    action={archive}
                    success={archivedNote}
                  />
                </>
              )}
            </>
          )
        }
      />
      {archived && (
        <Alert>
          <ArchiveIcon />
          <AlertTitle>Archived</AlertTitle>
          <AlertDescription>
            It starts no run and takes no version. Its versions and runs stay
            readable.
          </AlertDescription>
        </Alert>
      )}
      <section
        aria-label="How it starts"
        className="flex flex-wrap items-start justify-between gap-4 rounded-xl border bg-card px-4 py-3"
      >
        <dl className="flex min-w-0 flex-col gap-0.5 text-sm sm:flex-row sm:gap-3">
          <dt className="font-medium">Starts</dt>
          <dd className="text-muted-foreground">{startsText}</dd>
        </dl>
        {automatic && (
          <OnOffSwitch
            namespace={namespace}
            name={name}
            on={workflow.on}
            disabled={!author}
          />
        )}
      </section>
      <RouteTabs tabs={tabs} label="Workflow" />
      {tab === "overview" && (
        <>
          <div className="h-80 overflow-hidden rounded-xl border bg-canvas md:h-[26rem]">
            {structure === null ? (
              <p className="p-6 text-sm text-muted-foreground">
                Nothing is published yet, or the version no longer reads.
              </p>
            ) : (
              <WorkflowCanvas
                workflow={structure}
                scope={`${namespace}/${name}`}
                startLine={schedule === null ? null : scheduleText(schedule)}
              />
            )}
          </div>
          <Runs
            runs={recent}
            live={live}
            title="Recent runs"
            more={workflowHref(namespace, name, { tab: "runs" })}
          />
        </>
      )}
      {tab === "runs" && (
        <Runs runs={recent} live={live} title="Runs" more={allRuns} />
      )}
      {tab === "versions" && (
        <Versions namespace={namespace} name={name} versions={newestFirst} />
      )}
    </>
  );
}

function Runs({
  runs,
  live,
  title,
  more,
}: {
  readonly runs: Read<InstancePage>;
  readonly live: boolean;
  readonly title: string;
  readonly more: string;
}) {
  return (
    <section aria-labelledby="workflow-runs" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="workflow-runs" className="heading-2">
          {title}
        </h2>
        <div className="flex items-center gap-3">
          <RefreshControl
            activity={live ? "in-flight" : "open"}
            renderedAt={runs.readAt}
          />
          <Button variant="link" size="sm" asChild>
            <Link href={more}>See all</Link>
          </Button>
        </div>
      </div>
      <RunTable
        runs={runs.items}
        Status={PhaseStatus}
        showWorkflow={false}
        empty={
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No runs yet. Start one to see it here.
          </p>
        }
      />
    </section>
  );
}

function Versions({
  namespace,
  name,
  versions,
}: {
  readonly namespace: string;
  readonly name: string;
  readonly versions: readonly Version[];
}) {
  return (
    <ol className="flex flex-col divide-y rounded-xl border bg-card">
      {versions.map((version) => (
        <li
          key={version.version}
          className="flex items-center justify-between gap-3 px-4 py-3"
        >
          <div className="min-w-0">
            <Link
              href={versionHref(namespace, name, version.version)}
              className="font-medium tabular-nums text-accent-text underline-offset-4 hover:underline"
            >
              {version.version}
            </Link>
            <div className="text-xs text-muted-foreground">
              Published <Time value={version.publishedAt} /> by{" "}
              {version.publishedBy.name}
            </div>
          </div>
          {version.current && <Badge variant="secondary">Current</Badge>}
        </li>
      ))}
    </ol>
  );
}
