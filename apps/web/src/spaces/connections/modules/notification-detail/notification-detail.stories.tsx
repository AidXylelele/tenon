import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import { PageBody } from "@/libs/ui/composites/page-body";
import { ON_CALL_DETAIL } from "../../__shared_context/connections.test-support";
import { RUN_EVENTS } from "../../__shared_context/run-events.test-support";
import { NotificationPage } from "./notification-page";

const meta = {
  title: "Spaces/Connections/Notification",
  component: NotificationPage,
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: { pathname: `/notifications/${ON_CALL_DETAIL.id}` },
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
  args: { subscription: ON_CALL_DETAIL, runEvents: RUN_EVENTS },
} satisfies Meta<typeof NotificationPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Detail: Story = {};

export const NothingDeliveredYet: Story = {
  args: { subscription: { ...ON_CALL_DETAIL, deliveries: [] } },
};
