import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import { PageBody } from "@/libs/ui/composites/page-body";
import { WORKFLOWS } from "../../__shared_context/workflows.test-support";
import { WorkflowListPage } from "./workflow-list-page";

const meta = {
  title: "Spaces/Workflows/Workflow list",
  component: WorkflowListPage,
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true, navigation: { pathname: "/workflows" } },
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
    status: "active",
    q: undefined,
    workflows: WORKFLOWS,
    author: true,
    firstPage: null,
    nextPage: "/workflows?cursor=next",
  },
} satisfies Meta<typeof WorkflowListPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const List: Story = {};

export const FirstWorkflow: Story = {
  args: { workflows: [], nextPage: null },
};

export const FirstWorkflowForAViewer: Story = {
  args: { workflows: [], nextPage: null, author: false },
};

export const NoMatch: Story = {
  args: { workflows: [], nextPage: null, q: "invoice" },
};

export const NothingArchived: Story = {
  args: { workflows: [], nextPage: null, status: "archived" },
};
