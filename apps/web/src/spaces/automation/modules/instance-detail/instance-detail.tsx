import { CircleAlertIcon } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  instance as instanceOf,
  instanceEvents,
  taskRecords,
  versionDocument,
} from '@/libs/data-access/automation';
import { currentUser } from '@/libs/data-access/identity';
import type { Instance } from '@/libs/data-access/types';
import { LiveRefresh } from '@/libs/live/live-refresh';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/libs/ui/components/alert';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/libs/ui/components/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/libs/ui/components/tabs';
import { JsonBlock } from '@/libs/ui/composites/json-block';
import { PageHeader } from '@/libs/ui/composites/page-header';
import { Duration, Time } from '@/libs/ui/composites/time';
import { canAuthor } from '../../__shared_context/access';
import { allEntries } from '../../__shared_context/document/tasks';
import {
  instanceHref,
  versionHref,
  workflowHref,
} from '../../__shared_context/links';
import { progressOf } from '../../__shared_context/outline/progress';
import { WorkflowOutline } from '../../__shared_context/outline/workflow-outline';
import {
  isUnended,
  PhaseStatus,
  startedBy,
} from '../../__shared_context/vocabulary';
import { Controls } from './controls';
import { EventList } from './event-list';
import { Timeline } from './timeline';

export async function InstanceDetail({ id }: { readonly id: string }) {
  const [user, instance, records, events] = await Promise.all([
    currentUser(),
    instanceOf(id),
    taskRecords(id),
    instanceEvents(id),
  ]);

  if (instance === null) notFound();

  const document = await versionDocument(
    instance.namespace,
    instance.name,
    instance.version,
  );
  const pointers =
    document === null
      ? []
      : allEntries(document).map(({ entry }) => entry.pointer);
  const progress = progressOf(records.items, pointers);
  const faultAt =
    instance.phase === 'faulted' ? (instance.error?.instance ?? null) : null;
  const live = isUnended(instance.phase);
  const workflowPage = workflowHref(instance.namespace, instance.name);

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href={workflowPage} className="hover:text-foreground">
            {instance.namespace} / {instance.name}
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            Run of {instance.name}
            <PhaseStatus phase={instance.phase} className="text-base" />
          </span>
        }
        description={<Facts instance={instance} />}
        actions={
          canAuthor(user) ? (
            <Controls id={instance.id} phase={instance.phase} />
          ) : undefined
        }
      />
      <div className="-mt-3">
        <LiveRefresh
          active={live}
          renderedAt={records.readAt}
          intervalMs={1500}
        />
      </div>
      {instance.phase === 'faulted' && instance.error !== null && (
        <FaultAlert instance={instance} pointers={pointers} />
      )}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Steps</CardTitle>
          </CardHeader>
          <CardContent>
            {document === null ? (
              <p className="text-sm text-muted-foreground">
                The version is no longer readable.
              </p>
            ) : (
              <WorkflowOutline
                document={document}
                progress={progress}
                faultAt={faultAt}
                startTone={instance.phase === 'pending' ? 'idle' : 'done'}
              />
            )}
          </CardContent>
        </Card>
        <Tabs
          defaultValue={instance.phase === 'completed' ? 'output' : 'timeline'}
          className="min-w-0"
        >
          <TabsList>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="output">
              {instance.phase === 'faulted' ? 'Error' : 'Output'}
            </TabsTrigger>
            <TabsTrigger value="input">Input</TabsTrigger>
            <TabsTrigger value="events">
              Events ({events.items.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="timeline">
            <Timeline records={records.items} more={records.next !== null} />
          </TabsContent>
          <TabsContent value="output">
            {instance.phase === 'faulted' ? (
              <JsonBlock value={instance.error} />
            ) : (
              <JsonBlock
                value={instance.output}
                empty={
                  live
                    ? 'The output appears when the run completes.'
                    : 'No output.'
                }
              />
            )}
          </TabsContent>
          <TabsContent value="input">
            <JsonBlock value={instance.input} empty="No input." />
          </TabsContent>
          <TabsContent value="events">
            <EventList events={events.items} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function Facts({ instance }: { readonly instance: Instance }) {
  return (
    <span className="flex flex-wrap gap-x-4 gap-y-1">
      <span>
        Version{' '}
        <Link
          href={versionHref(
            instance.namespace,
            instance.name,
            instance.version,
          )}
          className="tabular-nums underline-offset-4 hover:underline"
        >
          {instance.version}
        </Link>
      </span>
      <span>{startedBy(instance.trigger)}</span>
      <span>
        <Time value={instance.startedAt ?? instance.createdAt} />
      </span>
      <span>
        {instance.endedAt === null ? 'Running for' : 'Took'}{' '}
        <Duration from={instance.startedAt} to={instance.endedAt} />
      </span>
      {instance.originId !== null && (
        <Link
          href={instanceHref(instance.originId)}
          className="underline-offset-4 hover:underline"
        >
          {instance.trigger === 'restart'
            ? 'Restarted from another run'
            : 'Started by its parent run'}
        </Link>
      )}
    </span>
  );
}

function FaultAlert({
  instance,
  pointers,
}: {
  readonly instance: Instance;
  readonly pointers: readonly string[];
}) {
  const error = instance.error;

  if (error === null) return null;

  const step = pointers.find((pointer) => pointer === error.instance);
  const name = step?.split('/').at(-1);
  const kind = error.type.split('/').at(-1);

  return (
    <Alert variant="destructive">
      <CircleAlertIcon />
      <AlertTitle>
        {error.title ?? 'The run faulted'}
        {name !== undefined && ` at ${name}`}
      </AlertTitle>
      <AlertDescription>
        <p>
          {error.detail ??
            'The step raised an error the workflow did not handle.'}
        </p>
        <p className="text-xs">
          {kind} error, status {error.status}, at{' '}
          <code className="font-mono">{error.instance}</code>
        </p>
      </AlertDescription>
    </Alert>
  );
}
