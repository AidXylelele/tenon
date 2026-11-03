import { CircleAlertIcon } from 'lucide-react';
import { Link } from '@/libs/routing/link';
import { notFound } from 'next/navigation';
import {
  instance as instanceOf,
  instanceEvents,
  taskRecords,
  versionDocument,
} from '@/libs/data-access/automation';
import { currentUser } from '@/libs/data-access/identity';
import type { Instance } from '@/libs/data-access/types';
import { RefreshControl } from '@/libs/live/refresh-control';
import { Crumbs } from '@/libs/ui/composites/crumbs';
import { Duration, Time } from '@/libs/ui/composites/time';
import { canAuthor } from '../../__shared_context/access';
import { allEntries } from '../../__shared_context/document/tasks';
import {
  instanceHref,
  versionHref,
  workflowHref,
} from '../../__shared_context/links';
import {
  isUnended,
  PhaseStatus,
  startedBy,
} from '../../__shared_context/vocabulary';
import { Controls } from './controls';
import { type RunPanel, RunView } from './run-view';

interface InstanceDetailProps {
  readonly id: string;
  // The panel in the address, or null for the one that fits the run's phase.
  readonly view: RunPanel | null;
}

// A run, live until it ends (FR-008, FR-024): what it is, what it may still do, and its graph
// with every step's status. Its events are read only while their panel is shown (FR-027).
export async function InstanceDetail({ id, view }: InstanceDetailProps) {
  const [user, instance, records] = await Promise.all([
    currentUser(),
    instanceOf(id),
    taskRecords(id),
  ]);

  if (instance === null) notFound();

  const panel = view ?? defaultPanelOf(instance);
  const events = panel === 'events' ? await instanceEvents(id) : null;

  const document = await versionDocument(
    instance.namespace,
    instance.name,
    instance.version,
  );
  const pointers =
    document === null
      ? []
      : allEntries(document).map(({ entry }) => entry.pointer);
  const live = isUnended(instance.phase);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3 border-b px-4 py-3 md:px-6">
        <div className="min-w-0 flex-1">
          <Crumbs
            trail={[
              { label: 'Runs', href: '/instances' },
              {
                label: instance.name,
                href: workflowHref(instance.namespace, instance.name),
              },
              { label: `Run ${instance.id.slice(0, 8)}` },
            ]}
          />
          <h1 className="flex flex-wrap items-center gap-3 text-lg font-semibold tracking-tight">
            Run of {instance.name}
            <PhaseStatus phase={instance.phase} />
          </h1>
          <Facts instance={instance} />
        </div>
        <div className="flex flex-col items-end gap-2">
          {canAuthor(user) && (
            <Controls id={instance.id} phase={instance.phase} />
          )}
          <RefreshControl
            activity={live ? 'in-flight' : 'ended'}
            renderedAt={records.readAt}
          />
        </div>
      </div>
      {instance.phase === 'faulted' && instance.error !== null && (
        <FaultStrip instance={instance} pointers={pointers} />
      )}
      <RunView
        instance={instance}
        document={document}
        records={records.items}
        more={records.next !== null}
        panel={panel}
        events={events?.items ?? null}
      />
    </div>
  );
}

function defaultPanelOf(instance: Instance): RunPanel {
  return isUnended(instance.phase) ? 'timeline' : 'result';
}

function Facts({ instance }: { readonly instance: Instance }) {
  return (
    <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
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
    </p>
  );
}

function FaultStrip({
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
    <div
      className="flex items-start gap-3 border-b bg-red-500/[0.06] px-4 py-2.5 text-sm md:px-6"
      role="alert"
    >
      <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
      <div className="min-w-0">
        <span className="font-medium text-red-700 dark:text-red-300">
          {error.title ?? 'The run faulted'}
          {name !== undefined && ` at ${name}`}
        </span>
        <span className="text-muted-foreground">
          {' '}
          {error.detail ??
            'The step raised an error the workflow did not handle.'}{' '}
          ({kind}, status {error.status})
        </span>
      </div>
    </div>
  );
}
