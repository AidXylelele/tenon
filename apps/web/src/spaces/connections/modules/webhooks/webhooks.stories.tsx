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
  args: { webhooks: WEBHOOKS },
} satisfies Meta<typeof WebhooksPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const List: Story = {};

export const NoWebhooks: Story = {
  args: { webhooks: [] },
};

export const SendATestEvent: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/webhooks", query: { test: "1" } },
    },
  },
};

export const NewWebhook: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/webhooks", query: { new: "1" } },
    },
  },
};
