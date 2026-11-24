import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PlayIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "./button";
import { Spinner } from "./spinner";

const VARIANTS = [
  "default",
  "outline",
  "ghost",
  "destructive",
  "link",
] as const;

function ButtonStates() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <table className="border-separate border-spacing-x-4 border-spacing-y-3">
        <thead>
          <tr className="text-left text-caption text-muted-foreground">
            <th>Variant</th>
            <th>Default</th>
            <th>With icon</th>
            <th>Disabled</th>
            <th>Disabled, with a reason</th>
            <th>Loading</th>
          </tr>
        </thead>
        <tbody>
          {VARIANTS.map((variant) => (
            <tr key={variant}>
              <td className="font-mono text-code">{variant}</td>
              <td>
                <Button variant={variant}>Run</Button>
              </td>
              <td>
                <Button variant={variant}>
                  <PlayIcon data-icon="inline-start" />
                  Run
                </Button>
              </td>
              <td>
                <Button variant={variant} disabled>
                  Run
                </Button>
              </td>
              <td>
                <Button
                  variant={variant}
                  aria-disabled
                  title="Publish the draft first"
                >
                  Run
                </Button>
              </td>
              <td>
                <Button variant={variant} aria-busy>
                  <Spinner data-icon="inline-start" />
                  Run
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm">Small, 28</Button>
        <Button>Default, 32</Button>
        <Button size="lg">Large, 40</Button>
        <Button size="icon-sm" variant="ghost" aria-label="Add a step">
          <PlusIcon />
        </Button>
        <Button size="icon" variant="outline" aria-label="Add a step">
          <PlusIcon />
        </Button>
        <Button size="icon" variant="destructive" aria-label="Delete">
          <Trash2Icon />
        </Button>
      </div>
    </div>
  );
}

const meta = {
  title: "Design system/Components/Button",
  component: ButtonStates,
} satisfies Meta<typeof ButtonStates>;

export default meta;

type Story = StoryObj<typeof meta>;

export const States: Story = {};

export const Focused: Story = {
  render: () => (
    <div className="flex gap-3 p-6">
      <Button variant="outline">Cancel</Button>
      <Button autoFocus>Publish</Button>
    </div>
  ),
};
