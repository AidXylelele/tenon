import type {
  InstanceCounts,
  InstancePage,
  ListedInstance,
  Read,
  Version,
  VersionStructure,
  Workflow,
} from "@/libs/data-access/types";
import { windowsOf } from "@/operations/run-periods";
import { ORDER_ROUTER as ROUTER_FLOW } from "@/features/workflow-flow/workflows.test-support";

export const ORDER_ROUTER: Workflow = {
  namespace: "sales",
  name: "order-router",
  title: "Order router",
  status: "active",
  on: false,
  currentVersion: "1.2.0",
  schedule: null,
  week: { runs: 30, failed: 4 },
  lastRun: {
    id: "3f2a91c0-5d1e-4c1a-9f3b-1d2e3f4a5b6c",
    phase: "faulted",
    createdAt: "2026-11-23T09:12:00.000Z",
  },
};

export const DAILY_DIGEST: Workflow = {
  namespace: "default",
  name: "daily-digest",
  title: "Daily digest",
  status: "active",
  on: true,
  currentVersion: "1.0.0",
  schedule: { kind: "cron", cron: "0 9 * * *" },
  week: { runs: 7, failed: 0 },
  lastRun: {
    id: "8a7b6c5d-4e3f-4a1b-8c2d-3e4f5a6b7c8d",
    phase: "completed",
    createdAt: "2026-11-23T09:00:00.000Z",
  },
};

export const LEAD_INTAKE: Workflow = {
  namespace: "sales",
  name: "lead-intake",
  title: "Lead intake",
  status: "active",
  on: false,
  currentVersion: "2.0.1",
  schedule: { kind: "on", stream: "com.example.lead.created" },
  week: { runs: 112, failed: 1 },
  lastRun: {
    id: "1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e",
    phase: "running",
    createdAt: "2026-11-23T10:02:00.000Z",
  },
};

export const MONTH_END: Workflow = {
  namespace: "billing",
  name: "month-end",
  title: "Month end",
  status: "active",
  on: false,
  currentVersion: null,
  schedule: null,
  week: { runs: 0, failed: 0 },
  lastRun: null,
};

export const WORKFLOWS: readonly Workflow[] = [
  ORDER_ROUTER,
  DAILY_DIGEST,
  LEAD_INTAKE,
  MONTH_END,
];

export const ROUTER_STRUCTURE: VersionStructure = {
  ...ROUTER_FLOW,
  summary: "Sends each order to the team that handles its type.",
  input: { schema: null },
};

const ADMINISTRATOR = { id: "user-1", name: "Administrator" };

export const ROUTER_VERSIONS: readonly Version[] = [
  {
    namespace: "sales",
    name: "order-router",
    version: "1.2.0",
    current: true,
    publishedBy: ADMINISTRATOR,
    publishedAt: "2026-11-23T08:20:00.000Z",
    runs: 24,
  },
  {
    namespace: "sales",
    name: "order-router",
    version: "1.1.0",
    current: false,
    publishedBy: ADMINISTRATOR,
    publishedAt: "2026-11-20T14:05:00.000Z",
    runs: 6,
  },
];

function runOf(id: string, phase: ListedInstance["phase"]): ListedInstance {
  return {
    id,
    namespace: "sales",
    name: "order-router",
    title: "Order router",
    version: "1.2.0",
    phase,
    trigger: "manual",
    test: false,
    createdAt: "2026-11-23T09:12:00.000Z",
    startedAt: "2026-11-23T09:12:01.000Z",
    endedAt: phase === "running" ? null : "2026-11-23T09:12:02.000Z",
    startedBy: ADMINISTRATOR,
    durationMs: phase === "running" ? null : 1000,
    waits: [],
  };
}

export const ROUTER_RUNS: Read<InstancePage> = {
  items: [
    runOf("3f2a91c0-5d1e-4c1a-9f3b-1d2e3f4a5b6c", "faulted"),
    runOf("4a3b2c1d-6e5f-4a7b-8c9d-0e1f2a3b4c5d", "completed"),
    runOf("5b4c3d2e-7f6a-4b8c-9d0e-1f2a3b4c5d6e", "running"),
  ],
  total: 3,
  exact: true,
  readAt: Date.parse("2026-11-23T09:15:00.000Z"),
};

export const NO_RUNS: Read<InstancePage> = {
  items: [],
  total: 0,
  exact: true,
  readAt: Date.parse("2026-11-23T09:15:00.000Z"),
};

const COUNTED_AT = "2026-11-23T09:15:00.000Z";

const ROUTER_WINDOWS = windowsOf("7d", COUNTED_AT, "UTC");

const NO_PHASES = {
  pending: 0,
  running: 0,
  waiting: 0,
  suspended: 0,
  completed: 0,
  faulted: 0,
  cancelled: 0,
};

const ROUTER_BUCKETS = ROUTER_WINDOWS.buckets.map((bucket, index) => {
  const completed = 2 + (index % 3);
  const faulted = index % 2;
  const counts = { ...NO_PHASES, completed, faulted };
  return { start: bucket.from, counts };
});

const ROUTER_TOTAL: InstanceCounts = {
  to: COUNTED_AT,
  buckets: ROUTER_BUCKETS,
  total: { ...NO_PHASES, completed: 20, faulted: 3, running: 1 },
  previous: {
    from: ROUTER_WINDOWS.previous.from,
    counts: { ...NO_PHASES, completed: 18, faulted: 5 },
  },
  now: { pending: 0, running: 1, waiting: 0, suspended: 0 },
};

export const ROUTER_COUNTS = {
  period: "7d",
  zone: "UTC",
  windows: ROUTER_WINDOWS,
  counts: ROUTER_TOTAL,
} as const;
