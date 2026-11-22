import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  CircleCheckIcon,
  CirclePauseIcon,
  CirclePlayIcon,
  CircleSlashIcon,
  CircleXIcon,
  InfoIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Status, type StatusLook } from "../composites/status";
import { Alert, AlertDescription, AlertTitle } from "./alert";
import { Badge } from "./badge";

const LOOKS: readonly StatusLook[] = [
  { tone: "info", icon: CirclePlayIcon, label: "Running" },
  { tone: "success", icon: CircleCheckIcon, label: "Succeeded" },
  { tone: "warning", icon: CirclePauseIcon, label: "Paused" },
  { tone: "danger", icon: CircleXIcon, label: "Failed" },
  { tone: "neutral", icon: CircleSlashIcon, label: "Cancelled" },
];

const BADGES = [
  "default",
  "secondary",
  "outline",
  "success",
  "warning",
  "destructive",
  "info",
] as const;

function StatusStates() {
  return (
    <div className="flex max-w-3xl flex-col gap-8 p-6">
      <section className="flex flex-col gap-3">
        <h2 className="heading-2">Status label</h2>
        <div className="flex flex-wrap gap-6">
          {LOOKS.map((look) => (
            <Status key={look.label} look={look} />
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="heading-2">Badge</h2>
        <div className="flex flex-wrap gap-2">
          {BADGES.map((variant) => (
            <Badge key={variant} variant={variant}>
              {variant}
            </Badge>
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="heading-2">Banner</h2>
        <Alert>
          <InfoIcon />
          <AlertTitle>Next starts</AlertTitle>
          <AlertDescription>
            Mon 23 Nov 09:00 · Tue 24 Nov 09:00
          </AlertDescription>
        </Alert>
        <Alert variant="success">
          <CircleCheckIcon />
          <AlertTitle>Published</AlertTitle>
          <AlertDescription>
            Version 1.2.0 starts its runs now.
          </AlertDescription>
        </Alert>
        <Alert variant="warning">
          <TriangleAlertIcon />
          <AlertTitle>Retrying</AlertTitle>
          <AlertDescription>
            The address did not answer; trying again.
          </AlertDescription>
        </Alert>
        <Alert variant="destructive">
          <CircleXIcon />
          <AlertTitle>The run failed</AlertTitle>
          <AlertDescription>
            Fetch the orders: the server answered 502.
          </AlertDescription>
        </Alert>
      </section>
    </div>
  );
}

const meta = {
  title: "Design system/Components/Status",
  component: StatusStates,
} satisfies Meta<typeof StatusStates>;

export default meta;

type Story = StoryObj<typeof meta>;

export const States: Story = {};
