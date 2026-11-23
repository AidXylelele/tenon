import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AuthLayout } from "../../__shared_context/auth-layout.test-support";
import { InvitationAcceptancePage } from "./invitation-acceptance-page";

const meta = {
  title: "Spaces/Identity/Accept invitation",
  component: InvitationAcceptancePage,
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/invitations/accept" },
    },
  },
  decorators: [
    (Story) => (
      <AuthLayout>
        <Story />
      </AuthLayout>
    ),
  ],
  args: {
    check: {
      kind: "valid",
      token: "a-token-from-the-email",
      invitation: { email: "grace@example.com", role: "editor" },
    },
  },
} satisfies Meta<typeof InvitationAcceptancePage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AcceptInvitation: Story = {};

export const ExpiredInvitation: Story = {
  args: {
    check: { kind: "refused", reason: "This invitation has expired." },
  },
};
