import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { Period } from "./interfaces";
import { periodLabel } from "./periods";
import { windowsOf } from "./windows";

interface PeriodProbeProps {
  readonly period: Period;
  readonly now: string;
  readonly zone: string;
}

function PeriodProbe({ period, now, zone }: PeriodProbeProps) {
  const windows = windowsOf(period, now, zone);
  const label = periodLabel(period);
  const title = `${label} up to ${now} in ${zone}`;

  return (
    <section aria-label={title} className="flex flex-col gap-3 p-4 text-sm">
      <h2 className="font-semibold">{title}</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt>Window</dt>
        <dd className="font-mono">
          {windows.current.from} – {windows.current.to}
        </dd>
        <dt>Previous</dt>
        <dd className="font-mono">
          {windows.previous.from} – {windows.previous.to}
        </dd>
        <dt>Counted per</dt>
        <dd>{windows.unit}</dd>
      </dl>
      <table className="w-fit">
        <thead>
          <tr className="text-left">
            <th className="pr-4">Bucket</th>
            <th className="pr-4">From</th>
            <th>To</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {windows.buckets.map((bucket) => (
            <tr key={bucket.from}>
              <td className="pr-4">{bucket.label}</td>
              <td className="pr-4">{bucket.from}</td>
              <td>{bucket.to}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

const meta = {
  component: PeriodProbe,
} satisfies Meta<typeof PeriodProbe>;

export default meta;

type Story = StoryObj<typeof meta>;

export const HoursInKyivAsClocksGoForward: Story = {
  args: { period: "24h", now: "2026-03-29T12:00:00.000Z", zone: "Europe/Kyiv" },
};

export const HoursInNewYorkAsClocksGoBack: Story = {
  args: {
    period: "24h",
    now: "2026-11-01T17:00:00.000Z",
    zone: "America/New_York",
  },
};

export const DaysInKyivOverTheLastSundayOfMarch: Story = {
  args: { period: "7d", now: "2026-03-31T09:00:00.000Z", zone: "Europe/Kyiv" },
};

export const DaysInNewYorkOverTheSecondSundayOfMarch: Story = {
  args: {
    period: "7d",
    now: "2026-03-10T16:00:00.000Z",
    zone: "America/New_York",
  },
};

export const MonthInKyivOverTheLastSundayOfOctober: Story = {
  args: { period: "30d", now: "2026-11-05T10:00:00.000Z", zone: "Europe/Kyiv" },
};

export const MonthInNewYorkAcrossTheEndOfOctober: Story = {
  args: {
    period: "30d",
    now: "2026-11-02T15:00:00.000Z",
    zone: "America/New_York",
  },
};
