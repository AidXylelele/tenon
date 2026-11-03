import { ArchiveIcon, PencilIcon } from 'lucide-react';
import { Link } from '@/libs/routing/link';
import { notFound } from 'next/navigation';
import {
  instances,
  versionDocument,
  versions as versionsOf,
  workflow as workflowOf,
} from '@/libs/data-access/automation';
import { currentUser } from '@/libs/data-access/identity';
import type { Version } from '@/libs/data-access/types';
import { RefreshControl } from '@/libs/live/refresh-control';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/libs/ui/components/alert';
import { Badge } from '@/libs/ui/components/badge';
import { Button } from '@/libs/ui/components/button';
import { ConfirmAction } from '@/libs/ui/composites/confirm-action';
import { PageHeader } from '@/libs/ui/composites/page-header';
import { Time } from '@/libs/ui/composites/time';
import { canAuthor } from '@/operations/access-policy';
import {
  editorHref,
  instancesHref,
  versionHref,
  workflowHref,
  WORKFLOWS_HREF,
} from '@/operations/app-routes';
import { isUnended } from '@/operations/run-progress';
import {
  describeTrigger,
  headerOf,
  startsAutomatically,
  triggerOf,
} from '@/operations/workflow-document';
import { RunTable } from '@/features/run-table';
import { WorkflowCanvas } from '@/features/workflow-canvas';
import { inputFieldsOf } from './input-schema';
import { archiveAction } from './actions';
import { OnOffSwitch } from './on-off-switch';
import { StartDialog } from './start-dialog';

export type WorkflowTab = 'overview' | 'runs' | 'versions';

interface WorkflowDetailProps {
  readonly namespace: string;
  readonly name: string;
  readonly tab: WorkflowTab;
  // Opens the start dialog at once, as after publishing.
  readonly starting?: boolean;
}

// A workflow's page (research R12): its graph and how it starts, its runs, its versions.
export async function WorkflowDetail({
  namespace,
  name,
  tab,
  starting = false,
}: WorkflowDetailProps) {
  const [user, workflow, versions, recent] = await Promise.all([
    currentUser(),
    workflowOf(namespace, name),
    versionsOf(namespace, name),
    instances({ namespace, name, limit: tab === 'runs' ? 50 : 6 }),
  ]);

  if (workflow === null) notFound();

  const current = workflow.currentVersion;
  const document =
    current === null ? null : await versionDocument(namespace, name, current);
  const trigger = document === null ? null : triggerOf(document);
  const header = document === null ? null : headerOf(document);
  const archived = workflow.status === 'archived';
  const author = canAuthor(user) && !archived;
  const newestFirst = versions.slice().reverse();
  const live = recent.items.some((instance) => isUnended(instance.phase));
  const base = workflowHref(namespace, name);
  const runsTab = workflowHref(namespace, name, { tab: 'runs' });
  const versionsTab = workflowHref(namespace, name, { tab: 'versions' });
  const automatic = trigger !== null && startsAutomatically(trigger);

  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'Workflows', href: WORKFLOWS_HREF },
          { label: namespace },
          { label: name },
        ]}
        title={
          header?.title !== undefined && header.title !== ''
            ? header.title
            : name
        }
        description={header?.summary !== '' ? header?.summary : undefined}
        actions={
          author && current !== null ? (
            <>
              <ConfirmAction
                icon={<ArchiveIcon data-icon="inline-start" />}
                label="Archive"
                title={`Archive ${name}?`}
                description="It is turned off, takes no new version and starts no run. Its versions and past runs stay readable. Archiving cannot be undone."
                actionLabel="Archive"
                action={archiveAction.bind(null, namespace, name)}
                success={`${name} archived`}
              />
              <Button variant="outline" asChild>
                <Link href={editorHref(namespace, name)}>
                  <PencilIcon data-icon="inline-start" />
                  Edit
                </Link>
              </Button>
              <StartDialog
                namespace={namespace}
                name={name}
                versions={newestFirst.map((version) => version.version)}
                fields={inputFieldsOf(document)}
                defaultOpen={starting}
              />
            </>
          ) : undefined
        }
      />
      {archived && (
        <Alert>
          <ArchiveIcon />
          <AlertTitle>Archived</AlertTitle>
          <AlertDescription>
            This workflow takes no new version and starts no run. Its versions
            and runs stay readable.
          </AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
        <div className="min-w-0">
          <div className="text-sm font-medium">Starts automatically</div>
          <div className="text-sm text-muted-foreground">
            {trigger === null
              ? 'No version is published yet.'
              : automatic
                ? `${describeTrigger(trigger)}, while this is on. Starting by hand works either way.`
                : 'No schedule: it starts by hand or from an application.'}
          </div>
        </div>
        <OnOffSwitch
          namespace={namespace}
          name={name}
          on={workflow.on}
          disabled={!author || !automatic}
        />
      </div>
      <nav className="flex gap-1 border-b text-sm" aria-label="Workflow">
        <Tab href={base} active={tab === 'overview'}>
          Overview
        </Tab>
        <Tab href={runsTab} active={tab === 'runs'}>
          Runs
        </Tab>
        <Tab href={versionsTab} active={tab === 'versions'}>
          Versions{' '}
          <span className="text-muted-foreground">{versions.length}</span>
        </Tab>
      </nav>
      {tab === 'overview' && (
        <>
          <div className="h-[26rem] overflow-hidden rounded-2xl border">
            {document === null ? (
              <p className="p-6 text-sm text-muted-foreground">
                Nothing published.
              </p>
            ) : (
              <WorkflowCanvas document={document} />
            )}
          </div>
          <Runs runs={recent} live={live} title="Recent runs" more={runsTab} />
        </>
      )}
      {tab === 'runs' && (
        <Runs
          runs={recent}
          live={live}
          title="Runs"
          more={instancesHref({ namespace, name })}
        />
      )}
      {tab === 'versions' && (
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
  readonly runs: Awaited<ReturnType<typeof instances>>;
  readonly live: boolean;
  readonly title: string;
  readonly more: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        <div className="flex items-center gap-3">
          <RefreshControl
            activity={live ? 'in-flight' : 'open'}
            renderedAt={runs.readAt}
          />
          <Button variant="link" size="sm" asChild>
            <Link href={more}>See all</Link>
          </Button>
        </div>
      </div>
      <RunTable
        runs={runs.items}
        showWorkflow={false}
        empty={
          <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
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
    <ol className="flex flex-col divide-y rounded-2xl border">
      {versions.map((version) => (
        <li
          key={version.version}
          className="flex items-center justify-between gap-3 px-4 py-3"
        >
          <div className="min-w-0">
            <Link
              href={versionHref(namespace, name, version.version)}
              className="font-medium tabular-nums hover:underline"
            >
              {version.version}
            </Link>
            <div className="text-xs text-muted-foreground">
              Published <Time value={version.publishedAt} />, DSL {version.dsl}
            </div>
          </div>
          {version.current && <Badge>Current</Badge>}
        </li>
      ))}
    </ol>
  );
}

function Tab({
  href,
  active,
  children,
}: {
  readonly href: string;
  readonly active: boolean;
  readonly children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={
        active
          ? '-mb-px flex items-center gap-1.5 border-b-2 border-primary px-3 py-2 font-medium text-foreground'
          : '-mb-px flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-muted-foreground hover:text-foreground'
      }
    >
      {children}
    </Link>
  );
}
