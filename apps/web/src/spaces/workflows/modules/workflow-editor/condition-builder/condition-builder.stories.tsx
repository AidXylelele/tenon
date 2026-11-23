import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import {
  AFTER_FETCH,
  SAMPLES,
} from "../data-picker/data-choices/data.test-support";
import { ConditionBuilder } from "./condition-builder";
import type { PickerSlot } from "./interfaces";
import {
  AN_EXPRESSION,
  BEFORE_TODAY,
  NO_ROWS,
  NON_CANONICAL_TEXT,
  TWO_ROWS_ALL,
  TWO_ROWS_ANY,
  TWO_ROWS_TEXT,
} from "./readings.test-support";

function StandInPicker({ label, onPick }: PickerSlot) {
  return (
    <button
      type="button"
      className="rounded-md border px-3 py-1 text-body font-semibold"
      onClick={() => {
        onPick({
          value: "${ .slideshow.slides }",
          expression: ".slideshow.slides",
          export: null,
        });
      }}
    >
      {label}
    </button>
  );
}

const meta = {
  component: ConditionBuilder,
  decorators: [
    (Story) => (
      <TooltipProvider>
        <div className="w-[400px] p-4">
          <div
            role="group"
            aria-labelledby="branch"
            className="flex flex-col gap-3 rounded-lg border bg-surface p-3"
          >
            <h4 id="branch" className="font-semibold">
              Has items
            </h4>
            <Story />
          </div>
        </div>
      </TooltipProvider>
    ),
  ],
  args: {
    pointer: "/do/1/Has items/switch/0/Has items/when",
    text: TWO_ROWS_TEXT,
    required: true,
    labelledBy: "branch",
    describedBy: undefined,
    invalid: false,
    reading: TWO_ROWS_ALL,
    data: AFTER_FETCH,
    samples: SAMPLES,
    renderPicker: (slot: PickerSlot) => <StandInPicker {...slot} />,
    onEdit: fn(),
  },
} satisfies Meta<typeof ConditionBuilder>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TwoRowsAllMustHold: Story = {};

export const TwoRowsAnyMayHold: Story = {
  args: { reading: TWO_ROWS_ANY },
};

export const NoConditionYet: Story = {
  args: { text: "", reading: NO_ROWS },
};

export const TimesAndDataCompared: Story = {
  args: { text: "", reading: BEFORE_TODAY },
};

export const ANonCanonicalExpressionOpensAsAnExpression: Story = {
  args: { text: NON_CANONICAL_TEXT, reading: AN_EXPRESSION },
};

export const WrittenAsAnExpressionByChoice: Story = {
  play: async ({ canvas, userEvent }) => {
    const write = await canvas.findByRole("button", {
      name: "Write an expression",
    });
    await userEvent.click(write);
  },
};

export const ReadingTheCondition: Story = {
  args: { reading: null },
};
