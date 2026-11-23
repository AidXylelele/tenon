import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AuthLayout } from "../../__shared_context/auth-layout.test-support";
import { PasswordReset } from "./password-reset";

const meta = {
  title: "Spaces/Identity/Reset password",
  component: PasswordReset,
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true, navigation: { pathname: "/reset-password" } },
  },
  decorators: [
    (Story) => (
      <AuthLayout>
        <Story />
      </AuthLayout>
    ),
  ],
  args: { query: { token: "a-token-from-the-email" } },
} satisfies Meta<typeof PasswordReset>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ResetPassword: Story = {};

export const IncompleteLink: Story = {
  args: { query: {} },
};
