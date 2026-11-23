import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import { PageBody } from "@/libs/ui/composites/page-body";
import { WEBHOOKS } from "../../__shared_context/connections.test-support";
import { WebhooksPage } from "./webhooks-page";

const meta = {
  title: "Spaces/Connections/Webhooks",
  component: WebhooksPage,
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true, navigation: { pathname: "/webhooks" } },
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
  args: { webhooks: WEBHOOKS, testing: false, creating: false },
} satisfies Meta<typeof WebhooksPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const List: Story = {};

export const NoWebhooks: Story = {
  args: { webhooks: [] },
};

export const SendATestEvent: Story = {
  args: { testing: true },
};

export const NewWebhook: Story = {
  args: { creating: true },
};
