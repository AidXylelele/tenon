import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import {
  BY_HAND,
  ON_SIGN_UP,
  SCHEDULED,
  workflowFormOf,
} from "@/operations/form-fields/forms.test-support";
import { StartForm } from "./start-form";

const SIGN_UPS = {
  name: "Sign-ups from the website",
  eventType: "com.example.signup.v1",
  address: "https://tenon.example.com/api/v1/hooks/dTSi8Xvw",
};

const ORDERS = {
  name: "Order approvals",
  eventType: "com.example.order.approved.v1",
  address: "https://tenon.example.com/api/v1/hooks/q2Lk0Pzr",
};

const meta = {
  component: StartForm,
  decorators: [
    (Story) => (
      <div className="w-[400px] p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    form: SCHEDULED,
    webhooks: [SIGN_UPS, ORDERS],
    now: "2026-11-22T12:00:00.000Z",
    zone: "Europe/Kyiv",
    revealProblems: false,
    languageTerms: false,
    onEdit: fn(),
  },
} satisfies Meta<typeof StartForm>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Schedule: Story = {};

export const ScheduleBeforeDaylightSaving: Story = {
  args: {
    form: workflowFormOf({ cron: "30 6 * * 1-5" }),
    now: "2026-03-25T12:00:00.000Z",
  },
};

export const WeeklySchedule: Story = {
  args: { form: workflowFormOf({ cron: "0 9 * * 1,4" }) },
};

export const Webhook: Story = {
  args: { form: ON_SIGN_UP },
};

export const EventToFill: Story = {
  args: {
    form: workflowFormOf({ on: { one: { with: { type: "" } } } }),
  },
};

export const ByHandWithoutWebhooks: Story = {
  args: { form: BY_HAND, webhooks: [] },
};
