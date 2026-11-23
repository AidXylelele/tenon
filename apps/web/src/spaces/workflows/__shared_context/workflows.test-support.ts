import type { Workflow } from "@/libs/data-access/types";

export const ORDER_ROUTER: Workflow = {
  namespace: "sales",
  name: "order-router",
  status: "active",
  on: false,
  currentVersion: "1.2.0",
  schedule: null,
  starts: 30,
  lastRun: {
    id: "3f2a91c0-5d1e-4c1a-9f3b-1d2e3f4a5b6c",
    phase: "faulted",
    createdAt: "2026-11-23T09:12:00.000Z",
  },
};

export const DAILY_DIGEST: Workflow = {
  namespace: "default",
  name: "daily-digest",
  status: "active",
  on: true,
  currentVersion: "1.0.0",
  schedule: { kind: "cron", cron: "0 9 * * *" },
  starts: 7,
  lastRun: {
    id: "8a7b6c5d-4e3f-4a1b-8c2d-3e4f5a6b7c8d",
    phase: "completed",
    createdAt: "2026-11-23T09:00:00.000Z",
  },
};

export const LEAD_INTAKE: Workflow = {
  namespace: "sales",
  name: "lead-intake",
  status: "active",
  on: false,
  currentVersion: "2.0.1",
  schedule: { kind: "on", stream: "com.example.lead.created" },
  starts: 112,
  lastRun: {
    id: "1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e",
    phase: "running",
    createdAt: "2026-11-23T10:02:00.000Z",
  },
};

export const MONTH_END: Workflow = {
  namespace: "billing",
  name: "month-end",
  status: "active",
  on: false,
  currentVersion: null,
  schedule: null,
  starts: 0,
  lastRun: null,
};

export const WORKFLOWS: readonly Workflow[] = [
  ORDER_ROUTER,
  DAILY_DIGEST,
  LEAD_INTAKE,
  MONTH_END,
];
