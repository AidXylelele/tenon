import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ConditionReading } from "language-server/protocol";
import { fn } from "storybook/test";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import { Announcer } from "@/libs/ui/composites/announcer";
import {
  FETCH_FORM,
  FETCH_STEP,
  formWith,
  POST_FORM,
  POST_STEP,
  REPORT_FORM,
  REPORT_INNER_STEP,
  RETRYING,
  SCRIPT_FORM,
  SCRIPT_STEP,
  SET_FORM,
  SET_STEP,
  SWITCH_FORM,
  SWITCH_STEP,
  WAIT_FORM,
  WAIT_STEP,
} from "../form-fields/forms.test-support";
import { ConditionBuilder } from "../condition-builder";
import type { PickerSlot } from "../condition-builder";
import {
  AN_EXPRESSION,
  NON_CANONICAL_TEXT,
} from "../condition-builder/readings.test-support";
import { DataField, DataPicker } from "../data-picker";
import {
  AFTER_FETCH,
  AT_AN_ADDRESS,
  SAMPLES,
} from "../data-picker/data-choices/data.test-support";
import type { ConditionSlot, DataSlot } from "./interfaces";
import { StepForm } from "./step-form";

const HAS_ITEMS_READING: ConditionReading = {
  kind: "condition",
  condition: {
    join: "all",
    rows: [
      { left: ".slideshow.slides", comparison: "isNotEmpty", right: null },
    ],
  },
};

const ROUTED_BY_AN_EXPRESSION = formWith(SWITCH_FORM, "switch", [
  { "Has items": { when: NON_CANONICAL_TEXT, then: "continue" } },
  { default: { then: "end" } },
]);

function picker({ label, onPick }: PickerSlot) {
  return (
    <DataPicker
      data={AFTER_FETCH}
      samples={SAMPLES}
      onlyPaths
      label={label}
      onPick={onPick}
    />
  );
}

function builder(slot: ConditionSlot) {
  const reading =
    slot.text === NON_CANONICAL_TEXT ? AN_EXPRESSION : HAS_ITEMS_READING;
  return (
    <ConditionBuilder
      {...slot}
      reading={reading}
      data={AFTER_FETCH}
      samples={SAMPLES}
      renderPicker={picker}
      onEdit={fn()}
    />
  );
}

function dataField(slot: DataSlot) {
  return <DataField {...slot} data={AT_AN_ADDRESS} />;
}

const meta = {
  component: StepForm,
  decorators: [
    (Story) => (
      <Announcer>
        <TooltipProvider>
          <div className="w-[400px] p-4">
            <Story />
          </div>
        </TooltipProvider>
      </Announcer>
    ),
  ],
  args: {
    step: FETCH_STEP,
    form: FETCH_FORM,
    protection: null,
    revealProblems: false,
    languageTerms: false,
    onEdit: fn(),
  },
} satisfies Meta<typeof StepForm>;

export default meta;

type Story = StoryObj<typeof meta>;

export const HttpEssentials: Story = {};

export const HttpMoreOptions: Story = {
  args: { step: POST_STEP, form: POST_FORM },
  play: async ({ canvas, userEvent }) => {
    const more = await canvas.findByText("More options");
    await userEvent.click(more);
  },
};

export const HttpAddressToFill: Story = {
  args: { step: POST_STEP, form: POST_FORM },
};

export const HttpProblemAfterLeaving: Story = {
  args: { step: POST_STEP, form: POST_FORM },
  play: async ({ canvas, userEvent }) => {
    const address = await canvas.findByLabelText("Address");
    await userEvent.click(address);
    await userEvent.tab();
  },
};

export const WithLanguageTerms: Story = {
  args: { step: POST_STEP, form: POST_FORM, languageTerms: true },
};

export const SwitchBranches: Story = {
  args: { step: SWITCH_STEP, form: SWITCH_FORM },
};

export const SetDataKeepsIncoming: Story = {
  args: { step: SET_STEP, form: SET_FORM },
};

export const ScriptResult: Story = {
  args: { step: SCRIPT_STEP, form: SCRIPT_FORM },
};

export const WaitDuration: Story = {
  args: { step: WAIT_STEP, form: WAIT_FORM },
};

export const FailureWithRetrySettings: Story = {
  args: {
    step: REPORT_INNER_STEP,
    form: REPORT_FORM,
    protection: RETRYING,
  },
  play: async ({ canvas, userEvent }) => {
    const failure = await canvas.findByText("If this step fails");
    await userEvent.click(failure);
  },
};

export const HttpWithTheDataPicker: Story = {
  args: { step: POST_STEP, form: POST_FORM, renderData: dataField },
  play: async ({ canvas, userEvent }) => {
    const [insert] = await canvas.findAllByRole("button", {
      name: "Insert data",
    });

    if (insert !== undefined) await userEvent.click(insert);
  },
};

export const SwitchWithTheBuilder: Story = {
  args: { step: SWITCH_STEP, form: SWITCH_FORM, renderCondition: builder },
};

export const SwitchWithAnExpression: Story = {
  args: {
    step: SWITCH_STEP,
    form: ROUTED_BY_AN_EXPRESSION,
    renderCondition: builder,
  },
};
