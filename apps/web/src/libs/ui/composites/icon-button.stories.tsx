import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  EllipsisIcon,
  MaximizeIcon,
  PlusIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";
import { TooltipProvider } from "../components/tooltip";
import { IconButton } from "./icon-button";

function IconButtons() {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center gap-1">
          <IconButton label="Zoom in" icon={ZoomInIcon} />
          <IconButton label="Zoom out" icon={ZoomOutIcon} />
          <IconButton label="Fit the flow to the view" icon={MaximizeIcon} />
        </div>
        <div className="flex items-center gap-3">
          <IconButton label="Step actions" icon={EllipsisIcon} size="icon-xs" />
          <IconButton
            label="Add a step"
            icon={PlusIcon}
            variant="outline"
            size="icon-xs"
            className="rounded-full"
          />
          <IconButton label="Zoom in" icon={ZoomInIcon} aria-disabled />
        </div>
      </div>
    </TooltipProvider>
  );
}

const meta = {
  title: "Design system/Composites/Icon button",
  component: IconButtons,
} satisfies Meta<typeof IconButtons>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Sizes: Story = {};
