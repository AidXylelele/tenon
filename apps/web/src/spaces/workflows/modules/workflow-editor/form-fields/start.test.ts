import { describe, expect, it } from "vitest";
import { fieldOf, workflowFormOf } from "./forms.test-support";
import { cronEditsOf, eventEditsOf, startEditsOf, startOf } from "./start";

const SIGN_UPS = "com.example.signup.v1";

function scheduleOf(value: Parameters<typeof workflowFormOf>[0]) {
  const form = workflowFormOf(value);
  return form.fields.find((field) => field.key === "schedule");
}

const DAILY = scheduleOf({ cron: "0 9 * * *" });
const BY_HAND = scheduleOf(null);
const SIGNED_UP = scheduleOf({ on: { one: { with: { type: SIGN_UPS } } } });
const EVERY = scheduleOf({ every: { minutes: 15 } });
const ALL_OF = scheduleOf({ on: { all: [] } });
const SCHEDULE = fieldOf({ key: "schedule", pointer: "/schedule" });
const START = { cron: "0 9 * * *", eventType: SIGN_UPS };

describe("how a workflow starts", () => {
  it("nothing_written_starts_by_hand", () => {
    const start = startOf(BY_HAND, [SIGN_UPS]);

    expect(start.way).toBe("hand");
  });

  it("a_cron_starts_on_a_schedule", () => {
    const start = startOf(DAILY, []);

    expect(start).toEqual({
      way: "schedule",
      cron: "0 9 * * *",
      eventType: null,
      timed: null,
    });
  });

  it("a_repeat_by_duration_starts_on_a_schedule_with_its_field", () => {
    const start = startOf(EVERY, []);

    expect(start.way).toBe("schedule");
    expect(start.timed?.key).toBe("every");
  });

  it("an_event_of_a_webhook's_type_starts_by_the_webhook", () => {
    const start = startOf(SIGNED_UP, [SIGN_UPS]);

    expect(start).toEqual({
      way: "webhook",
      cron: null,
      eventType: SIGN_UPS,
      timed: null,
    });
  });

  it("an_event_of_another_type_starts_by_the_event", () => {
    const start = startOf(SIGNED_UP, []);

    expect(start.way).toBe("event");
  });

  it("events_of_another_strategy_start_by_an_event_of_no_one_type", () => {
    const start = startOf(ALL_OF, []);

    expect(start).toEqual({
      way: "event",
      cron: null,
      eventType: null,
      timed: null,
    });
  });
});

describe("the edits of choosing how it starts", () => {
  const byHand = startOf(BY_HAND, []);
  const daily = startOf(DAILY, []);

  it("the_way_in_force_sends_nothing", () => {
    const edits = startEditsOf(SCHEDULE, daily, "schedule", START);

    expect(edits).toEqual([]);
  });

  it("by_hand_clears_the_schedule", () => {
    const edits = startEditsOf(SCHEDULE, daily, "hand", START);

    expect(edits).toEqual([{ kind: "clearField", pointer: "/schedule" }]);
  });

  it("a_schedule_writes_the_first_cron", () => {
    const edits = startEditsOf(SCHEDULE, byHand, "schedule", START);

    expect(edits).toEqual([
      { kind: "setField", pointer: "/schedule", value: { cron: "0 9 * * *" } },
    ]);
  });

  it("a_webhook_writes_its_event_type", () => {
    const edits = startEditsOf(SCHEDULE, byHand, "webhook", START);

    expect(edits).toEqual([
      {
        kind: "setField",
        pointer: "/schedule",
        value: { on: { one: { with: { type: SIGN_UPS } } } },
      },
    ]);
  });

  it("a_webhook_with_none_to_choose_sends_nothing", () => {
    const none = { ...START, eventType: null };

    const edits = startEditsOf(SCHEDULE, byHand, "webhook", none);

    expect(edits).toEqual([]);
  });

  it("an_event_leaves_its_type_to_fill", () => {
    const edits = startEditsOf(SCHEDULE, byHand, "event", START);

    expect(edits).toEqual(eventEditsOf(SCHEDULE, ""));
  });

  it("a_cron_replaces_the_whole_schedule", () => {
    const edits = cronEditsOf(SCHEDULE, "*/10 * * * *");

    expect(edits).toEqual([
      {
        kind: "setField",
        pointer: "/schedule",
        value: { cron: "*/10 * * * *" },
      },
    ]);
  });
});
