import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ColumnFrame } from "./column-frame";
import { ColumnLoading } from "./column-loading";

const meta = {
  title: "Spaces/Shell/Column frame",
  component: ColumnFrame,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ColumnFrame>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  args: { children: <ColumnLoading /> },
};
