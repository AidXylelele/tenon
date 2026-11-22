import type { Meta, StoryObj } from "@storybook/nextjs-vite";

interface Sample {
  readonly token: string;
  readonly size: string;
  readonly className: string;
  readonly text: string;
}

const SAMPLES: readonly Sample[] = [
  {
    token: "--text-title",
    size: "20 / 28 · 600",
    className: "text-title font-semibold",
    text: "Daily digest",
  },
  {
    token: "--text-body",
    size: "14 / 20 · 400",
    className: "text-body",
    text: "Fetch the open orders and post the summary to the team channel.",
  },
  {
    token: "--text-body",
    size: "14 / 20 · 600",
    className: "text-body font-semibold",
    text: "How it starts",
  },
  {
    token: "--text-caption",
    size: "12 / 16 · 400",
    className: "text-caption text-muted-foreground",
    text: "Runs every day at 09:00, in UTC",
  },
  {
    token: "caps",
    size: "12 / 16 · 600 · caps",
    className: "caps text-muted-foreground",
    text: "Automate",
  },
  {
    token: "--text-code",
    size: "12 / 20 · mono",
    className: "font-mono text-code",
    text: "sales/order-router · ${ .orders | length }",
  },
  {
    token: "figure",
    size: "20 / 28 · 600 · tabular",
    className: "figure",
    text: "1,284",
  },
];

function TypeScale() {
  return (
    <dl className="flex max-w-3xl flex-col gap-6 p-6">
      {SAMPLES.map((sample) => (
        <div
          key={sample.size}
          className="grid grid-cols-[12rem_1fr] items-baseline gap-4"
        >
          <dt className="flex flex-col">
            <code className="font-mono text-code">{sample.token}</code>
            <span className="text-caption text-muted-foreground">
              {sample.size}
            </span>
          </dt>
          <dd className={sample.className}>{sample.text}</dd>
        </div>
      ))}
    </dl>
  );
}

const meta = {
  title: "Design system/Type",
  component: TypeScale,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof TypeScale>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Scale: Story = {};
