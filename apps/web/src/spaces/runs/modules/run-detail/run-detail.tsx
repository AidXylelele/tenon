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
import { Status } from '@/libs/ui/composites/status';
import { Duration, Time } from '@/libs/ui/composites/time';
import { canAuthor } from '@/operations/access-policy';
import {
  instanceHref,
  INSTANCES_HREF,
  versionHref,
  workflowHref,
} from '@/operations/app-routes';
import { isUnended, phaseStatusOf, startedBy } from '@/operations/run-progress';
import { Controls } from './controls';
import { type RunPanel, RunView } from './run-view';

interface RunDetailProps {
  readonly id: string;
  // The panel in the address, or null for the one that fits the run's phase.
  readonly view: RunPanel | null;
}

// A run, live until it ends (FR-008, FR-024): what it is, what it may still do, and its graph
// with every step's status. Its events are read only while their panel is shown (FR-027).
export async function RunDetail({ id, view }: RunDetailProps) {
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
  const live = isUnended(instance.phase);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3 border-b px-4 py-3 md:px-6">
        <div className="min-w-60 flex-1">
          <Crumbs
            trail={[
              { label: 'Runs', href: INSTANCES_HREF },
              {
                label: instance.name,
                href: workflowHref(instance.namespace, instance.name),
              },
              { label: `Run ${instance.id.slice(0, 8)}` },
            ]}
          />
          <h1 className="flex flex-wrap items-center gap-3 text-lg font-semibold tracking-tight">
            Run of {instance.name}
            <Status {...phaseStatusOf(instance.phase)} />
          </h1>
          <Facts instance={instance} />
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          {canAuthor(user) && (
            <Controls id={instance.id} phase={instance.phase} />
          )}
          <RefreshControl
            activity={live ? 'in-flight' : 'ended'}
            renderedAt={records.readAt}
          />
        </div>
      </div>
      <RunView
        instance={instance}
        document={document}
        records={records.items}
        more={records.next !== null}
        panel={panel}
        events={events?.items ?? null}
        canEdit={canAuthor(user)}
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
            ? 'Run again from an earlier run'
            : 'Started by its parent run'}
        </Link>
      )}
    </p>
  );
}
