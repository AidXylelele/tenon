import {
  ArrowDownIcon,
  CalendarClockIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleXIcon,
  CornerDownRightIcon,
  FlagIcon,
  GlobeIcon,
  HandIcon,
  LoaderCircleIcon,
  LogOutIcon,
  RotateCwIcon,
  WebhookIcon,
} from "lucide-react";
import { describe, expect, it } from "vitest";
import {
  blockLineOf,
  cardLineOf,
  exitLookOf,
  kindLookOf,
  laneOf,
  plusLabelOf,
  runLookOf,
  startLookOf,
} from "./looks";
import {
  caught,
  DAILY,
  DAILY_DIGEST,
  ends,
  EVERY_HOUR,
  goTo,
  listAt,
  MONTH_END,
  next,
  ON_EVENT,
  ranFor,
  stepAt,
  stepNamed,
  workflowOf,
} from "./workflows.test-support";

describe("a step's kind in words", () => {
  it("is_what_the_step_does_with_its_icon", () => {
    const look = kindLookOf("call");

    expect(look).toEqual({ word: "Call a service", icon: GlobeIcon });
  });
});

describe("the line under a step's name", () => {
  it("is_what_the_step_writes", () => {
    const fetch = stepNamed(DAILY_DIGEST.steps, "Fetch the digest");

    const line = cardLineOf(fetch);

    expect(line).toBe("GET https://httpbin.org/json");
  });

  it("is_the_kind_where_the_step_writes_nothing_yet", () => {
    const pause = stepAt("/do/Pause", "wait", null, [next(null)]);

    const line = cardLineOf(pause);

    expect(line).toBe("Wait");
  });

  it("names_the_kind_of_a_choice_before_its_cases", () => {
    const choice = stepNamed(DAILY_DIGEST.steps, "Has items?");

    const line = cardLineOf(choice);

    expect(line).toBe("Choose a path · 2 cases");
  });

  it("counts_the_steps_of_a_group", () => {
    const group = stepNamed(MONTH_END.steps, "Prepare the batch");

    const line = blockLineOf(group);

    expect(line).toBe("Group steps · 2 steps");
  });

  it("counts_one_step_of_a_group", () => {
    const group = stepAt(
      "/do/Group",
      "do",
      null,
      [next(null)],
      [
        listAt("/do/Group/do", "do", [
          stepAt("/do/Group/do/Only", "set", "x", [next(null)]),
        ]),
      ],
    );

    const line = blockLineOf(group);

    expect(line).toBe("Group steps · 1 step");
  });

  it("is_the_kind_alone_where_a_block_says_nothing_more", () => {
    const guard = stepNamed(MONTH_END.steps, "Archive the batch");

    const line = blockLineOf(guard);

    expect(line).toBe("Try and handle failure");
  });
});

describe("the name of a plus", () => {
  it.each([
    ["the_first_of_the_workflow", null, null, null, "Add the first step"],
    ["before_the_first", null, null, "Fetch", "Add a step before Fetch"],
    ["after_a_step", null, "Fetch", "Post", "Add a step after Fetch"],
    [
      "the_first_inside_a_block",
      "Group",
      null,
      null,
      "Add the first step inside Group",
    ],
    [
      "at_the_end_of_a_block",
      "Group",
      "Fetch",
      null,
      "Add a step at the end of Group",
    ],
    [
      "between_two_steps_inside_a_block",
      "Group",
      "Fetch",
      "Post",
      "Add a step inside Group, after Fetch",
    ],
  ] as const)("%s", (_, owner, above, below, words) => {
    const label = plusLabelOf(owner, above, below);

    expect(label).toBe(words);
  });
});

describe("a step's run in words", () => {
  it("says_the_status_and_its_detail_in_the_console's_words", () => {
    const run = ranFor("189 ms");

    const look = runLookOf(run);

    expect(look).toEqual({
      tone: "success",
      icon: CircleCheckIcon,
      label: "Succeeded · 189 ms",
      live: false,
    });
  });

  it("says_failed_for_a_faulted_step", () => {
    const run = ranFor("171 ms", "faulted");

    const look = runLookOf(run);

    expect(look).toEqual({
      tone: "danger",
      icon: CircleXIcon,
      label: "Failed · 171 ms",
      live: false,
    });
  });

  it("is_live_while_the_step_runs", () => {
    const run = ranFor(null, "running");

    const look = runLookOf(run);

    expect(look).toEqual({
      tone: "info",
      icon: LoaderCircleIcon,
      label: "Running",
      live: true,
    });
  });

  it("says_retrying_with_the_attempt", () => {
    const run = ranFor("attempt 2 of 3", "retrying");

    const look = runLookOf(run);

    expect(look).toEqual({
      tone: "warning",
      icon: RotateCwIcon,
      label: "Retrying · attempt 2 of 3",
      live: false,
    });
  });

  it("says_not_reached_for_a_step_the_run_has_not_come_to", () => {
    const look = runLookOf(undefined);

    expect(look).toEqual({
      tone: "neutral",
      icon: CircleDashedIcon,
      label: "Not reached",
      live: false,
    });
  });
});

describe("how the workflow starts, on its card", () => {
  it("by_hand_when_nothing_starts_it_by_itself", () => {
    const look = startLookOf([]);

    expect(look).toEqual({
      title: "Starts by hand",
      detail: "Or when another app starts it",
      icon: HandIcon,
    });
  });

  it("on_a_schedule_in_words", () => {
    const look = startLookOf([DAILY]);

    expect(look).toEqual({
      title: "Every day at 09:00 UTC",
      detail: "On a schedule",
      icon: CalendarClockIcon,
    });
  });

  it("on_an_event_in_words", () => {
    const look = startLookOf([ON_EVENT]);

    expect(look).toEqual({
      title: "When an event on com.acme.order.paid arrives",
      detail: "On an event",
      icon: WebhookIcon,
    });
  });

  it("names_the_first_start_and_counts_the_others", () => {
    const look = startLookOf([EVERY_HOUR, DAILY]);

    expect(look).toEqual({
      title: "Every 1 hour",
      detail: "On a schedule · and 1 more",
      icon: CalendarClockIcon,
    });
  });
});

describe("where a step goes, in words", () => {
  it.each([
    ["continues", { kind: "next" }, "continues", ArrowDownIcon],
    ["ends_the_run", { kind: "end" }, "End the run", FlagIcon],
    ["leaves_the_block", { kind: "exit" }, "Leave the block", LogOutIcon],
    [
      "goes_to_a_step_by_its_name",
      { kind: "jump", to: "/do/Retry", name: "Retry" },
      "go to Retry",
      CornerDownRightIcon,
    ],
    [
      "goes_to_a_step_that_is_not_there",
      { kind: "jump", to: null, name: null },
      "go to a step that is not there",
      CornerDownRightIcon,
    ],
  ] as const)("%s", (_, exit, words, icon) => {
    const look = exitLookOf(exit);

    expect(look).toEqual({ words, icon });
  });
});

describe("the Try's lane, in words", () => {
  it("runs_the_steps_in_it", () => {
    const step = stepNamed(MONTH_END.steps, "Archive the batch");

    const lane = laneOf(step, MONTH_END.steps);

    expect(lane).toEqual({ note: null, then: "run these steps" });
  });

  it("asks_for_steps_when_its_list_is_empty", () => {
    const step = stepAt(
      "/do/Guard",
      "try",
      null,
      [next(null)],
      [
        listAt("/do/Guard/try", "try", []),
        listAt("/do/Guard/catch/do", "catch", []),
      ],
    );
    const list = workflowOf("Guarded", [step]).steps;

    const lane = laneOf(step, list);

    expect(lane).toEqual({ note: null, then: "run the steps added here" });
  });

  it("says_where_the_flow_goes_after_the_error_is_caught", () => {
    const step = stepAt(
      "/do/Guard",
      "try",
      "Retries 3 times",
      [next(null), caught(goTo("/do/Report"))],
      [listAt("/do/Guard/try", "try", [])],
    );
    const list = workflowOf("Guarded", [
      step,
      stepAt("/do/Report", "set", null, [next(null)]),
    ]).steps;

    const lane = laneOf(step, list);

    expect(lane).toEqual({ note: "Retries 3 times", then: "go to Report" });
  });

  it("runs_its_steps_and_then_goes_on_as_told", () => {
    const step = stepAt(
      "/do/Guard",
      "try",
      null,
      [next(null), caught(ends())],
      [
        listAt("/do/Guard/try", "try", []),
        listAt("/do/Guard/catch/do", "catch", [
          stepAt("/do/Guard/catch/do/Note", "set", null, [next(null)]),
        ]),
      ],
    );
    const list = workflowOf("Guarded", [step]).steps;

    const lane = laneOf(step, list);

    expect(lane).toEqual({
      note: null,
      then: "run these steps, then end the run",
    });
  });

  it("says_nothing_it_cannot_read_from_the_structure", () => {
    const step = stepAt(
      "/do/Guard",
      "try",
      null,
      [next(null)],
      [listAt("/do/Guard/try", "try", [])],
    );
    const list = workflowOf("Guarded", [step]).steps;

    const lane = laneOf(step, list);

    expect(lane).toEqual({ note: null, then: null });
  });
});
