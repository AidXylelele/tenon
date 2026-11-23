import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ListedInstance, Phase } from "@/libs/data-access/types";
import { RunPager } from "./run-pager";
import { RunTable } from "./run-table";

const RUNS: readonly ListedInstance[] = [
  {
    id: "4f2a9c10-0000-4000-8000-000000000001",
    namespace: "sales",
    name: "route-lead",
    title: "Route a lead",
    version: "1.2.0",
    phase: "faulted",
    trigger: "schedule",
    test: false,
    createdAt: "2026-11-23T09:00:00Z",
    startedAt: "2026-11-23T09:00:01Z",
    endedAt: "2026-11-23T09:00:03Z",
    startedBy: null,
    durationMs: 2_000,
    waits: [],
  },
  {
    id: "4f2a9c10-0000-4000-8000-000000000002",
    namespace: "sales",
    name: "route-lead",
    title: "Route a lead",
    version: "draft",
    phase: "completed",
    trigger: "manual",
    test: true,
    createdAt: "2026-11-23T08:40:00Z",
    startedAt: "2026-11-23T08:40:01Z",
    endedAt: "2026-11-23T08:40:02Z",
    startedBy: { id: "u-1", name: "Ada Lovelace" },
    durationMs: 96,
    waits: [],
  },
];

function PhaseWord({ phase }: { readonly phase: Phase }) {
  return <span>{phase}</span>;
}

function hrefOf(page: number, size: number): string {
  return `/runs?page=${String(page)}&size=${String(size)}`;
}

function sortHrefOf(sort: string): string {
  return `/runs?sort=${sort}`;
}

interface RunsPageProps {
  readonly total: number;
  readonly exact: boolean;
}

function RunsPage({ total, exact }: RunsPageProps) {
  const order = { sort: "duration" as const, hrefOf: sortHrefOf };

  return (
    <div className="flex flex-col gap-3 p-4">
      <RunTable
        runs={RUNS}
        Status={PhaseWord}
        order={order}
        empty={<p>No runs</p>}
      />
      <RunPager
        page={3}
        size={50}
        total={total}
        exact={exact}
        hrefOf={hrefOf}
      />
    </div>
  );
}

const meta = {
  component: RunsPage,
} satisfies Meta<typeof RunsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Paged: Story = { args: { total: 1234, exact: true } };

export const PastTheCount: Story = { args: { total: 10_000, exact: false } };
