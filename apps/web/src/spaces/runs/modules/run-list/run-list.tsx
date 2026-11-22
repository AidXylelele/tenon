import { ActivityIcon } from "lucide-react";
import {
  instanceCounts,
  instances,
  workflows,
} from "@/libs/data-access/automation";
import { available, UNAVAILABLE } from "@/libs/data-access/http";
import { currentSession } from "@/libs/data-access/identity";
import { RefreshControl } from "@/libs/live/refresh-control";
import { Link } from "@/libs/routing/link";
import { runsHref } from "@/libs/routing/routes";
import type { Query } from "@/libs/routing/segment";
import { Button } from "@/libs/ui/components/button";
import { EmptyState } from "@/libs/ui/composites/empty-state";
import { PageHeader } from "@/libs/ui/composites/page-header";
import { Unavailable } from "@/libs/ui/composites/unavailable";
import { isUnended } from "@/operations/run-progress";
import { PhaseCounts, PhaseStatus } from "@/features/run-status";
import { RunTable } from "@/features/run-table";
import { Filters, type KnownWorkflow } from "./filters";
import { countWindowOf, filterOf, isFiltered, RunListQuery } from "./query";

export async function RunList({ query }: { readonly query: Query }) {
  const address = RunListQuery.parse(query);
  const filter = filterOf(address);
  const filtered = isFiltered(address);
  const counting = countWindowOf(address);
  const read = await available(
    Promise.all([
      currentSession(),
      instances({ ...filter, limit: 50 }),
      workflows("active"),
      instanceCounts(counting.from, counting.to),
    ]),
  );

  if (read === UNAVAILABLE) return <Unavailable />;

  const [session, page, active, counted] = read;
  const operator = session?.capabilities.operator === true;
  const live = page.items.some((instance) => isUnended(instance.phase));
  const next =
    page.next === null ? null : runsHref({ ...address, cursor: page.next });
  const newest = runsHref({ ...address, cursor: undefined });
  const known: KnownWorkflow[] = active.items.map((workflow) => ({
    namespace: workflow.namespace,
    name: workflow.name,
  }));
  const activity = live ? "in-flight" : "open";
  const empty = filtered ? (
    <EmptyState
      icon={<ActivityIcon />}
      title="No run matches these filters"
      description="Clear a filter to see more."
    />
  ) : (
    <EmptyState
      icon={<ActivityIcon />}
      title="No runs yet"
      description={
        operator
          ? "Start a workflow by hand, or turn on automatic starts for one."
          : "Runs show here once a workflow starts."
      }
    />
  );

  return (
    <>
      <PageHeader
        title="Runs"
        description="Every run of every workflow, newest first."
        actions={
          <RefreshControl activity={activity} renderedAt={page.readAt} />
        }
      />
      <PhaseCounts
        id="run-counts"
        title={counting.title}
        counts={counted.counts}
        hrefOf={(phase) => runsHref({ ...address, phase, cursor: undefined })}
      />
      <Filters query={address} filtered={filtered} workflows={known} />
      <RunTable runs={page.items} Status={PhaseStatus} empty={empty} />
      <div className="flex justify-end gap-2">
        {address.cursor !== undefined && (
          <Button variant="outline" asChild>
            <Link href={newest}>Newest</Link>
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
