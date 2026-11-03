import { ActivityIcon } from 'lucide-react';
import { Link } from '@/libs/routing/link';
import { instances } from '@/libs/data-access/automation';
import type { InstanceFilter } from '@/libs/data-access/types';
import { type Query, single } from '@/libs/routing/segment';
import { RefreshControl } from '@/libs/live/refresh-control';
import { Button } from '@/libs/ui/components/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/libs/ui/components/empty';
import { PageHeader } from '@/libs/ui/composites/page-header';
import { InstanceTable } from '../../__shared_context/instance-table';
import { isUnended, PHASES } from '../../__shared_context/vocabulary';
import { Filters } from './filters';

// Runs newest first, filtered by what the address says, so a view can be shared and reloaded
// (002 FR-016, spec US6).
export async function InstanceList({ query }: { readonly query: Query }) {
  const filter = filterOf(query);
  const page = await instances({ ...filter, limit: 50 });
  const live = page.items.some((instance) => isUnended(instance.phase));
  const filtered = Object.entries(filter).some(
    ([key, value]) => key !== 'cursor' && value !== undefined && value !== '',
  );
  const next =
    page.next === null
      ? null
      : `/instances?${queryOf({ ...filter, cursor: page.next })}`;

  return (
    <>
      <PageHeader
        title="Runs"
        description="Every run of every workflow, newest first. Open one to follow it step by step."
        actions={
          <RefreshControl
            activity={live ? 'in-flight' : 'open'}
            renderedAt={page.readAt}
          />
        }
      />
      <Filters filter={filter} />
      {page.items.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ActivityIcon />
            </EmptyMedia>
            <EmptyTitle>
              {filtered ? 'No run matches these filters' : 'No runs yet'}
            </EmptyTitle>
            <EmptyDescription>
              {filtered
                ? 'Clear a filter to see more.'
                : 'Start a workflow by hand, or turn on one with a schedule.'}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <InstanceTable instances={page.items} />
      )}
      <div className="flex justify-end gap-2">
        {filter.cursor !== undefined && (
          <Button variant="outline" asChild>
            <Link
              href={`/instances?${queryOf({ ...filter, cursor: undefined })}`}
            >
              Newest
            </Link>
          </Button>
        )}
        {next !== null && (
          <Button variant="outline" asChild>
            <Link href={next}>Older</Link>
          </Button>
        )}
      </div>
    </>
  );
}

function queryOf(filter: InstanceFilter): string {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(filter))
    if (value !== undefined && value !== '') query.set(key, String(value));

  return query.toString();
}

// The filter the address gives; an unknown phase is no filter, as the API would refuse it.
function filterOf(query: Query): InstanceFilter {
  const phase = PHASES.find((each) => each === single(query, 'phase'));
  return {
    namespace: single(query, 'namespace'),
    name: single(query, 'name'),
    version: single(query, 'version'),
    phase,
    startedFrom: single(query, 'startedFrom'),
    startedTo: single(query, 'startedTo'),
    cursor: single(query, 'cursor'),
  };
}
