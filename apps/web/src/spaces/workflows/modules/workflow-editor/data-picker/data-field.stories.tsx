import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import { Announcer } from "@/libs/ui/composites/announcer";
import {
  AFTER_FETCH,
  AT_AN_ADDRESS,
  SAMPLES,
} from "./data-choices/data.test-support";
import { DataField } from "./data-field";

const meta = {
  component: DataField,
  decorators: [
    (Story) => (
      <Announcer>
        <TooltipProvider>
          <div className="flex w-[400px] flex-col gap-2 p-4">
            <label htmlFor="address" className="font-semibold">
              Address
            </label>
            <Story />
          </div>
        </TooltipProvider>
      </Announcer>
    ),
  ],
  args: {
    pointer: "/do/2/Post the items/with/endpoint",
    value: "",
    inputId: "address",
    describedBy: undefined,
    invalid: false,
    placeholder: "https://",
    data: AT_AN_ADDRESS,
    onText: fn(),
    onUse: fn(),
    onClear: fn(),
  },
} satisfies Meta<typeof DataField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TypedText: Story = {
  args: { value: "https://hooks.example.com/digest" },
};

export const DataReference: Story = {
  args: {
    value: "${ .slideshow.slides }",
    data: AFTER_FETCH,
    samples: SAMPLES,
  },
};

export const SecretReference: Story = {
  args: { value: "${ $secrets.SLACK_WEBHOOK_URL }" },
};

export const AnExpression: Story = {
  args: { value: '${ "https://example.com/" + (now | todate) }' },
};
