import { describe, expect, it } from "vitest";
import {
  CONTINUING,
  HANDLING,
  REPORT_FORM,
  REPORT_INNER_STEP,
  REPORT_STEP,
  RETRYING,
  RETRYING_THEN_HANDLING,
  RETRY_POLICY,
  WAIT_FORM,
  WAIT_STEP,
} from "./forms.test-support";
import {
  failureEditsOf,
  failureNoteOf,
  failureOf,
  failureSummaryOf,
  FIRST_RETRY,
  retryChangeOf,
  retrySettingsOf,
} from "./failure";

const INNER = REPORT_INNER_STEP;
const AT_TRY = { step: REPORT_STEP.id, pointer: REPORT_STEP.pointer };
const AT_STEP = { step: WAIT_STEP.id, pointer: WAIT_STEP.pointer };
const SLOWER = { retries: 5, seconds: 10, growing: false };

describe("reading what happens when a step fails", () => {
  it("a_step_no_try_protects_stops_the_run_and_is_its_own_target", () => {
    const reading = failureOf(WAIT_STEP, WAIT_FORM, null);

    expect(reading).toEqual({ choice: "stop", retry: null, target: AT_STEP });
  });

  it("a_protected_step_reads_its_try's_retry_and_targets_the_try", () => {
    const reading = failureOf(INNER, REPORT_FORM, RETRYING);

    expect(reading).toEqual({
      choice: "retryThenStop",
      retry: { retries: 3, seconds: 2, growing: true },
      target: AT_TRY,
    });
  });

  it.each([
    ["a_catch_with_nothing", CONTINUING, "continue"],
    ["a_catch_with_steps", HANDLING, "handle"],
    [
      "a_catch_with_a_retry_and_steps",
      RETRYING_THEN_HANDLING,
      "retryThenHandle",
    ],
  ] as const)("%s_reads_as_%s", (_, protection, expected) => {
    const reading = failureOf(INNER, REPORT_FORM, protection);

    expect(reading.choice).toBe(expected);
  });
});

describe("reading a retry policy", () => {
  it("delays_in_any_units_count_in_seconds", () => {
    const policy = {
      delay: { minutes: 1, seconds: 30 },
      backoff: { constant: {} },
      limit: { attempt: { count: 4 } },
    };

    const settings = retrySettingsOf(policy);

    expect(settings).toEqual({ retries: 4, seconds: 90, growing: false });
  });

  it.each([
    ["a_linear_backoff", { ...RETRY_POLICY, backoff: { linear: {} } }],
    ["a_delay_as_text", { ...RETRY_POLICY, delay: "PT2S" }],
    ["no_attempt_count", { ...RETRY_POLICY, limit: {} }],
    ["a_reference_by_name", "standard"],
  ])("%s_is_not_shown_as_settings", (_, policy) => {
    const settings = retrySettingsOf(policy);

    expect(settings).toBeNull();
  });
});

describe("the edits a failure choice sends", () => {
  it("a_choice_already_in_force_sends_nothing", () => {
    const reading = failureOf(WAIT_STEP, WAIT_FORM, null);

    const edits = failureEditsOf(reading, "stop", FIRST_RETRY);

    expect(edits).toEqual([]);
  });

  it("retrying_sets_the_failure_with_its_settings_on_the_target", () => {
    const reading = failureOf(WAIT_STEP, WAIT_FORM, null);

    const edits = failureEditsOf(reading, "retryThenStop", FIRST_RETRY);

    expect(edits).toEqual([
      {
        kind: "setFailure",
        step: WAIT_STEP.id,
        failure: { kind: "retry", retries: 3, seconds: 2, growing: true },
      },
    ]);
  });

  it.each([
    ["stop", { kind: "stop" }],
    ["continue", { kind: "continue" }],
  ] as const)("choosing_%s_sets_it_on_the_try", (choice, failure) => {
    const reading = failureOf(INNER, REPORT_FORM, RETRYING);

    const edits = failureEditsOf(reading, choice, FIRST_RETRY);

    expect(edits).toEqual([
      { kind: "setFailure", step: REPORT_STEP.id, failure },
    ]);
  });

  it("retrying_then_running_other_steps_from_a_plain_step_wraps_it_then_adds_the_lane", () => {
    const reading = failureOf(WAIT_STEP, WAIT_FORM, null);

    const edits = failureEditsOf(reading, "retryThenHandle", FIRST_RETRY);

    expect(edits).toEqual([
      {
        kind: "setFailure",
        step: WAIT_STEP.id,
        failure: { kind: "retry", retries: 3, seconds: 2, growing: true },
      },
      { kind: "setField", pointer: `${WAIT_STEP.pointer}/catch/do`, value: [] },
    ]);
  });

  it("retrying_then_running_other_steps_after_a_retry_only_adds_the_lane", () => {
    const reading = failureOf(INNER, REPORT_FORM, RETRYING);

    const edits = failureEditsOf(reading, "retryThenHandle", FIRST_RETRY);

    expect(edits).toEqual([
      {
        kind: "setField",
        pointer: `${REPORT_STEP.pointer}/catch/do`,
        value: [],
      },
    ]);
  });

  it("adding_a_retry_to_a_lane_keeps_its_steps", () => {
    const reading = failureOf(INNER, REPORT_FORM, HANDLING);

    const edits = failureEditsOf(reading, "retryThenHandle", FIRST_RETRY);

    expect(edits).toEqual([
      {
        kind: "setField",
        pointer: `${REPORT_STEP.pointer}/catch/retry`,
        value: RETRY_POLICY,
      },
    ]);
  });

  it("dropping_the_retry_of_a_lane_clears_only_the_retry", () => {
    const reading = failureOf(INNER, REPORT_FORM, RETRYING_THEN_HANDLING);

    const edits = failureEditsOf(reading, "handle", FIRST_RETRY);

    expect(edits).toEqual([
      { kind: "clearField", pointer: `${REPORT_STEP.pointer}/catch/retry` },
    ]);
  });

  it("running_other_steps_from_a_retry_sets_the_lane", () => {
    const reading = failureOf(INNER, REPORT_FORM, RETRYING);

    const edits = failureEditsOf(reading, "handle", FIRST_RETRY);

    expect(edits).toEqual([
      {
        kind: "setFailure",
        step: REPORT_STEP.id,
        failure: { kind: "handle" },
      },
    ]);
  });
});

describe("the edits a change of retry settings sends", () => {
  it("a_retry_then_stop_is_set_again_with_the_new_settings", () => {
    const reading = failureOf(INNER, REPORT_FORM, RETRYING);

    const edits = retryChangeOf(reading, SLOWER);

    expect(edits).toEqual([
      {
        kind: "setFailure",
        step: REPORT_STEP.id,
        failure: { kind: "retry", retries: 5, seconds: 10, growing: false },
      },
    ]);
  });

  it("a_retry_before_a_lane_writes_only_the_retry", () => {
    const reading = failureOf(INNER, REPORT_FORM, RETRYING_THEN_HANDLING);

    const edits = retryChangeOf(reading, SLOWER);

    expect(edits).toEqual([
      {
        kind: "setField",
        pointer: `${REPORT_STEP.pointer}/catch/retry`,
        value: {
          delay: { seconds: 10 },
          backoff: { constant: {} },
          limit: { attempt: { count: 5 } },
        },
      },
    ]);
  });

  it("without_a_retry_nothing_is_sent", () => {
    const reading = failureOf(INNER, REPORT_FORM, CONTINUING);

    const edits = retryChangeOf(reading, SLOWER);

    expect(edits).toEqual([]);
  });
});

describe("the words of a failure choice", () => {
  it.each([
    ["retry_then_stop", RETRYING, "Retry 3×, 2 s apart, growing; then stop"],
    [
      "retry_then_handle",
      RETRYING_THEN_HANDLING,
      "Retry 3×, then run the steps in its “If it fails” lane",
    ],
    ["continue", CONTINUING, "Continue with the next step"],
    ["handle", HANDLING, "Run the steps in its “If it fails” lane"],
  ])("the_summary_of_%s_says_what_happens", (_, protection, expected) => {
    const reading = failureOf(INNER, REPORT_FORM, protection);

    const summary = failureSummaryOf(reading);

    expect(summary).toBe(expected);
  });

  it("a_step_that_stops_has_no_note_about_the_flow", () => {
    const note = failureNoteOf("stop");

    expect(note).toBeNull();
  });

  it("a_lane_note_says_where_to_add_its_steps", () => {
    const note = failureNoteOf("handle");

    expect(note).toBe(
      "The flow now draws this step inside a Try with an “If it fails” lane under it; press the lane's + to add the steps to run.",
    );
  });
});
