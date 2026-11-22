import { act, fireEvent, render, screen } from "@testing-library/react";
import type { EditAction } from "language-server/protocol";
import { describe, expect, it, vi } from "vitest";
import {
  BY_HAND,
  ON_SIGN_UP,
  SCHEDULED,
  workflowFormOf,
} from "@/operations/form-fields/forms.test-support";
import type { StartFormProps } from "./interfaces";
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

function shown(props: Partial<StartFormProps> = {}) {
  const onEdit = vi.fn<(actions: readonly EditAction[]) => void>();
  const all: StartFormProps = {
    form: SCHEDULED,
    webhooks: [SIGN_UPS, ORDERS],
    now: "2026-11-22T12:00:00.000Z",
    zone: "Europe/Kyiv",
    revealProblems: false,
    languageTerms: false,
    onEdit,
    ...props,
  };
  render(<StartForm {...all} />);
  return { onEdit };
}

function leave(element: HTMLElement, text: string) {
  act(() => {
    fireEvent.focus(element);
    fireEvent.change(element, { target: { value: text } });
    fireEvent.blur(element);
  });
}

function choose(trigger: HTMLElement, option: string) {
  act(() => {
    fireEvent.keyDown(trigger, { key: "Enter" });
  });
  const item = screen.getByRole("option", { name: option });
  act(() => {
    fireEvent.keyDown(item, { key: "Enter" });
  });
}

function pick(way: string) {
  const radio = screen.getByRole("radio", { name: way });

  act(() => {
    fireEvent.click(radio);
  });
}

const DAILY_AT_TEN = [
  { kind: "setField", pointer: "/schedule", value: { cron: "0 10 * * *" } },
];

describe("how the workflow starts", () => {
  it("a_schedule_is_said_in_utc_with_the_viewer's_time_and_next_starts", () => {
    shown();

    const way = screen.getByRole("radio", { name: "On a schedule" });

    expect(way).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Every day at 09:00 UTC")).toBeInTheDocument();
    expect(screen.getByText("11:00 your time")).toBeInTheDocument();
    expect(
      screen.getByText("Mon 23 Nov 09:00 UTC · 11:00 your time"),
    ).toBeInTheDocument();
  });

  it("by_hand_clears_the_schedule", () => {
    const { onEdit } = shown();

    pick("By hand");

    expect(onEdit).toHaveBeenCalledWith([
      { kind: "clearField", pointer: "/schedule" },
    ]);
  });

  it("a_schedule_starts_every_day_at_nine_utc", () => {
    const { onEdit } = shown({ form: BY_HAND });

    pick("On a schedule");

    expect(onEdit).toHaveBeenCalledWith([
      { kind: "setField", pointer: "/schedule", value: { cron: "0 9 * * *" } },
    ]);
  });

  it("a_new_time_of_day_rewrites_the_cron", () => {
    const { onEdit } = shown();
    const time = screen.getByLabelText("At, in UTC");

    leave(time, "10:00");

    expect(onEdit).toHaveBeenCalledWith(DAILY_AT_TEN);
  });

  it("another_repeat_keeps_the_time_of_day", () => {
    const { onEdit } = shown({ form: workflowFormOf({ cron: "0 10 * * *" }) });
    const repeat = screen.getByRole("combobox", { name: "Repeat" });

    choose(repeat, "Every weekday");

    expect(onEdit).toHaveBeenCalledWith([
      {
        kind: "setField",
        pointer: "/schedule",
        value: { cron: "0 10 * * 1-5" },
      },
    ]);
  });

  it("a_custom_schedule_is_written_as_cron", () => {
    const { onEdit } = shown();
    const repeat = screen.getByRole("combobox", { name: "Repeat" });

    choose(repeat, "A custom schedule (cron)");
    const cron = screen.getByRole("textbox", {
      name: "Custom schedule (cron)",
    });
    leave(cron, "0 2 1 * *");

    expect(onEdit).toHaveBeenCalledWith([
      { kind: "setField", pointer: "/schedule", value: { cron: "0 2 1 * *" } },
    ]);
  });

  it("weekly_starts_pick_their_days", () => {
    const { onEdit } = shown({ form: workflowFormOf({ cron: "0 9 * * 1" }) });
    const thursday = screen.getByRole("button", { name: "Thu" });

    act(() => {
      fireEvent.click(thursday);
    });

    expect(onEdit).toHaveBeenCalledWith([
      {
        kind: "setField",
        pointer: "/schedule",
        value: { cron: "0 9 * * 1,4" },
      },
    ]);
  });

  it("hourly_starts_pick_their_minute", () => {
    const { onEdit } = shown({ form: workflowFormOf({ cron: "0 * * * *" }) });
    const minute = screen.getByLabelText("Minutes past the hour");

    leave(minute, "15");

    expect(onEdit).toHaveBeenCalledWith([
      { kind: "setField", pointer: "/schedule", value: { cron: "15 * * * *" } },
    ]);
  });

  it("starts_every_few_minutes_pick_how_many", () => {
    const { onEdit } = shown({
      form: workflowFormOf({ cron: "*/10 * * * *" }),
    });
    const every = screen.getByRole("combobox", { name: "Every" });

    choose(every, "15 minutes");

    expect(onEdit).toHaveBeenCalledWith([
      {
        kind: "setField",
        pointer: "/schedule",
        value: { cron: "*/15 * * * *" },
      },
    ]);
  });

  it("a_repeat_by_duration_is_shown_as_its_amount", () => {
    shown({ form: workflowFormOf({ every: { minutes: 15 } }) });

    const amount = screen.getByRole("textbox", { name: /Every/ });

    expect(amount).toBeInTheDocument();
  });
});

describe("a start by webhook or event", () => {
  it("a_webhook_shows_its_address_to_copy", () => {
    shown({ form: ON_SIGN_UP });

    const address = screen.getByLabelText("Its address");

    expect(address).toHaveValue(SIGN_UPS.address);
    expect(
      screen.getByRole("button", { name: "Copy the address" }),
    ).toBeInTheDocument();
  });

  it("another_webhook_writes_its_event_type", () => {
    const { onEdit } = shown({ form: ON_SIGN_UP });
    const webhook = screen.getByRole("combobox", { name: "Webhook" });

    choose(webhook, ORDERS.name);

    expect(onEdit).toHaveBeenCalledWith([
      {
        kind: "setField",
        pointer: "/schedule",
        value: { on: { one: { with: { type: ORDERS.eventType } } } },
      },
    ]);
  });

  it("an_event_type_is_written_when_left", () => {
    const empty = workflowFormOf({ on: { one: { with: { type: "" } } } });
    const { onEdit } = shown({ form: empty });
    const type = screen.getByRole("textbox", { name: "Event type" });

    leave(type, "com.example.order.placed.v1");

    expect(onEdit).toHaveBeenCalledWith([
      {
        kind: "setField",
        pointer: "/schedule",
        value: {
          on: { one: { with: { type: "com.example.order.placed.v1" } } },
        },
      },
    ]);
  });

  it("without_webhooks_the_webhook_start_says_where_to_add_one", () => {
    shown({ form: BY_HAND, webhooks: [] });

    const way = screen.getByRole("radio", { name: "When a webhook is called" });

    expect(way).toBeDisabled();
    expect(way).toHaveAccessibleDescription(
      "No webhook yet: add one under Connections, Webhooks.",
    );
  });
});

describe("schedule values that are not taken", () => {
  it("a_time_or_minute_that_is_not_one_sends_nothing", () => {
    const { onEdit } = shown();
    const time = screen.getByLabelText("At, in UTC");

    leave(time, "");

    expect(onEdit).not.toHaveBeenCalled();
  });

  it("an_hour_has_only_sixty_minutes", () => {
    const { onEdit } = shown({ form: workflowFormOf({ cron: "0 * * * *" }) });
    const minute = screen.getByLabelText("Minutes past the hour");

    leave(minute, "75");

    expect(onEdit).not.toHaveBeenCalled();
  });

  it("a_week_keeps_at_least_one_day", () => {
    const { onEdit } = shown({ form: workflowFormOf({ cron: "0 9 * * 1" }) });
    const monday = screen.getByRole("button", { name: "Mon" });

    act(() => {
      fireEvent.click(monday);
    });

    expect(onEdit).not.toHaveBeenCalled();
  });

  it("an_unchanged_or_emptied_cron_sends_nothing", () => {
    const { onEdit } = shown({ form: workflowFormOf({ cron: "0 2 1 * *" }) });
    const cron = screen.getByRole("textbox", {
      name: "Custom schedule (cron)",
    });

    leave(cron, "0 2 1 * *");
    leave(cron, " ");

    expect(onEdit).not.toHaveBeenCalled();
  });

  it("the_same_time_sends_nothing", () => {
    const { onEdit } = shown();
    const time = screen.getByLabelText("At, in UTC");

    leave(time, "09:00");

    expect(onEdit).not.toHaveBeenCalled();
  });
});
