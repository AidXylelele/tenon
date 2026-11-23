import {
  expectedStarts,
  failingWorkflows,
  instanceCounts,
  instances,
} from "@/libs/data-access/automation";
import { available, UNAVAILABLE, viewerZone } from "@/libs/data-access/http";
import { RefreshControl } from "@/libs/live/refresh-control";
import { ViewerZone } from "@/libs/live/viewer-zone";
import { HOME_HREF, runsHref } from "@/libs/routing/routes";
import type { Query } from "@/libs/routing/segment";
import { PageHeader } from "@/libs/ui/composites/page-header";
import { Unavailable } from "@/libs/ui/composites/unavailable";
import {
  countWindowOf,
  type FigureKind,
  figuresOf,
  inProgressOf,
  type Period,
  seriesOf,
  windowsOf,
} from "@/operations/run-periods";
import { PeriodFigures, PeriodPicker, RunsChart } from "@/features/runs-chart";
import { AutomaticStarts } from "./automatic-starts";
import { periodOf } from "./home-address";
import { NeedsAttention } from "./needs-attention";

const FAILING_SHOWN = 5;

const STATUS_OF: Readonly<Record<FigureKind, string | undefined>> = {
  started: undefined,
  succeeded: "succeeded",
  failed: "failed",
  cancelled: "cancelled",
};

export async function Overview({ query }: { readonly query: Query }) {
  const period = periodOf(query);
  const zone = await viewerZone();
  const now = new Date().toISOString();
  const windows = windowsOf(period, now, zone);
  const window = countWindowOf(windows);
  const read = await available(
    Promise.all([
      instanceCounts(window),
      failingWorkflows({
        from: windows.current.from,
        to: windows.current.to,
        limit: FAILING_SHOWN,
      }),
      instances({ phases: ["suspended"], limit: FAILING_SHOWN }),
      expectedStarts(windows.current.from),
    ]),
  );

  if (read === UNAVAILABLE) return <Unavailable />;

  const [counts, failing, paused, expected] = read;
  const figures = figuresOf(counts.total, counts.previous?.counts ?? null);
  const inProgress = inProgressOf(counts.now);
  const bars = seriesOf(windows.buckets, counts.buckets);
  const barHrefs = bars.map((bar) => runsHref({ from: bar.from, to: bar.to }));
  const activity = inProgress > 0 ? "in-flight" : "open";
  const figureHrefOf = (kind: FigureKind) =>
    runsHref({ status: STATUS_OF[kind], started: period });
  const inProgressHref = runsHref({ status: "in-progress" });
  const failedHref = runsHref({ status: "failed", started: period });

  return (
    <>
      <ViewerZone zone={zone} />
      <PageHeader
        title="Home"
        description="Runs of every workflow, counted by the time they started. Test runs are not counted."
        actions={
          <>
            <PeriodPicker period={period} hrefOf={homeHrefOf} />
            <RefreshControl activity={activity} renderedAt={counts.readAt} />
          </>
        }
      />
      <section
        aria-labelledby="period-runs"
        className="flex flex-col gap-4 rounded-xl border bg-card p-4"
      >
        <h2 id="period-runs" className="sr-only">
          Runs of the period
        </h2>
        <PeriodFigures
          period={period}
          figures={figures}
          inProgress={inProgress}
          hrefOf={figureHrefOf}
          inProgressHref={inProgressHref}
        />
        <RunsChart
          bars={bars}
          hrefs={barHrefs}
          unit={windows.unit}
          zone={zone}
        />
      </section>
      <NeedsAttention
        period={period}
        failing={failing}
        paused={paused.items}
        failedHref={failedHref}
      />
      <AutomaticStarts expected={expected} />
    </>
  );
}

function homeHrefOf(period: Period): string {
  return period === "24h" ? HOME_HREF : `${HOME_HREF}?period=${period}`;
}
