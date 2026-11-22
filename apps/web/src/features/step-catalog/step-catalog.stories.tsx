import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import type { EntryAction } from "@/operations/step-catalog";
import {
  TENON_VARIANTS,
  WITHOUT_SHELL,
} from "@/operations/step-catalog/hosts.test-support";
import type { StepCatalogProps } from "./interfaces";
import { StepCatalog } from "./step-catalog";

type PanelProps = Omit<StepCatalogProps, "onChoose">;

function CatalogPanel({ variants, stepAbove, languageTerms }: PanelProps) {
  const [told, setTold] = useState("Nothing yet");

  function choose(action: EntryAction): void {
    const shown = JSON.stringify(action);
    setTold(shown);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="w-100 rounded-lg border bg-surface p-4">
        <StepCatalog
          variants={variants}
          stepAbove={stepAbove}
          languageTerms={languageTerms}
          onChoose={choose}
        />
      </div>
      <output
        aria-label="Told the editor"
        className="font-mono text-caption text-muted-foreground"
      >
        {told}
      </output>
    </div>
  );
}

const meta = {
  component: CatalogPanel,
  args: {
    variants: TENON_VARIANTS,
    stepAbove: "Fetch the digest",
    languageTerms: false,
  },
} satisfies Meta<typeof CatalogPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AfterAStep: Story = {};

export const OnABranch: Story = {
  args: { stepAbove: "Post to the webhook" },
};

export const WithNoStepAbove: Story = {
  args: { stepAbove: null },
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
