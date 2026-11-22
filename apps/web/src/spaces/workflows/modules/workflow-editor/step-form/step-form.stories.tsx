import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import {
  FETCH_FORM,
  FETCH_STEP,
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
import { StepForm } from "./step-form";

const meta = {
  component: StepForm,
  decorators: [
    (Story) => (
      <TooltipProvider>
        <div className="w-[400px] p-4">
          <Story />
        </div>
      </TooltipProvider>
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
