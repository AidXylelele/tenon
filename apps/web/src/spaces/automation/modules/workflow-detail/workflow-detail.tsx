import { ArchiveIcon, PencilIcon } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  instances,
  versionDocument,
  versions as versionsOf,
  workflow as workflowOf,
} from '@/libs/data-access/automation';
import { currentUser } from '@/libs/data-access/identity';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/libs/ui/components/alert';
import { Badge } from '@/libs/ui/components/badge';
import { Button } from '@/libs/ui/components/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/libs/ui/components/card';
import { PageHeader } from '@/libs/ui/composites/page-header';
import { Time } from '@/libs/ui/composites/time';
import { LiveRefresh } from '@/libs/live/live-refresh';
import { canAuthor } from '../../__shared_context/access';
import { headerOf } from '../../__shared_context/document/draft';
import { inputFieldsOf } from '../../__shared_context/document/input-schema';
import {
  describeTrigger,
  startsAutomatically,
  triggerOf,
} from '../../__shared_context/document/trigger';
import { InstanceTable } from '../../__shared_context/instance-table';
import { versionHref, workflowHref } from '../../__shared_context/links';
import { WorkflowOutline } from '../../__shared_context/outline/workflow-outline';
import { isUnended } from '../../__shared_context/vocabulary';
import { ArchiveButton } from './archive-button';
import { OnOffSwitch } from './on-off-switch';
import { StartDialog } from './start-dialog';

interface WorkflowDetailProps {
  readonly namespace: string;
  readonly name: string;
  // Opens the start dialog at once, as after publishing.
  readonly starting?: boolean;
}

const RECENT = 10;

export async function WorkflowDetail({
  namespace,
  name,
  starting = false,
}: WorkflowDetailProps) {
  const [user, workflow, versions, recent] = await Promise.all([
    currentUser(),
    workflowOf(namespace, name),
    versionsOf(namespace, name),
    instances({ namespace, name, limit: RECENT }),
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

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/workflows" className="hover:text-foreground">
            Workflows / {namespace}
          </Link>
        }
        title={
          header?.title !== undefined && header.title !== ''
            ? header.title
            : name
        }
        description={header?.summary !== '' ? header?.summary : undefined}
        actions={
          author && current !== null ? (
            <>
              <ArchiveButton namespace={namespace} name={name} />
              <Button variant="outline" asChild>
                <Link href={`${workflowHref(namespace, name)}/edit`}>
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
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Starts automatically</CardTitle>
              <CardDescription>
                {trigger === null
                  ? 'No version is published yet.'
                  : startsAutomatically(trigger)
                    ? `${describeTrigger(trigger)}, while this is on. Starting by hand works either way.`
                    : 'This workflow has no schedule: it starts by hand or from an application.'}
              </CardDescription>
              <CardAction>
                <OnOffSwitch
                  namespace={namespace}
                  name={name}
                  on={workflow.on}
                  disabled={
                    !author || trigger === null || !startsAutomatically(trigger)
                  }
                />
              </CardAction>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Steps</CardTitle>
              <CardDescription>
                The current version, {current ?? 'none'}, in the order it runs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {document === null ? (
                <p className="text-sm text-muted-foreground">
                  Nothing published.
                </p>
              ) : (
                <WorkflowOutline document={document} />
              )}
            </CardContent>
          </Card>
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold">Recent runs</h2>
              <div className="flex items-center gap-3">
                <LiveRefresh
                  active
                  renderedAt={recent.readAt}
                  intervalMs={live ? 2000 : 5000}
                />
                <Button variant="link" size="sm" asChild>
                  <Link
                    href={`/instances?namespace=${encodeURIComponent(namespace)}&name=${encodeURIComponent(name)}`}
                  >
                    All runs
                  </Link>
                </Button>
              </div>
            </div>
            {recent.items.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No runs yet. Start one to see it here.
              </p>
            ) : (
              <InstanceTable instances={recent.items} showWorkflow={false} />
            )}
          </section>
        </div>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Versions</CardTitle>
            <CardDescription>
              Newest first. A version never changes once published.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-col divide-y">
              {newestFirst.map((version) => (
                <li
                  key={version.version}
                  className="flex items-center justify-between gap-2 py-2 first:pt-0"
                >
                  <div className="min-w-0">
                    <Link
                      href={versionHref(namespace, name, version.version)}
                      className="font-medium tabular-nums hover:underline"
                    >
                      {version.version}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      <Time value={version.publishedAt} />, DSL {version.dsl}
                    </div>
                  </div>
                  {version.current && (
                    <Badge variant="secondary">Current</Badge>
                  )}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
