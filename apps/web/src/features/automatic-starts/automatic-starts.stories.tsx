import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { Outcome } from "@/libs/data-access/problem";
import { AutomaticStarts } from "./automatic-starts";

const DONE: Outcome<void> = { ok: true, value: undefined };

const REFUSED: Outcome<void> = {
  ok: false,
  problem: {
    type: "about:blank",
    title: "Not published",
    status: 409,
    detail: "Nothing is published yet",
    errors: [],
    retryAfter: null,
  },
};

function turnDone(): Promise<Outcome<void>> {
  return Promise.resolve(DONE);
}

function turnRefused(): Promise<Outcome<void>> {
  return Promise.resolve(REFUSED);
}

const meta = {
  title: "Features/Automatic starts",
  component: AutomaticStarts,
  args: {
    workflow: "Daily digest",
    on: true,
    labelled: true,
    turn: turnDone,
  },
} satisfies Meta<typeof AutomaticStarts>;

export default meta;

type Story = StoryObj<typeof meta>;

export const On: Story = {};

export const Off: Story = { args: { on: false } };

export const InATable: Story = { args: { labelled: false } };

export const Refused: Story = { args: { turn: turnRefused } };
