import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ListedInstance, Phase, Trigger } from "@/libs/data-access/types";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import { PageBody } from "@/libs/ui/composites/page-body";
import { runsAddressOf } from "./runs-address";
import { RunsPage } from "./runs-page";

const NOW = Date.parse("2026-11-22T23:40:00.000Z");

type Row = readonly [string, Phase, Trigger, number, string | null];

const PAGE_SIZE = 50;

const LATEST: readonly Row[] = [
  ["route-lead", "running", "schedule", 2, null],
  ["legacy-sync", "faulted", "schedule", 3, null],
  ["route-lead", "completed", "manual", 9, "Ada Lovelace"],
  ["daily-digest", "completed", "schedule", 31, null],
  ["cool-down", "suspended", "manual", 39, "Ada Lovelace"],
  ["legacy-sync", "faulted", "schedule", 63, null],
  ["order-router", "cancelled", "event", 95, null],
  ["order-router", "completed", "event", 121, null],
];

type Kind = readonly [string, Phase, Trigger, string | null];

const EARLIER: readonly Kind[] = [
  ["route-lead", "completed", "event", null],
  ["order-router", "completed", "event", null],
  ["daily-digest", "completed", "schedule", null],
  ["legacy-sync", "faulted", "schedule", null],
  ["route-lead", "completed", "manual", "Ada Lovelace"],
  ["order-router", "completed", "event", null],
];

const EARLIER_COUNT = PAGE_SIZE - LATEST.length;

const ROUNDS = Math.ceil(EARLIER_COUNT / EARLIER.length);

const EARLIER_KINDS = Array.from({ length: ROUNDS }, () => EARLIER)
  .flat()
  .slice(0, EARLIER_COUNT);

const EARLIER_ROWS: readonly Row[] = EARLIER_KINDS.map(
  ([name, phase, trigger, starter], index) => {
    const minutesAgo = 150 + index * 37;
    return [name, phase, trigger, minutesAgo, starter] as const;
  },
);

const ROWS: readonly Row[] = LATEST.concat(EARLIER_ROWS);

const TITLES: Readonly<Record<string, string>> = {
  "route-lead": "Route a lead",
  "legacy-sync": "Legacy sync",
  "daily-digest": "Daily digest",
  "cool-down": "Wait out the cool-down, then report",
  "order-router": "Order router",
};

const RUNS: readonly ListedInstance[] = ROWS.map(
  ([name, phase, trigger, minutesAgo, starter], index) => {
    const started = new Date(NOW - minutesAgo * 60_000).toISOString();
    const ended = ["completed", "faulted", "cancelled"].includes(phase);
    const endedAt = ended
      ? new Date(NOW - minutesAgo * 60_000 + 708).toISOString()
      : null;
    const startedBy = starter === null ? null : { id: "u-1", name: starter };
    return {
      id: `4f2a9c10-0000-4000-8000-${String(index).padStart(12, "0")}`,
      namespace: name === "daily-digest" ? "news" : "sales",
      name,
      title: TITLES[name] ?? null,
      version: "1.2.0",
      phase,
      trigger,
      test: false,
      createdAt: started,
      startedAt: started,
      endedAt,
      startedBy,
      durationMs: null,
      waits: [],
    };
  },
);

const meta = {
  title: "Spaces/Runs/Runs",
  component: RunsPage,
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true, navigation: { pathname: "/runs" } },
  },
  decorators: [
    (Story) => (
      <TooltipProvider>
        <PageBody>
          <Story />
        </PageBody>
      </TooltipProvider>
    ),
  ],
  args: {
    address: runsAddressOf({ started: "7d" }),
    zone: "Europe/Kyiv",
    page: { items: RUNS, total: 272, exact: true, readAt: NOW },
    workflows: [
      { namespace: "sales", name: "route-lead" },
      { namespace: "sales", name: "legacy-sync" },
      { namespace: "news", name: "daily-digest" },
    ],
    operator: true,
  },
} satisfies Meta<typeof RunsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const LastWeek: Story = {};

export const NoMatch: Story = {
  args: {
    address: runsAddressOf({ status: "failed", started: "24h" }),
    page: { items: [], total: 0, exact: true, readAt: NOW },
  },
};
