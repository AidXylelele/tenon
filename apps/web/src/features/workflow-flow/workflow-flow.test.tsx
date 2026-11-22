import { fireEvent, render, screen, within } from "@testing-library/react";
import type { WorkflowStructure } from "language-server/protocol";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import {
  type EditMode,
  type FlowMode,
  type RunMode,
  START,
  type StepMark,
  type StepRun,
  WorkflowFlow,
} from ".";
import {
  DAILY_DIGEST,
  EMPTY_REPEAT,
  MONTH_END,
  NEW_WORKFLOW,
  ORDER_ROUTER,
  ranFor,
} from "./workflows.test-support";

const NO_MARKS: ReadonlyMap<string, StepMark> = new Map();

const READING: FlowMode = { kind: "read" };

const FETCH = "/do/Fetch the digest";

const POST = "/do/Post the items";

const EACH = "/do/For each invoice";

function editing(changes: Partial<EditMode> = {}): EditMode {
  return {
    kind: "edit",
    marks: NO_MARKS,
    inserting: null,
    onInsert: vi.fn(),
    onEdit: vi.fn(),
    ...changes,
  };
}

function running(changes: Partial<RunMode> = {}): RunMode {
  return {
    kind: "run",
    start: { title: "Started by hand", detail: "Administrator, by hand" },
    steps: new Map(),
    ended: false,
    onIteration: vi.fn(),
    ...changes,
  };
}

function iterating(shown: number): RunMode {
  const repeat = ranFor("3 iterations · 441 ms");
  const iteration = { shown, count: 3 };
  const steps = new Map<string, StepRun>([[EACH, { ...repeat, iteration }]]);

  return running({ steps });
}

function draw(
  workflow: WorkflowStructure,
  mode: FlowMode,
  selected: string | null = null,
) {
  const onSelect = vi.fn();
  const flow = (
    <WorkflowFlow
      workflow={workflow}
      mode={mode}
      selected={selected}
      onSelect={onSelect}
    />
  );
  const shown = render(<TooltipProvider>{flow}</TooltipProvider>);

  return { onSelect, shown };
}

function drawStill(workflow: WorkflowStructure) {
  const flow = <WorkflowFlow workflow={workflow} mode={READING} />;

  render(<TooltipProvider>{flow}</TooltipProvider>);
}

function stepButton(name: string): HTMLElement {
  const starts = new RegExp(`^${name}`);

  return screen.getByRole("button", { name: starts });
}

function button(name: string): HTMLElement {
  return screen.getByRole("button", { name });
}

function canvas(name: string): HTMLElement {
  return screen.getByRole("region", { name });
}

describe("the flow of a draft", () => {
  it("is_a_section_named_for_what_it_shows", () => {
    const mode = editing();
    draw(DAILY_DIGEST, mode);

    const region = canvas("The workflow's flow");

    expect(region).toBeInTheDocument();
  });

  it("starts_with_how_the_workflow_starts", () => {
    const mode = editing();
    draw(DAILY_DIGEST, mode);

    const start = screen.getByRole("group", {
      name: "Start: Every day at 09:00 UTC",
    });

    expect(start).toHaveTextContent("Every day at 09:00 UTCOn a schedule");
  });

  it("names_each_step_by_its_kind_and_shows_its_summary", () => {
    const mode = editing();
    draw(DAILY_DIGEST, mode);

    const fetch = screen.getByRole("group", {
      name: "Call a service: Fetch the digest",
    });

    expect(fetch).toHaveTextContent("GET https://httpbin.org/json");
  });

  it("ends_with_the_end", () => {
    const mode = editing();
    draw(DAILY_DIGEST, mode);

    const end = screen.getByText("End");

    expect(end).toBeInTheDocument();
  });

  it("marks_the_selected_step_as_current", () => {
    const mode = editing();
    draw(DAILY_DIGEST, mode, FETCH);

    const fetch = stepButton("Fetch the digest");

    expect(fetch).toHaveAttribute("aria-current", "true");
  });

  it("selects_a_step_when_it_is_pressed", () => {
    const mode = editing();
    const { onSelect } = draw(DAILY_DIGEST, mode);
    const post = stepButton("Post the items");

    fireEvent.click(post);

    expect(onSelect).toHaveBeenCalledWith(POST);
  });

  it("selects_the_start_when_it_is_pressed", () => {
    const mode = editing();
    const { onSelect } = draw(DAILY_DIGEST, mode);
    const start = stepButton("Every day at 09:00 UTC");

    fireEvent.click(start);

    expect(onSelect).toHaveBeenCalledWith(START);
  });

  it.each([
    [1, "1 problem: the address is missing"],
    [2, "2 problems: the address is missing"],
  ])("shows_%i_problems_on_its_step", (count, words) => {
    const problem: StepMark = {
      kind: "problem",
      count,
      message: "the address is missing",
    };
    const marks = new Map([[POST, problem]]);
    const mode = editing({ marks });
    draw(DAILY_DIGEST, mode);

    const post = stepButton("Post the items");

    expect(post).toHaveTextContent(words);
  });

  it("asks_to_fill_in_what_a_new_step_needs", () => {
    const fill: StepMark = { kind: "fill", what: "the address" };
    const marks = new Map([[POST, fill]]);
    const mode = editing({ marks });
    draw(DAILY_DIGEST, mode);

    const post = stepButton("Post the items");

    expect(post).toHaveTextContent("Fill in: the address");
  });
});

describe("adding steps", () => {
  it.each([
    [
      "a_plus_below_a_step_adds_after_it",
      "Add a step after Fetch the digest",
      1,
      "Fetch the digest",
    ],
    [
      "the_plus_under_the_start_adds_the_first_step",
      "Add a step before Fetch the digest",
      0,
      null,
    ],
    [
      "the_plus_above_the_end_adds_the_last_step",
      "Add a step after Post the items",
      3,
      "Post the items",
    ],
  ])("%s", (_, name, index, above) => {
    const mode = editing();
    draw(DAILY_DIGEST, mode);
    const plus = button(name);

    fireEvent.click(plus);

    expect(mode.onInsert).toHaveBeenCalledWith({
      kind: "list",
      list: "/do",
      index,
      above,
    });
  });

  it("a_branch's_plus_adds_a_step_on_that_branch", () => {
    const mode = editing();
    draw(DAILY_DIGEST, mode);
    const plus = button("Add a step on the branch Otherwise");

    fireEvent.click(plus);

    expect(mode.onInsert).toHaveBeenCalledWith({
      kind: "branch",
      switch: "/do/Has items?",
      case: "Otherwise",
    });
  });

  it("the_plus_at_the_end_of_a_block_adds_inside_it", () => {
    const mode = editing();
    draw(MONTH_END, mode);
    const plus = button("Add a step at the end of Prepare the batch");

    fireEvent.click(plus);

    expect(mode.onInsert).toHaveBeenCalledWith({
      kind: "list",
      list: "/do/Prepare the batch/do",
      index: 2,
      above: "Add up the totals",
    });
  });

  it("the_plus_whose_catalog_is_open_is_marked", () => {
    const inserting = {
      kind: "list",
      list: "/do",
      index: 1,
      above: "Fetch the digest",
    } as const;
    const mode = editing({ inserting });
    draw(DAILY_DIGEST, mode);

    const plus = button("Add a step after Fetch the digest");

    expect(plus).toHaveAttribute("aria-expanded", "true");
  });

  it("an_empty_workflow_offers_its_first_step", () => {
    const mode = editing();
    draw(NEW_WORKFLOW, mode);
    const plus = button("Add the first step");

    fireEvent.click(plus);

    const hint = screen.getByText("Add your first step with this +");
    expect(hint).toBeVisible();
    expect(mode.onInsert).toHaveBeenCalledWith({
      kind: "list",
      list: "/do",
      index: 0,
      above: null,
    });
  });

  it("an_empty_block_says_so_and_offers_its_first_step", () => {
    const mode = editing();
    draw(EMPTY_REPEAT, mode);
    const block = screen.getByRole("group", {
      name: "Repeat for each item: For each order",
    });
    const plus = within(block).getByRole("button", {
      name: "Add the first step inside For each order",
    });

    fireEvent.click(plus);

    const said = within(block).getAllByText("No steps inside yet");
    expect(said).toHaveLength(2);
    expect(mode.onInsert).toHaveBeenCalledWith({
      kind: "list",
      list: "/do/For each order/do",
      index: 0,
      above: null,
    });
  });

  it("no_plus_follows_a_step_that_does_not_continue", () => {
    const mode = editing();
    draw(ORDER_ROUTER, mode);

    const plus = screen.queryByRole("button", {
      name: "Add a step after Send the licence",
    });

    expect(plus).not.toBeInTheDocument();
  });
});

describe("the structure in the accessibility tree", () => {
  it("a_block_holds_its_steps", () => {
    const mode = editing();
    draw(MONTH_END, mode);

    const block = screen.getByRole("group", {
      name: "Group steps: Prepare the batch",
    });

    expect(block).toHaveTextContent("Fetch the invoices");
    expect(block).toHaveTextContent("Add up the totals");
  });

  it("a_fork's_branches_are_named_groups_side_by_side", () => {
    const mode = editing();
    draw(MONTH_END, mode);

    const email = screen.getByRole("group", { name: "Branch Email" });

    expect(email).toHaveTextContent("Email the summary");
  });

  it("the_try's_lane_is_a_named_group_with_its_steps", () => {
    const mode = editing();
    draw(MONTH_END, mode);

    const lane = screen.getByRole("group", {
      name: "If Archive the batch fails",
    });

    expect(lane).toHaveTextContent("Then: run these steps");
    expect(lane).toHaveTextContent("Mark as not archived");
  });

  it("a_choice's_branches_are_a_list", () => {
    const mode = editing();
    draw(DAILY_DIGEST, mode);
    const choice = screen.getByRole("group", {
      name: "Choose a path: Has items?",
    });

    const branches = within(choice).getByRole("list", { name: "Branches" });

    const rows = within(branches).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
  });
});

describe("branches and jumps", () => {
  it("a_branch_says_its_condition_and_where_it_goes", () => {
    const mode = editing();
    draw(ORDER_ROUTER, mode);

    const licence = stepButton("A licence");

    expect(licence).toHaveTextContent(
      'A licence${ .kind == "licence" }go to Send the licence',
    );
  });

  it("the_default_branch_says_when_it_is_taken", () => {
    const mode = editing();
    draw(ORDER_ROUTER, mode);

    const otherwise = stepButton("Otherwise");

    expect(otherwise).toHaveTextContent(
      "Otherwisewhen no other branch matchesEnd the run",
    );
  });

  it("a_branch_row_selects_its_choice", () => {
    const mode = editing();
    const { onSelect } = draw(ORDER_ROUTER, mode);
    const parcel = stepButton("A parcel");

    fireEvent.click(parcel);

    expect(onSelect).toHaveBeenCalledWith("/do/Which kind?");
  });

  it("a_jump's_target_says_where_it_comes_from", () => {
    const mode = editing();
    draw(ORDER_ROUTER, mode);

    const from = screen.getByText("from Which kind? · A parcel, Wait a minute");

    expect(from).toBeInTheDocument();
  });

  it("a_step_that_leaves_says_how_at_its_foot", () => {
    const mode = editing();
    draw(ORDER_ROUTER, mode);

    const wait = screen.getByRole("group", { name: "Wait: Wait a minute" });

    expect(wait).toHaveTextContent("go to Book the courier");
  });
});

describe("the keyboard", () => {
  it("makes_the_flow_one_tab_stop_at_the_selected_step", () => {
    const mode = editing();
    draw(DAILY_DIGEST, mode, "/do/Has items?");
    const region = canvas("The workflow's flow");
    const choice = stepButton("Has items?");

    const stops = region.querySelectorAll('[tabindex="0"]');

    expect(stops).toHaveLength(1);
    expect(stops[0]).toBe(choice);
  });

  it("enters_at_the_start_when_nothing_is_selected", () => {
    const mode = editing();
    draw(DAILY_DIGEST, mode);

    const start = stepButton("Every day at 09:00 UTC");

    expect(start).toHaveAttribute("tabindex", "0");
  });

  it.each([
    ["ArrowDown", "Fetch the digest", "Add a step after Fetch the digest"],
    ["ArrowUp", "Fetch the digest", "Add a step before Fetch the digest"],
    ["End", "Fetch the digest", "Add a step after Post the items"],
    ["Home", "Post the items", "Every day at 09:00 UTC"],
  ])("%s_from_%s_moves_to_%s", (key, from, to) => {
    const mode = editing();
    draw(DAILY_DIGEST, mode);
    const step = stepButton(from);
    step.focus();

    fireEvent.keyDown(step, { key });

    const reached = stepButton(to);
    expect(reached).toHaveFocus();
  });

  it("down_moves_from_a_plus_to_the_step_below_it", () => {
    const mode = editing();
    draw(DAILY_DIGEST, mode);
    const plus = button("Add a step after Fetch the digest");
    plus.focus();

    fireEvent.keyDown(plus, { key: "ArrowDown" });

    const choice = stepButton("Has items?");
    expect(choice).toHaveFocus();
  });

  it("escape_clears_the_selection", () => {
    const mode = editing();
    const { onSelect } = draw(DAILY_DIGEST, mode, FETCH);
    const fetch = stepButton("Fetch the digest");

    fireEvent.keyDown(fetch, { key: "Escape" });

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("leaves_keys_pressed_outside_its_controls_alone", () => {
    const mode = editing();
    const { onSelect } = draw(DAILY_DIGEST, mode, FETCH);
    const zoomIn = button("Zoom in");

    fireEvent.keyDown(zoomIn, { key: "Escape" });

    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("the selected step's menu", () => {
  async function chosen(item: string): Promise<HTMLElement> {
    const trigger = button("Step actions");
    fireEvent.keyDown(trigger, { key: "Enter" });

    return screen.findByRole("menuitem", { name: item });
  }

  it("moves_the_step_down_its_list", async () => {
    const mode = editing();
    draw(DAILY_DIGEST, mode, FETCH);
    const down = await chosen("Move down");

    fireEvent.click(down);

    expect(mode.onEdit).toHaveBeenCalledWith({
      kind: "moveStep",
      step: FETCH,
      list: "/do",
      index: 1,
    });
  });

  it("moves_the_step_up_its_list", async () => {
    const mode = editing();
    draw(DAILY_DIGEST, mode, POST);
    const up = await chosen("Move up");

    fireEvent.click(up);

    expect(mode.onEdit).toHaveBeenCalledWith({
      kind: "moveStep",
      step: POST,
      list: "/do",
      index: 1,
    });
  });

  it("cannot_move_the_first_step_up", async () => {
    const mode = editing();
    draw(DAILY_DIGEST, mode, FETCH);

    const up = await chosen("Move up");

    expect(up).toHaveAttribute("aria-disabled", "true");
  });

  it.each([
    ["Wrap in Try (retry if it fails)", "try"],
    ["Wrap in Repeat for each item", "for"],
    ["Wrap in a group", "do"],
  ] as const)("%s_wraps_the_step", async (item, block) => {
    const mode = editing();
    draw(DAILY_DIGEST, mode, POST);
    const wrap = await chosen(item);

    fireEvent.click(wrap);

    expect(mode.onEdit).toHaveBeenCalledWith({
      kind: "wrapSteps",
      steps: [POST],
      block,
      name: null,
    });
  });

  it("duplicates_the_step", async () => {
    const mode = editing();
    draw(DAILY_DIGEST, mode, POST);
    const duplicate = await chosen("Duplicate");

    fireEvent.click(duplicate);

    expect(mode.onEdit).toHaveBeenCalledWith({
      kind: "duplicateStep",
      step: POST,
    });
  });

  it("deletes_the_step_and_moves_focus_to_the_plus_above_it", async () => {
    const mode = editing();
    const { shown } = draw(DAILY_DIGEST, mode, POST);
    const remove = await chosen("Delete step");
    const kept = DAILY_DIGEST.steps.steps.slice(0, 2);
    const steps = { ...DAILY_DIGEST.steps, steps: kept };
    const without = { ...DAILY_DIGEST, steps };
    const redrawn = (
      <TooltipProvider>
        <WorkflowFlow workflow={without} mode={mode} onSelect={vi.fn()} />
      </TooltipProvider>
    );

    fireEvent.click(remove);
    shown.rerender(redrawn);

    const plus = button("Add a step after Has items?");
    expect(mode.onEdit).toHaveBeenCalledWith({
      kind: "removeStep",
      step: POST,
    });
    expect(plus).toHaveFocus();
  });

  it("is_only_on_the_selected_step", () => {
    const mode = editing();
    draw(DAILY_DIGEST, mode, POST);

    const menus = screen.getAllByRole("button", { name: "Step actions" });

    expect(menus).toHaveLength(1);
  });
});

describe("the flow of a run", () => {
  const steps = new Map<string, StepRun>([
    [FETCH, ranFor("189 ms")],
    [
      "/do/Has items?",
      { ...ranFor("0 ms"), branch: "If the answer has items" },
    ],
    [POST, ranFor("171 ms", "faulted")],
  ]);

  it("is_named_for_the_run", () => {
    const mode = running({ steps });
    draw(DAILY_DIGEST, mode);

    const region = canvas("The run's flow");

    expect(region).toBeInTheDocument();
  });

  it("starts_with_how_the_run_started", () => {
    const mode = running({ steps });
    draw(DAILY_DIGEST, mode);

    const start = screen.getByRole("group", { name: "Start: Started by hand" });

    expect(start).toHaveTextContent("Administrator, by hand");
  });

  it("shows_each_step's_status_in_words", () => {
    const mode = running({ steps });
    draw(DAILY_DIGEST, mode);

    const post = screen.getByRole("group", {
      name: "Call a service: Post the items",
    });

    expect(post).toHaveTextContent("Failed · 171 ms");
  });

  it("says_not_reached_for_what_the_run_did_not_come_to", () => {
    const mode = running();
    draw(DAILY_DIGEST, mode);

    const unreached = screen.getAllByText("Not reached");

    expect(unreached).toHaveLength(4);
  });

  it("ends_when_the_run_reached_the_end", () => {
    const mode = running({ steps, ended: true });
    draw(DAILY_DIGEST, mode);

    const end = screen.getByText("End");

    expect(end).toBeInTheDocument();
  });

  it("shows_the_branch_taken_and_the_ones_not_taken", () => {
    const mode = running({ steps });
    draw(DAILY_DIGEST, mode);

    const taken = stepButton("If the answer");
    const other = stepButton("Otherwise");

    expect(taken).toHaveTextContent("continues");
    expect(other).toHaveTextContent("not taken");
  });

  it("offers_no_plus_and_no_menu", () => {
    const mode = running({ steps });
    draw(DAILY_DIGEST, mode, FETCH);

    const plus = screen.queryByRole("button", { name: /^Add a step/ });
    const menu = screen.queryByRole("button", { name: "Step actions" });

    expect(plus).not.toBeInTheDocument();
    expect(menu).not.toBeInTheDocument();
  });

  it("enters_at_a_step_when_its_start_is_no_control", () => {
    const mode = running({ steps });
    draw(DAILY_DIGEST, mode);

    const fetch = stepButton("Fetch the digest");

    expect(fetch).toHaveAttribute("tabindex", "0");
  });
});

describe("the iterations of a repeat in a run", () => {
  it("says_which_iteration_is_shown", () => {
    const mode = iterating(3);
    draw(MONTH_END, mode);

    const iteration = screen.getByRole("group", { name: "Iteration" });

    expect(iteration).toHaveTextContent("3 of 3");
  });

  it("asks_for_the_previous_iteration", () => {
    const mode = iterating(3);
    draw(MONTH_END, mode);
    const previous = button("Previous iteration");

    fireEvent.click(previous);

    expect(mode.onIteration).toHaveBeenCalledWith(EACH, 2);
  });

  it("asks_for_the_next_iteration", () => {
    const mode = iterating(1);
    draw(MONTH_END, mode);
    const following = button("Next iteration");

    fireEvent.click(following);

    expect(mode.onIteration).toHaveBeenCalledWith(EACH, 2);
  });

  it("goes_no_further_than_the_last", () => {
    const mode = iterating(3);
    draw(MONTH_END, mode);
    const following = button("Next iteration");

    fireEvent.click(following);

    expect(following).toHaveAttribute("aria-disabled", "true");
    expect(mode.onIteration).not.toHaveBeenCalled();
  });

  it("jumps_to_the_last", () => {
    const mode = iterating(1);
    draw(MONTH_END, mode);
    const last = button("Last iteration");

    fireEvent.click(last);

    expect(mode.onIteration).toHaveBeenCalledWith(EACH, 3);
  });
});

describe("a version read on its own", () => {
  it("shows_its_steps_as_text_not_controls", () => {
    drawStill(DAILY_DIGEST);

    const text = screen.getByText("Fetch the digest");
    const control = screen.queryByRole("button", { name: /^Fetch the digest/ });

    expect(text).toBeInTheDocument();
    expect(control).not.toBeInTheDocument();
  });

  it("lets_the_keyboard_scroll_the_canvas", () => {
    drawStill(DAILY_DIGEST);

    const region = canvas("The workflow's flow");

    expect(region).toHaveAttribute("tabindex", "0");
  });
});
