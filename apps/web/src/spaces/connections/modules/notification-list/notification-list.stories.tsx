import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import { PageBody } from "@/libs/ui/composites/page-body";
import { SUBSCRIPTIONS } from "../../__shared_context/connections.test-support";
import { RUN_EVENTS } from "../../__shared_context/run-events.test-support";
import { NotificationListPage } from "./notification-list-page";

const meta = {
  title: "Spaces/Connections/Notifications",
  component: NotificationListPage,
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true, navigation: { pathname: "/notifications" } },
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
  args: { subscriptions: SUBSCRIPTIONS, runEvents: RUN_EVENTS },
} satisfies Meta<typeof NotificationListPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const List: Story = {};

export const NoNotifications: Story = {
  args: { subscriptions: [] },
};
