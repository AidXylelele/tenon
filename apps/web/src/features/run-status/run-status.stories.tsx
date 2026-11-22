import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { Phase } from "@/libs/data-access/types";
import { PhaseCounts } from "./phase-counts";

const meta = {
  component: PhaseCounts,
} satisfies Meta<typeof PhaseCounts>;

export default meta;

type Story = StoryObj<typeof meta>;

export const LastDay: Story = {
  args: {
    id: "last-day",
    title: "Last 24 hours",
    counts: {
      pending: 0,
      running: 2,
      waiting: 0,
      suspended: 0,
      completed: 12,
      faulted: 1,
      cancelled: 0,
    },
    hrefOf: (phase: Phase) => `/runs?phase=${phase}`,
  },
};
