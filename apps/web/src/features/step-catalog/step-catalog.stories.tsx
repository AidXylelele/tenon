import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import type { EntryAction } from "@/operations/step-catalog";
import {
  TENON_VARIANTS,
  WITHOUT_SHELL,
} from "@/operations/step-catalog/hosts.test-support";
import type { StepCatalogProps } from "./interfaces";
import { StepCatalog } from "./step-catalog";

type PanelProps = Omit<StepCatalogProps, "onChoose" | "onClose">;

function CatalogPanel({
  variants,
  stepAbove,
  place,
  languageTerms,
}: PanelProps) {
  const [told, setTold] = useState("Nothing yet");

  function choose(action: EntryAction): void {
    const shown = JSON.stringify(action);
    setTold(shown);
  }

  function close(): void {
    setTold("Closed");
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col gap-4">
        <div className="w-100 rounded-lg border bg-surface">
          <StepCatalog
            variants={variants}
            stepAbove={stepAbove}
            place={place}
            languageTerms={languageTerms}
            onChoose={choose}
            onClose={close}
          />
        </div>
        <output
          aria-label="Told the editor"
          className="font-mono text-caption text-muted-foreground"
        >
          {told}
        </output>
      </div>
    </TooltipProvider>
  );
}

const meta = {
  component: CatalogPanel,
  args: {
    variants: TENON_VARIANTS,
    stepAbove: "Fetch the digest",
    place: "after Fetch the digest",
    languageTerms: false,
  },
} satisfies Meta<typeof CatalogPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AfterAStep: Story = {};

export const OnABranch: Story = {
  args: {
    stepAbove: "Post to the webhook",
    place: "on the branch “has items” of Has items?",
  },
};

export const InsideABlock: Story = {
  args: { stepAbove: null, place: "inside Prepare the batch" },
};

export const WithNoStepAbove: Story = {
  args: { stepAbove: null, place: "after Every day at 09:00 UTC" },
};

export const HostWithoutShellOrContainer: Story = {
  args: { variants: WITHOUT_SHELL },
};

export const WithLanguageTerms: Story = {
  args: { languageTerms: true },
};

export const SearchWithNoMatch: Story = {
  play: async ({ canvas, userEvent }) => {
    const search = await canvas.findByRole("combobox", {
      name: "Find a kind of step",
    });
    await userEvent.type(search, "slack channel");
  },
};

export const KeyboardActiveOption: Story = {
  play: async ({ canvas, userEvent }) => {
    const search = await canvas.findByRole("combobox", {
      name: "Find a kind of step",
    });
    await userEvent.type(search, "{ArrowDown}{ArrowDown}");
  },
};
