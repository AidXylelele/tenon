import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { PhaseCounts } from "@/libs/data-access/types";
import {
  figuresOf,
  type Period,
  seriesOf,
  windowsOf,
} from "@/operations/run-periods";
import { PeriodFigures } from "./period-figures";
import { PeriodPicker } from "./period-picker";
import { RunsChart } from "./runs-chart";

const NOW = "2026-11-23T15:40:00.000Z";

const TOTAL: PhaseCounts = {
  pending: 1,
  running: 2,
  waiting: 1,
  suspended: 1,
  completed: 140,
  faulted: 12,
  cancelled: 3,
};

const PREVIOUS: PhaseCounts = { ...TOTAL, completed: 120, faulted: 20 };

interface PeriodProps {
  readonly period: Period;
  readonly zone: string;
}

function hrefOf(value: string): string {
  return `/runs?status=${value}`;
}

function periodHrefOf(period: Period): string {
  return `/?period=${period}`;
}

function RunsOfAPeriod({ period, zone }: PeriodProps) {
  const windows = windowsOf(period, NOW, zone);
  const counted = windows.buckets.map((bucket, index) => {
    const completed = (index * 7) % 11;
    const faulted = index % 4 === 0 ? 2 : 0;
    const counts = { ...TOTAL, completed, faulted, running: 0, pending: 0 };
    return { start: bucket.from, counts };
  });
  const bars = seriesOf(windows.buckets, counted);
  const figures = figuresOf(TOTAL, PREVIOUS);

  return (
    <section aria-label="Runs" className="flex flex-col gap-4 p-4">
      <PeriodPicker period={period} hrefOf={periodHrefOf} />
      <PeriodFigures
        period={period}
        figures={figures}
        inProgress={5}
        hrefOf={hrefOf}
        inProgressHref="/runs?status=in-progress&started=all"
      />
      <RunsChart bars={bars} unit={windows.unit} zone={zone} />
    </section>
  );
}

const meta = {
  component: RunsOfAPeriod,
} satisfies Meta<typeof RunsOfAPeriod>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WeekInKyiv: Story = {
  args: { period: "7d", zone: "Europe/Kyiv" },
};

export const DayInUtc: Story = { args: { period: "24h", zone: "UTC" } };
