import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { NewPasswordField } from "./new-password-field";

const meta = {
  title: "Features/New password field",
  component: NewPasswordField,
  decorators: [
    (Story) => (
      <form className="max-w-sm p-6">
        <Story />
      </form>
    ),
  ],
  args: { name: "password", label: "New password" },
} satisfies Meta<typeof NewPasswordField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Field: Story = {};

export const WithANote: Story = {
  args: {
    name: "newPassword",
    note: "This browser stays signed in; every other session ends.",
  },
};
