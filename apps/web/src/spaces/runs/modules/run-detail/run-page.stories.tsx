import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { Instance, TaskRecord } from "@/libs/data-access/types";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import { DAILY_DIGEST } from "@/features/workflow-flow/workflows.test-support";
import { RunPage } from "./run-page";

const STARTED = "2026-11-22T21:00:02.000Z";

function recordOf(
  reference: string,
  status: TaskRecord["status"],
  at: number,
): TaskRecord {
  const startedAt = new Date(Date.parse(STARTED) + at).toISOString();
  const endedAt = new Date(Date.parse(STARTED) + at + 180).toISOString();
  return {
    execution: `${reference}#1`,
    reference,
    name: reference.split("/").at(-1) ?? reference,
    status,
    error: null,
    startedAt,
    endedAt,
    attempt: 1,
    input: {},
    output: { ok: true },
    retryAt: null,
  };
}

const RECORDS: readonly TaskRecord[] = [
  recordOf("/do/Fetch the digest", "completed", 0),
  recordOf("/do/Has items?", "completed", 200),
  recordOf("/do/Post the items", "faulted", 420),
];

const FAILED: Instance = {
  id: "7c1d2e3f-0000-4000-8000-000000000001",
  namespace: "news",
  name: "daily-digest",
  version: "1.0.0",
  phase: "faulted",
  trigger: "schedule",
  test: false,
  createdAt: STARTED,
  startedAt: STARTED,
  endedAt: "2026-11-22T21:00:02.708Z",
  input: {},
  output: null,
  error: {
    type: "https://open-workflow-specification.org/errors/communication",
    status: 429,
    instance: "/do/Post the items",
    title: "Post the items failed",
    detail: "The service answered 429 Too Many Requests",
  },
  originId: null,
  startedBy: null,
  controls: ["restart", "delete"],
  cancelReason: null,
  waits: [],
};

const meta = {
  title: "Spaces/Runs/A run",
  component: RunPage,
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: { pathname: `/runs/${FAILED.id}` },
    },
  },
  decorators: [
    (Story) => (
      <TooltipProvider>
        <div className="flex h-svh flex-col">
          <Story />
        </div>
      </TooltipProvider>
    ),
  ],
  args: {
    instance: FAILED,
    workflow: DAILY_DIGEST,
    records: {
      items: RECORDS.slice(),
      next: null,
      readAt: Date.parse(STARTED),
    },
    panel: "timeline",
    events: null,
    author: true,
    operator: true,
  },
} satisfies Meta<typeof RunPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Failed: Story = {};
