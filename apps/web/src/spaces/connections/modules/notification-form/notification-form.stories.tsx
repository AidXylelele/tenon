import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PageBody } from "@/libs/ui/composites/page-body";
import { RUN_EVENTS } from "../../__shared_context/run-events.test-support";
import { NotificationFormPage } from "./notification-form-page";

const meta = {
  title: "Spaces/Connections/New notification",
  component: NotificationFormPage,
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/notifications/new" },
    },
  },
  decorators: [
    (Story) => (
      <PageBody>
        <Story />
      </PageBody>
    ),
  ],
  args: {
    secretNames: ["BILLING_TOKEN", "CRM_API_TOKEN"],
    presets: RUN_EVENTS,
  },
} satisfies Meta<typeof NotificationFormPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Form: Story = {};

export const NoSecretsYet: Story = {
  args: { secretNames: [] },
};
