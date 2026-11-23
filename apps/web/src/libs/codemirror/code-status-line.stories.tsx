import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CodeStatusLine } from "./code-status-line";

const meta = {
  component: CodeStatusLine,
  args: { problems: [], note: "Ruff", message: "" },
  decorators: [
    (Story) => (
      <div className="w-92 rounded-md border bg-surface">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CodeStatusLine>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Clean: Story = {};

export const WithAProblem: Story = {
  args: {
    problems: [{ line: 3, message: "“(” was never closed", severity: "error" }],
  },
};

export const WithAWarningAndAMessage: Story = {
  args: {
    problems: [
      {
        line: 1,
        message: "“os” is imported but never used",
        severity: "warning",
      },
    ],
    message: "Fix line 3 first: unexpected EOF while parsing.",
  },
};
