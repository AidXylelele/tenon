import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import {
  AFTER_FETCH,
  AT_AN_ADDRESS,
  FIRST_STEP,
  SAMPLES,
} from "./data-choices/data.test-support";
import { DataPicker } from "./data-picker";

const meta = {
  component: DataPicker,
  decorators: [
    (Story) => (
      <div className="flex h-[560px] w-[440px] justify-end p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    data: AFTER_FETCH,
    onPick: fn(),
    onWriteExpression: fn(),
  },
  play: async ({ canvas, userEvent }) => {
    const insert = await canvas.findByRole("button", { name: "Insert data" });
    await userEvent.click(insert);
  },
} satisfies Meta<typeof DataPicker>;

export default meta;

type Story = StoryObj<typeof meta>;

export const BeforeATest: Story = {};

export const FieldsAfterATest: Story = {
  args: { samples: SAMPLES },
};

export const NoStepBefore: Story = {
  args: { data: FIRST_STEP },
};

export const SecretsForAnAddress: Story = {
  args: { data: AT_AN_ADDRESS },
};

export const FilteredByTyping: Story = {
  args: { samples: SAMPLES },
  play: async ({ canvas, userEvent }) => {
    const insert = await canvas.findByRole("button", { name: "Insert data" });
    await userEvent.click(insert);
    await userEvent.keyboard("slide");
  },
};

export const ATypedFieldName: Story = {
  play: async ({ canvas, userEvent }) => {
    const insert = await canvas.findByRole("button", { name: "Insert data" });
    await userEvent.click(insert);
    await userEvent.keyboard("items");
  },
};

export const Reading: Story = {
  args: { data: null },
};
