import type {
  ExpectedStarts,
  FailingWorkflows,
  InstanceCounts,
  ListedInstance,
  Read,
} from "@/libs/data-access/types";
import { LiveUpdates } from "@/libs/live/live-updates";
import { HOME_HREF, runsHref } from "@/libs/routing/routes";
import { PageHeader } from "@/libs/ui/composites/page-header";
import {
  type FigureKind,
  figuresOf,
  inProgressOf,
  type Period,
  type PeriodWindows,
  seriesOf,
} from "@/operations/run-periods";
import { PeriodFigures, PeriodPicker, RunsChart } from "@/features/runs-chart";
import { AutomaticStarts } from "./automatic-starts";
import { NeedsAttention } from "./needs-attention";

const STATUS_OF: Readonly<Record<FigureKind, string | undefined>> = {
  started: undefined,
  succeeded: "succeeded",
  failed: "failed",
  cancelled: "cancelled",
};

export interface HomePageProps {
  readonly period: Period;
  readonly zone: string;
  readonly windows: PeriodWindows;
  readonly counts: Read<InstanceCounts>;
  readonly failing: FailingWorkflows;
  readonly paused: readonly ListedInstance[];
  readonly expected: readonly ExpectedStarts[];
}

export function HomePage({
  period,
  zone,
  windows,
  counts,
  failing,
  paused,
  expected,
}: HomePageProps) {
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
      <PageHeader
        title="Home"
        description="Runs of every workflow, counted by the time they started. Test runs are not counted."
        actions={<PeriodPicker period={period} hrefOf={homeHrefOf} />}
      />
      <LiveUpdates activity={activity} />
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
        paused={paused}
        failedHref={failedHref}
      />
      <AutomaticStarts expected={expected} />
    </>
  );
}

function homeHrefOf(period: Period): string {
  return period === "24h" ? HOME_HREF : `${HOME_HREF}?period=${period}`;
}
