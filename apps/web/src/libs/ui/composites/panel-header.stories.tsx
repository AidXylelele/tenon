import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useId } from "react";
import { fn } from "storybook/test";
import { TooltipProvider } from "../components/tooltip";
import { PanelHeader } from "./panel-header";

interface PanelProps {
  readonly title: string;
  readonly subtitle: string;
  readonly onBack?: () => void;
  readonly backLabel?: string;
  readonly onClose?: () => void;
}

function Panel({ title, subtitle, onBack, backLabel, onClose }: PanelProps) {
  const titleId = useId();

  return (
    <TooltipProvider delayDuration={300}>
      <aside
        aria-labelledby={titleId}
        className="ml-auto flex h-svh w-90 flex-col border-l border-border bg-background"
      >
        <PanelHeader
          title={title}
          titleId={titleId}
          subtitle={subtitle}
          onBack={onBack}
          backLabel={backLabel}
          onClose={onClose}
        />
      </aside>
    </TooltipProvider>
  );
}

const meta = {
  title: "Design system/Components/Panel header",
  component: Panel,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Panel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithClose: Story = {
  args: {
    title: "Add a step",
    subtitle: "After Fetch invoices",
    onClose: fn(),
  },
};

export const WithBack: Story = {
  args: {
    title: "Test run of the draft",
    subtitle: "Nothing is published; the run is labelled Test and not counted",
    onBack: fn(),
    backLabel: "Back to the step list",
  },
};
