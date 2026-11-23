import { describe, expect, it } from "vitest";
import {
  lineOf,
  removalFocusOf,
  branchesOf,
  continuesOf,
  doneExitOf,
  jumpsOf,
  sourcesOf,
} from "./flow";
import { placeOf, stepsIn, stepsUnder, stepWithId } from "./steps";
import {
  DAILY_DIGEST,
  goTo,
  leaves,
  listAt,
  MONTH_END,
  next,
  ORDER_ROUTER,
  ranFor,
  stepAt,
  stepNamed,
  whenCase,
  workflowOf,
} from "./workflows.test-support";

const top = ORDER_ROUTER.steps;

describe("where a step goes when it is done", () => {
  it("a_step_that_continues_connects_to_the_next", () => {
    const read = stepNamed(top, "Read the order");

    const continues = continuesOf(read);

    expect(continues).toBe(true);
  });

  it("a_step_that_ends_the_run_does_not_continue_and_says_so", () => {
    const licence = stepNamed(top, "Send the licence");

    const continues = continuesOf(licence);
    const exit = doneExitOf(licence, top);

    expect(continues).toBe(false);
    expect(exit).toEqual({ kind: "end" });
  });

  it("a_jump_names_the_step_it_goes_to", () => {
    const wait = stepNamed(top, "Wait a minute");

    const exit = doneExitOf(wait, top);

    expect(exit).toEqual({
      kind: "jump",
      to: "/do/Book the courier",
      name: "Book the courier",
    });
  });

  it("a_jump_to_a_step_that_is_not_there_names_none", () => {
    const lost = stepAt("/do/Lost", "wait", "PT1S", [goTo(null)]);
    const list = workflowOf("Lost", [lost]).steps;

    const exit = doneExitOf(lost, list);

    expect(exit).toEqual({ kind: "jump", to: null, name: null });
  });

  it("leaving_a_block_leaves_it_and_leaving_the_workflow_ends_the_run", () => {
    const inner = stepAt("/do/Group/do/Stop here", "set", null, [leaves()]);
    const block = listAt("/do/Group/do", "do", [inner]);
    const outer = stepAt("/do/Stop here", "set", null, [leaves()]);
    const workflow = workflowOf("Leaving", [outer]).steps;

    const nested = doneExitOf(inner, block);
    const atTop = doneExitOf(outer, workflow);

    expect(nested).toEqual({ kind: "exit" });
    expect(atTop).toEqual({ kind: "end" });
  });
});

describe("a choice", () => {
  it("continues_when_one_of_its_cases_continues", () => {
    const choice = stepNamed(DAILY_DIGEST.steps, "Has items?");

    const continues = continuesOf(choice);

    expect(continues).toBe(true);
  });

  it("does_not_continue_when_its_default_case_leaves_and_no_case_continues", () => {
    const which = stepNamed(top, "Which kind?");

    const continues = continuesOf(which);

    expect(continues).toBe(false);
  });

  it("with_a_default_case_has_no_way_out_of_its_own", () => {
    const which = stepNamed(top, "Which kind?");

    const exit = doneExitOf(which, top);

    expect(exit).toBeNull();
  });

  it("without_a_default_case_continues_by_its_own_then", () => {
    const booked = stepNamed(top, "Booked?");

    const continues = continuesOf(booked);

    expect(continues).toBe(true);
  });

  it("shows_its_cases_in_order_with_their_conditions_and_exits", () => {
    const which = stepNamed(top, "Which kind?");

    const branches = branchesOf(which, top);

    expect(branches).toEqual([
      {
        case: "A licence",
        name: "A licence",
        when: '${ .kind == "licence" }',
        exit: {
          kind: "jump",
          to: "/do/Send the licence",
          name: "Send the licence",
        },
      },
      {
        case: "A parcel",
        name: "A parcel",
        when: '${ .kind == "parcel" }',
        exit: {
          kind: "jump",
          to: "/do/Book the courier",
          name: "Book the courier",
        },
      },
      {
        case: "default",
        name: "Otherwise",
        when: null,
        exit: { kind: "end" },
      },
    ]);
  });

  it("a_case_that_continues_says_so", () => {
    const choice = stepAt("/do/Check", "switch", "1 case", [
      whenCase("Fine", "${ .ok }", next("/do/After")),
      next("/do/After"),
    ]);
    const list = workflowOf("Check", [choice]).steps;

    const branches = branchesOf(choice, list);

    expect(branches).toEqual([
      {
        case: "Fine",
        name: "Fine",
        when: "${ .ok }",
        exit: { kind: "next" },
      },
    ]);
  });
});

describe("the jumps of a workflow", () => {
  it("are_the_cases_and_steps_that_go_to_a_step_with_a_lane_each_and_the_steps_between", () => {
    const jumps = jumpsOf(top);

    expect(jumps).toEqual([
      {
        key: "case:/do/Which kind?:A licence",
        list: "/do",
        from: "/do/Which kind?",
        fromName: "Which kind?",
        to: "/do/Send the licence",
        between: ["/do/Which kind?", "/do/Send the licence"],
        lane: 0,
        case: "A licence",
        branch: "A licence",
      },
      {
        key: "case:/do/Which kind?:A parcel",
        list: "/do",
        from: "/do/Which kind?",
        fromName: "Which kind?",
        to: "/do/Book the courier",
        between: [
          "/do/Which kind?",
          "/do/Send the licence",
          "/do/Book the courier",
        ],
        lane: 1,
        case: "A parcel",
        branch: "A parcel",
      },
      {
        key: "case:/do/Booked?:Not yet",
        list: "/do",
        from: "/do/Booked?",
        fromName: "Booked?",
        to: "/do/Wait a minute",
        between: ["/do/Booked?", "/do/Tell the customer", "/do/Wait a minute"],
        lane: 2,
        case: "Not yet",
        branch: "Not yet",
      },
      {
        key: "done:/do/Wait a minute",
        list: "/do",
        from: "/do/Wait a minute",
        fromName: "Wait a minute",
        to: "/do/Book the courier",
        between: [
          "/do/Book the courier",
          "/do/Booked?",
          "/do/Tell the customer",
          "/do/Wait a minute",
        ],
        lane: 3,
        case: null,
        branch: null,
      },
    ]);
  });

  it("are_found_in_nested_lists_too", () => {
    const inner = listAt("/do/Group/do", "do", [
      stepAt("/do/Group/do/First", "wait", "PT1S", [goTo("/do/Group/do/Last")]),
      stepAt("/do/Group/do/Last", "wait", "PT1S", [next(null)]),
    ]);
    const group = stepAt("/do/Group", "do", null, [next(null)], [inner]);
    const list = workflowOf("Nested", [group]).steps;

    const jumps = jumpsOf(list);

    expect(jumps).toEqual([
      {
        key: "done:/do/Group/do/First",
        list: "/do/Group/do",
        from: "/do/Group/do/First",
        fromName: "First",
        to: "/do/Group/do/Last",
        between: ["/do/Group/do/First", "/do/Group/do/Last"],
        lane: 0,
        case: null,
        branch: null,
      },
    ]);
  });

  it("leave_out_a_jump_to_a_step_that_is_not_there", () => {
    const lost = stepAt("/do/Lost", "wait", "PT1S", [goTo(null)]);
    const list = workflowOf("Lost", [lost]).steps;

    const jumps = jumpsOf(list);

    expect(jumps).toEqual([]);
  });

  it("are_none_in_a_workflow_of_blocks_that_only_continue", () => {
    const jumps = jumpsOf(MONTH_END.steps);

    expect(jumps).toEqual([]);
  });
});

describe("where a jump's target comes from", () => {
  it("names_each_source_and_its_case", () => {
    const jumps = jumpsOf(top);

    const sources = sourcesOf(jumps);

    expect(sources).toEqual(
      new Map([
        ["/do/Send the licence", "from Which kind? · A licence"],
        ["/do/Book the courier", "from Which kind? · A parcel, Wait a minute"],
        ["/do/Wait a minute", "from Booked? · Not yet"],
      ]),
    );
  });
});

describe("where focus goes when a step is removed", () => {
  it("to_the_plus_above_it_or_else_its_neighbours", () => {
    const focus = removalFocusOf(top, "/do/Book the courier");

    expect(focus).toEqual([
      "plus:/do:3",
      "step:/do/Send the licence",
      "step:/do/Booked?",
    ]);
  });

  it("finds_a_step_inside_a_block", () => {
    const focus = removalFocusOf(
      MONTH_END.steps,
      "/do/Prepare the batch/do/Fetch the invoices",
    );

    expect(focus).toEqual([
      "plus:/do/Prepare the batch/do:0",
      "step:/do/Prepare the batch/do/Add up the totals",
    ]);
  });

  it("has_nowhere_to_go_for_a_step_that_is_not_there", () => {
    const focus = removalFocusOf(top, "/do/Missing");

    expect(focus).toEqual([]);
  });
});

describe("the line between two steps", () => {
  const run = {
    steps: new Map([["/do/Read the order", ranFor("2 ms")]]),
    ended: false,
  };

  it.each([
    ["is_plain_outside_a_run", null, "/do/Read the order", "plain"],
    ["is_taken_into_a_reached_step", run, "/do/Read the order", "taken"],
    ["is_dim_into_a_step_not_reached", run, "/do/Which kind?", "dim"],
    ["is_dim_into_an_end_not_reached", run, "end", "dim"],
  ] as const)("%s", (_, shown, to, line) => {
    const drawn = lineOf(shown, "start", to);

    expect(drawn).toBe(line);
  });
});

describe("every step of a list, nested ones after their block", () => {
  it("a_block_is_followed_by_the_steps_inside_it", () => {
    const [prepare, each] = MONTH_END.steps.steps;

    if (prepare === undefined || each === undefined)
      throw new Error("Month-end has no first two steps");

    const names = stepsIn(MONTH_END.steps).map((step) => step.name);
    const under = stepsUnder(prepare).map((step) => step.name);

    expect(under).toEqual([
      prepare.name,
      "Fetch the invoices",
      "Add up the totals",
    ]);
    expect(names.slice(0, 5)).toEqual([
      ...under,
      each.name,
      "Send the invoice",
    ]);
  });
});

describe("a step found by its id and its place in its list", () => {
  it("a_nested_step_is_found_with_its_list_index_and_the_lists_size", () => {
    const [prepare] = MONTH_END.steps.steps;
    const inner = prepare?.lists[0];
    const added = inner?.steps[1];

    if (inner === undefined || added === undefined)
      throw new Error("Month-end has no nested steps");

    const found = stepWithId(MONTH_END.steps, added.id);
    const place = placeOf(MONTH_END.steps, added.id);

    expect(found).toBe(added);
    expect(place).toEqual({ list: inner.id, index: 1, size: 2 });
    expect(stepWithId(MONTH_END.steps, "nowhere")).toBeNull();
    expect(placeOf(MONTH_END.steps, "nowhere")).toBeNull();
  });
});
