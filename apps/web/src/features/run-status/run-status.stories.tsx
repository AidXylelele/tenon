import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { Phase, TaskStatus } from "@/libs/data-access/types";
import { PHASES } from "@/operations/run-progress";
import { PhaseStatus, TaskStatusOf } from "./run-status";

const TASKS: readonly TaskStatus[] = [
  "running",
  "completed",
  "faulted",
  "cancelled",
  "skipped",
];

function Statuses() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <ul aria-label="Runs" className="flex flex-wrap gap-4">
        {PHASES.map((phase: Phase) => (
          <li key={phase}>
            <PhaseStatus phase={phase} />
          </li>
        ))}
      </ul>
      <ul aria-label="Steps" className="flex flex-wrap gap-4">
        {TASKS.map((status) => (
          <li key={status}>
            <TaskStatusOf status={status} />
          </li>
        ))}
      </ul>
    </div>
  );
}

const meta = {
  component: Statuses,
} satisfies Meta<typeof Statuses>;

export default meta;

type Story = StoryObj<typeof meta>;

export const EveryStatus: Story = {};
