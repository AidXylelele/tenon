import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { nextStartsOf } from "./cron-table";
import { daylightNote, localTimeText, startText } from "./local-time";
import { cronOf, cronText, repeatLabel, repeatOf } from "./repeats";

interface ScheduleProbeProps {
  readonly cron: string;
  readonly now: string;
  readonly zone: string;
}

const NEXT_STARTS = 3;

function ScheduleProbe({ cron, now, zone }: ScheduleProbeProps) {
  const words = cronText(cron);
  const local = localTimeText(cron, now, zone);
  const note = daylightNote(cron, now, zone);
  const starts = nextStartsOf(cron, now, NEXT_STARTS);
  const repeat = repeatOf(cron);
  const choice = repeatLabel(repeat);
  const written = cronOf(repeat);
  const title = `${cron} on ${now} in ${zone}`;

  return (
    <section aria-label={title} className="flex flex-col gap-3 p-4 text-sm">
      <h2 className="font-mono font-semibold">{title}</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt>Starts</dt>
        <dd>{words}</dd>
        <dt>Your time</dt>
        <dd>{local ?? "—"}</dd>
        <dt>Daylight saving</dt>
        <dd>{note ?? "No change within a week"}</dd>
        <dt>Repeat</dt>
        <dd>{choice}</dd>
        <dt>Written back</dt>
        <dd className="font-mono">{written}</dd>
      </dl>
      <h3 className="font-semibold">Next starts</h3>
      <ul>
        {starts.map((start) => (
          <li key={start}>{startText(start, zone)}</li>
        ))}
      </ul>
    </section>
  );
}

const meta = {
  component: ScheduleProbe,
} satisfies Meta<typeof ScheduleProbe>;

export default meta;

type Story = StoryObj<typeof meta>;

export const EveryDayInKyivBeforeClocksGoForward: Story = {
  args: {
    cron: "0 9 * * *",
    now: "2026-03-25T12:00:00.000Z",
    zone: "Europe/Kyiv",
  },
};

export const EveryWeekdayInNewYorkBeforeClocksGoBack: Story = {
  args: {
    cron: "0 14 * * 1-5",
    now: "2026-10-28T12:00:00.000Z",
    zone: "America/New_York",
  },
};

export const LateOnMondaysInKyiv: Story = {
  args: {
    cron: "30 23 * * 1",
    now: "2026-11-22T12:00:00.000Z",
    zone: "Europe/Kyiv",
  },
};

export const EarlyOnWeekdaysInNewYork: Story = {
  args: {
    cron: "0 2 * * 1-5",
    now: "2026-11-22T12:00:00.000Z",
    zone: "America/New_York",
  },
};

export const EveryTenMinutes: Story = {
  args: {
    cron: "*/10 * * * *",
    now: "2026-11-22T10:03:00.000Z",
    zone: "Europe/Kyiv",
  },
};

export const ACustomSchedule: Story = {
  args: {
    cron: "0 2 1 * *",
    now: "2026-11-22T12:00:00.000Z",
    zone: "America/New_York",
  },
};
