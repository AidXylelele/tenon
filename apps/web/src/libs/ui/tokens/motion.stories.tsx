import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { cn } from "cn";
import { useState } from "react";
import { Button } from "../components/button";

const DURATIONS = [
  {
    token: "--duration-fast",
    value: "150 ms",
    use: "hover, press, toggles, chips, tooltips",
  },
  {
    token: "--duration-panel",
    value: "200 ms",
    use: "panels, menus, popovers, dialogs",
  },
  { token: "--duration-page", value: "250 ms", use: "route changes" },
];

function Motion() {
  const [moved, setMoved] = useState(false);
  const offset = moved ? "translate-x-48" : "translate-x-0";
  const mover = cn(
    "block size-8 rounded-md bg-accent-solid transition-transform ease-standard",
    offset,
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <p className="max-w-prose text-muted-foreground">
        Every movement uses{" "}
        <code className="font-mono text-code">--ease-standard</code>,
        cubic-bezier(0.2, 0, 0, 1). Under prefers-reduced-motion every duration
        is 0.
      </p>
      <Button
        variant="outline"
        className="self-start"
        onClick={() => {
          setMoved((now) => !now);
        }}
      >
        Move
      </Button>
      <ul className="flex flex-col gap-4">
        {DURATIONS.map((duration) => {
          const timing = `var(${duration.token})`;
          return (
            <li key={duration.token} className="flex flex-col gap-1">
              <span>
                <code className="font-mono text-code">{duration.token}</code> ·{" "}
                {duration.value} ·{" "}
                <span className="text-muted-foreground">{duration.use}</span>
              </span>
              <span className={mover} style={{ transitionDuration: timing }} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const meta = {
  title: "Design system/Motion",
  component: Motion,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Motion>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Durations: Story = {};
