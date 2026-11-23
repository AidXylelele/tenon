import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ViewerLine, ViewerNotice } from "./viewer-notice";

const meta = {
  title: "Features/Viewer notice",
  decorators: [
    (Story) => (
      <div className="max-w-2xl p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Notice: Story = {
  render: () => (
    <ViewerNotice what="Secrets hold the passwords, tokens and keys your steps call services with." />
  ),
};

export const Line: Story = {
  render: () => <ViewerLine />,
};
