import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import { PageBody } from "@/libs/ui/composites/page-body";
import {
  DAILY_DIGEST,
  MONTH_END,
  NO_RUNS,
  ORDER_ROUTER,
  ROUTER_RUNS,
  ROUTER_STRUCTURE,
  ROUTER_VERSIONS,
} from "../../__shared_context/workflows.test-support";
import { WorkflowPage } from "./workflow-page";

const meta = {
  title: "Spaces/Workflows/Workflow",
  component: WorkflowPage,
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/workflows/sales/order-router" },
    },
  },
  decorators: [
    (Story) => (
      <TooltipProvider delayDuration={300}>
        <PageBody>
          <Story />
        </PageBody>
      </TooltipProvider>
    ),
  ],
  args: {
    workflow: ORDER_ROUTER,
    tab: "overview",
    versions: ROUTER_VERSIONS,
    runs: ROUTER_RUNS,
    structure: ROUTER_STRUCTURE,
    author: true,
    operator: true,
  },
} satisfies Meta<typeof WorkflowPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Overview: Story = {};

export const StartsOnASchedule: Story = {
  args: { workflow: DAILY_DIGEST, runs: NO_RUNS },
};

export const RunsTab: Story = {
  args: { tab: "runs" },
};

export const VersionsTab: Story = {
  args: { tab: "versions" },
};

export const NeverPublished: Story = {
  args: {
    workflow: MONTH_END,
    versions: [],
    runs: NO_RUNS,
    structure: null,
  },
};

export const Archived: Story = {
  args: { workflow: { ...ORDER_ROUTER, status: "archived" } },
};

export const ForAViewer: Story = {
  args: { author: false, operator: false },
};

export const RunDialog: Story = {
  args: { tab: "versions" },
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/workflows/sales/order-router",
        query: { start: "1" },
      },
    },
  },
};
