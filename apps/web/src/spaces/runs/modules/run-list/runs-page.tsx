import { ActivityIcon } from "lucide-react";
import type {
  InstanceOrder,
  InstancePage,
  Read,
} from "@/libs/data-access/types";
import { LiveUpdates } from "@/libs/live/live-updates";
import { EmptyState } from "@/libs/ui/composites/empty-state";
import { PageHeader } from "@/libs/ui/composites/page-header";
import { periodPhrase, windowPhrase } from "@/operations/run-periods";
import { isUnended, runsPhraseOf } from "@/operations/run-progress";
import { PhaseStatus } from "@/features/run-status";
import { RunPager, RunTable } from "@/features/run-table";
import { Filters, type KnownWorkflow } from "./filters";
import { isFiltered, type RunsAddress, runsHrefOf } from "./runs-address";

const numbers = new Intl.NumberFormat("en-US");

export interface RunsPageProps {
  readonly address: RunsAddress;
  readonly zone: string;
  readonly page: Read<InstancePage>;
  readonly workflows: readonly KnownWorkflow[];
  readonly operator: boolean;
}

export function RunsPage({
  address,
  zone,
  page,
  workflows,
  operator,
}: RunsPageProps) {
  const live = page.items.some((instance) => isUnended(instance.phase));
  const activity = live ? "in-flight" : "open";
  const summary = summaryLineOf(address, zone, page.total, page.exact);
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
      <PageHeader title="Runs" description={description} />
      <LiveUpdates activity={activity} />
      <Filters address={address} workflows={workflows} zone={zone} />
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

function summaryLineOf(
  address: RunsAddress,
  zone: string,
  total: number,
  exact: boolean,
): string {
  const runs = runsPhraseOf(address.statuses);
  const when = whenOf(address, zone);
  const workflow = address.name === undefined ? "" : ` of ${address.name}`;
  const counted = numbers.format(total);
  const count = exact ? counted : `more than ${counted}`;
  return `${runs} ${when}${workflow} · ${count}`;
}

function whenOf(address: RunsAddress, zone: string): string {
  if (address.between === null) return periodPhrase(address.started);

  return windowPhrase(address.between, zone);
}
