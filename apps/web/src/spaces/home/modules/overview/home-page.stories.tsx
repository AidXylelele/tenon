import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { InstanceCounts, PhaseCounts } from "@/libs/data-access/types";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import { PageBody } from "@/libs/ui/composites/page-body";
import { windowsOf } from "@/operations/run-periods";
import { HomePage } from "./home-page";

const NOW = "2026-11-22T23:40:00.000Z";
const ZONE = "Europe/Kyiv";
const WINDOWS = windowsOf("7d", NOW, ZONE);

const NONE: PhaseCounts = {
  pending: 0,
  running: 0,
  waiting: 0,
  suspended: 0,
  completed: 0,
  faulted: 0,
  cancelled: 0,
};

const DAILY = [
  [38, 2, 0],
  [41, 3, 1],
  [36, 2, 0],
  [44, 6, 1],
  [39, 3, 0],
  [27, 1, 0],
  [22, 2, 1],
];

const BUCKETS = WINDOWS.buckets.map((bucket, index) => {
  const [completed = 0, faulted = 0, cancelled = 0] = DAILY[index] ?? [];
  const running = index === DAILY.length - 1 ? 3 : 0;
  const counts = { ...NONE, completed, faulted, cancelled, running };
  return { start: bucket.from, counts };
});

const COUNTS: InstanceCounts & { readonly readAt: number } = {
  to: NOW,
  buckets: BUCKETS,
  total: { ...NONE, completed: 247, faulted: 19, cancelled: 3, running: 3 },
  previous: {
    from: WINDOWS.previous.from,
    counts: { ...NONE, completed: 230, faulted: 18, cancelled: 3 },
  },
  now: { pending: 1, running: 3, waiting: 4, suspended: 1 },
  readAt: Date.parse(NOW),
};

const meta = {
  title: "Spaces/Home/Home",
  component: HomePage,
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true, navigation: { pathname: "/" } },
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
    period: "7d",
    zone: ZONE,
    windows: WINDOWS,
    counts: COUNTS,
    failing: {
      items: [
        {
          namespace: "billing",
          name: "legacy-sync",
          title: "Legacy sync",
          failed: 12,
          runs: 40,
          firstFailedAt: "2026-11-20T08:12:00.000Z",
          lastFailedAt: "2026-11-22T15:37:00.000Z",
          lastError: {
            status: 404,
            type: "https://open-workflow-specification.org/errors/communication",
            title: "Read the old endpoint",
            detail: "GET https://httpbin.org/status/404 answered 404 Not Found",
          },
          stillFailing: true,
        },
        {
          namespace: "sales",
          name: "order-router",
          title: "Order router",
          failed: 7,
          runs: 120,
          firstFailedAt: "2026-11-19T10:02:00.000Z",
          lastFailedAt: "2026-11-22T11:20:00.000Z",
          lastError: {
            status: 429,
            type: null,
            title: "Post the order",
            detail: "The service answered 429 Too Many Requests",
          },
          stillFailing: false,
        },
      ],
      workflows: 2,
      failed: 19,
    },
    paused: [
      {
        id: "5b0e9a13-0000-4000-8000-000000000009",
        namespace: "ops",
        name: "cool-down",
        title: "Wait out the cool-down, then report",
        version: "1.0.0",
        phase: "suspended",
        trigger: "manual",
        test: false,
        createdAt: "2026-11-22T15:01:00.000Z",
        startedAt: "2026-11-22T15:01:01.000Z",
        endedAt: null,
        startedBy: { id: "u-1", name: "Ada Lovelace" },
        durationMs: null,
        waits: [],
      },
    ],
    operator: true,
    author: true,
    expected: [
      {
        namespace: "ops",
        name: "health-check",
        title: "Health check",
        lastRun: {
          id: "6c1f0b24-0000-4000-8000-000000000010",
          phase: "completed",
          createdAt: "2026-11-22T23:35:00.000Z",
        },
        schedule: { kind: "every", interval: 300_000 },
        next: ["2026-11-23T03:40:00.000Z"],
        missed: 1,
        missedSince: "2026-11-16T22:00:00.000Z",
      },
      {
        namespace: "news",
        name: "daily-digest",
        title: "Daily digest",
        lastRun: {
          id: "6c1f0b24-0000-4000-8000-000000000011",
          phase: "completed",
          createdAt: "2026-11-22T09:00:02.000Z",
        },
        schedule: { kind: "cron", cron: "0 9 * * *" },
        next: ["2026-11-24T09:00:00.000Z"],
        missed: 0,
        missedSince: "2026-11-16T22:00:00.000Z",
      },
    ],
  },
} satisfies Meta<typeof HomePage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Week: Story = {};

export const Calm: Story = {
  args: {
    failing: { items: [], workflows: 0, failed: 0 },
    paused: [],
    expected: [],
  },
};
