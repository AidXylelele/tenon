import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PageBody } from "@/libs/ui/composites/page-body";
import { SettingsHeader } from "../../__shared_context/settings-header";
import { AccountPage } from "./account-page";

const meta = {
  title: "Spaces/Settings/Account",
  component: AccountPage,
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/settings/account" },
    },
  },
  decorators: [
    (Story) => (
      <PageBody>
        <SettingsHeader administrator />
        <Story />
      </PageBody>
    ),
  ],
  args: {
    user: {
      id: "user-1",
      email: "ada@example.com",
      name: "Ada Lovelace",
      role: "admin",
    },
  },
} satisfies Meta<typeof AccountPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Account: Story = {};

export const AViewer: Story = {
  args: {
    user: {
      id: "user-2",
      email: "grace@example.com",
      name: "Grace Hopper",
      role: "viewer",
    },
  },
};
