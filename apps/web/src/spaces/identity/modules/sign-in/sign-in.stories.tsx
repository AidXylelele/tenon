import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AuthLayout } from "../../__shared_context/auth-layout.test-support";
import { SignIn } from "./sign-in";

const meta = {
  title: "Spaces/Identity/Sign in",
  component: SignIn,
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true, navigation: { pathname: "/sign-in" } },
  },
  decorators: [
    (Story) => (
      <AuthLayout>
        <Story />
      </AuthLayout>
    ),
  ],
  args: { query: {} },
} satisfies Meta<typeof SignIn>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SignInForm: Story = {};

export const AfterTheSessionEnded: Story = {
  args: { query: { reason: "ended" } },
};
