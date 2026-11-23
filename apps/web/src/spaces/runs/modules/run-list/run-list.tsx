import { ActivityIcon } from "lucide-react";
import { instances, workflows } from "@/libs/data-access/automation";
import { available, UNAVAILABLE, viewerZone } from "@/libs/data-access/http";
import { currentSession } from "@/libs/data-access/identity";
import type { InstanceOrder } from "@/libs/data-access/types";
import { RefreshControl } from "@/libs/live/refresh-control";
import { ViewerZone } from "@/libs/live/viewer-zone";
import type { Query } from "@/libs/routing/segment";
import { EmptyState } from "@/libs/ui/composites/empty-state";
import { PageHeader } from "@/libs/ui/composites/page-header";
import { Unavailable } from "@/libs/ui/composites/unavailable";
import { phasesOf, summaryOf, windowsOf } from "@/operations/run-periods";
import { isUnended, phaseLabel } from "@/operations/run-progress";
import { PhaseStatus } from "@/features/run-status";
import { RunPager, RunTable } from "@/features/run-table";
import { Filters, type KnownWorkflow } from "./filters";
import {
  isFiltered,
  type RunsAddress,
  runsAddressOf,
  runsHrefOf,
} from "./runs-address";

const numbers = new Intl.NumberFormat("en-US");

export async function RunList({ query }: { readonly query: Query }) {
  const address = runsAddressOf(query);
  const zone = await viewerZone();
  const from = startOf(address, zone);
  const phases = address.statuses.flatMap((status) => phasesOf(status));
  const read = await available(
    Promise.all([
      currentSession(),
      instances({
        namespace: address.namespace,
        name: address.name,
        version: address.version,
        phases,
        from,
        sort: address.sort,
        page: address.page,
        limit: address.size,
      }),
      workflows("active"),
    ]),
  );

  if (read === UNAVAILABLE) return <Unavailable />;

  const [session, page, active] = read;
  const operator = session?.capabilities.operator === true;
  const live = page.items.some((instance) => isUnended(instance.phase));
  const activity = live ? "in-flight" : "open";
  const known: KnownWorkflow[] = active.items.map((workflow) => ({
    namespace: workflow.namespace,
    name: workflow.name,
  }));
  const summary = summaryLineOf(address, page.total, page.exact);
  const order = {
    sort: address.sort,
    hrefOf: (sort: InstanceOrder) => runsHrefOf({ ...address, sort, page: 1 }),
  };
  const pageHrefOf = (number: number, size: number) =>
    runsHrefOf({ ...address, page: number, size });
  const orderWords =
    address.sort === "duration" ? "longest first" : "newest first";
  const description = `Every run, by the time it started; ${orderWords}.`;
  const empty = isFiltered(address) ? (
    <EmptyState
      icon={<ActivityIcon />}
      title="No runs match these filters"
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
      <ViewerZone zone={zone} />
      <PageHeader
        title="Runs"
        description={description}
        actions={
          <RefreshControl activity={activity} renderedAt={page.readAt} />
        }
      />
      <Filters address={address} workflows={known} />
      <h2 className="text-sm font-semibold" role="status">
        {summary}
      </h2>
      <RunTable
        runs={page.items}
        Status={PhaseStatus}
        order={order}
        empty={empty}
      />
      {page.total > 0 && (
        <RunPager
          page={address.page}
          size={address.size}
          total={page.total}
          exact={page.exact}
          hrefOf={pageHrefOf}
        />
      )}
    </>
  );
}

function startOf(address: RunsAddress, zone: string): string | undefined {
  if (address.started === "all") return undefined;

  const now = new Date().toISOString();
  const windows = windowsOf(address.started, now, zone);
  return windows.current.from;
}

function summaryLineOf(
  address: RunsAddress,
  total: number,
  exact: boolean,
): string {
  const runs = summaryOf(address.statuses, address.started, phaseLabel);
  const workflow = address.name === undefined ? "" : ` of ${address.name}`;
  const counted = numbers.format(total);
  const count = exact ? counted : `more than ${counted}`;
  return `${runs}${workflow} · ${count}`;
}
