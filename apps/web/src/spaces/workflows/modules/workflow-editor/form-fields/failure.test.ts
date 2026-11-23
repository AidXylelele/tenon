import type { RetrySetting } from "language-server/protocol";
import { describe, expect, it } from "vitest";
import {
  CONTINUING,
  HANDLING,
  protectionOf,
  REPORT_FORM,
  REPORT_INNER_STEP,
  REPORT_STEP,
  RETRY_PLAN,
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
  retryCommitOf,
  retryWhenCommitOf,
} from "./failure";

const INNER = REPORT_INNER_STEP;
const AT_TRY = { step: REPORT_STEP.id, pointer: REPORT_STEP.pointer };
const AT_STEP = { step: WAIT_STEP.id, pointer: WAIT_STEP.pointer };
const SLOWER: RetrySetting = {
  retries: 5,
  milliseconds: 10_000,
  backoff: "constant",
  on: { kind: "any" },
};

describe("reading what happens when a step fails", () => {
  it("a_step_no_try_protects_stops_the_run_and_is_its_own_target", () => {
    const reading = failureOf(WAIT_STEP, WAIT_FORM, null);

    expect(reading).toEqual({
      choice: "stop",
      retry: null,
      isWrittenOtherwise: false,
      target: AT_STEP,
    });
  });

  it("a_protected_step_reads_its_try's_retry_and_targets_the_try", () => {
    const reading = failureOf(INNER, REPORT_FORM, RETRYING);

    expect(reading).toEqual({
      choice: "retryThenStop",
      retry: FIRST_RETRY,
      isWrittenOtherwise: false,
      target: AT_TRY,
    });
  });

  it("a_delay_the_language_server_cannot_read_is_said_to_be_written_otherwise", () => {
    const plan = { ...RETRY_PLAN, milliseconds: null };
    const protection = protectionOf({ retry: RETRY_POLICY }, "retry", plan);

    const reading = failureOf(INNER, REPORT_FORM, protection);

    expect(reading.isWrittenOtherwise).toBe(true);
    expect(reading.retry).toEqual(FIRST_RETRY);
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

describe("a retry's count typed in the form", () => {
  it.each([["later"], ["-"], ["2.5"], [""]])("%s_is_refused", (text) => {
    const reading = failureOf(INNER, REPORT_FORM, RETRYING);

    const commit = retryCommitOf(reading, "seconds", text);

    expect(commit.kind).toBe("refused");
  });

  it("the_count_in_force_sends_nothing_and_another_one_sends_the_change", () => {
    const reading = failureOf(INNER, REPORT_FORM, RETRYING);

    const same = retryCommitOf(reading, "seconds", "2");
    const more = retryCommitOf(reading, "retries", " 5 ");

    const changed = { ...FIRST_RETRY, retries: 5 };
    const edits = retryChangeOf(reading, changed);
    expect(same).toEqual({ kind: "edits", edits: [] });
    expect(more).toEqual({ kind: "edits", edits });
  });

  it("seconds_are_written_as_milliseconds", () => {
    const reading = failureOf(INNER, REPORT_FORM, RETRYING);

    const commit = retryCommitOf(reading, "seconds", "10");

    const changed = { ...FIRST_RETRY, milliseconds: 10_000 };
    const edits = retryChangeOf(reading, changed);
    expect(commit).toEqual({ kind: "edits", edits });
  });
});

describe("which errors a retry takes", () => {
  it("statuses_are_read_from_the_typed_list", () => {
    const reading = failureOf(INNER, REPORT_FORM, RETRYING);

    const commit = retryWhenCommitOf(reading, "statuses", "503, 429");

    const on = { kind: "statuses", statuses: [503, 429] } as const;
    const changed = { ...FIRST_RETRY, on };
    const edits = retryChangeOf(reading, changed);
    expect(commit).toEqual({ kind: "edits", edits });
  });

  it.each([
    ["", "no status"],
    ["503, soon", "not a number"],
    ["42", "no HTTP status"],
  ])("%s_is_refused_as_%s", (text) => {
    const reading = failureOf(INNER, REPORT_FORM, RETRYING);

    const commit = retryWhenCommitOf(reading, "statuses", text);

    expect(commit.kind).toBe("refused");
  });

  it("the_errors_in_force_send_nothing", () => {
    const reading = failureOf(INNER, REPORT_FORM, RETRYING);

    const commit = retryWhenCommitOf(reading, "any", "");

    expect(commit).toEqual({ kind: "edits", edits: [] });
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
        failure: { kind: "retry", retry: FIRST_RETRY },
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

  it.each([
    ["a_plain_step", WAIT_STEP, WAIT_FORM, null, WAIT_STEP.id],
    ["a_retry", INNER, REPORT_FORM, RETRYING, REPORT_STEP.id],
    ["a_lane", INNER, REPORT_FORM, HANDLING, REPORT_STEP.id],
  ] as const)(
    "retrying_then_running_other_steps_from_%s_is_one_handle_with_its_retry",
    (_, step, form, protection, target) => {
      const reading = failureOf(step, form, protection);

      const edits = failureEditsOf(reading, "retryThenHandle", FIRST_RETRY);

      expect(edits).toEqual([
        {
          kind: "setFailure",
          step: target,
          failure: { kind: "handle", retry: FIRST_RETRY },
        },
      ]);
    },
  );

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
        failure: { kind: "retry", retry: SLOWER },
      },
    ]);
  });

  it("a_retry_before_a_lane_is_set_again_as_a_handle_with_its_retry", () => {
    const reading = failureOf(INNER, REPORT_FORM, RETRYING_THEN_HANDLING);

    const edits = retryChangeOf(reading, SLOWER);

    expect(edits).toEqual([
      {
        kind: "setFailure",
        step: REPORT_STEP.id,
        failure: { kind: "handle", retry: SLOWER },
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
