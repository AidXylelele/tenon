import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AuthLayout } from "../../__shared_context/auth-layout.test-support";
import { PasswordRecovery } from "./password-recovery";

const meta = {
  title: "Spaces/Identity/Forgot password",
  component: PasswordRecovery,
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/forgot-password" },
    },
  },
  decorators: [
    (Story) => (
      <AuthLayout>
        <Story />
      </AuthLayout>
    ),
  ],
} satisfies Meta<typeof PasswordRecovery>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ForgotPassword: Story = {};
