import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CanvasFrame } from "./canvas-frame";
import { CanvasLoading } from "./canvas-loading";

const meta = {
  title: "Spaces/Shell/Canvas frame",
  component: CanvasFrame,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="flex h-svh flex-col">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CanvasFrame>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  args: { children: <CanvasLoading /> },
};
