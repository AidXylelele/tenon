import type {
  NestedList,
  Step,
  Transition,
  WorkflowStructure,
} from "language-server/protocol";
import { describe, expect, it } from "vitest";
import { containersOf, END, FAILURE, graphOf, START } from "./graph";

const READ = { editable: false, collapsed: new Set<string>() };
const EDIT = { editable: true, collapsed: new Set<string>() };

function done(to: string | null): Transition {
  return {
    condition: null,
    on: "done",
    case: null,
    when: null,
    kind: "next",
    to,
  };
}

function stepOf(
  id: string,
  kind: Step["kind"],
  flow: readonly Transition[],
  lists: readonly NestedList[] = [],
): Step {
  const name = id.split("/").at(-1) ?? id;
  return {
    variant: null,
    catch: null,
    id,
    pointer: id,
    name,
    kind,
    family: "data",
    summary: null,
    milliseconds: null,
    note: null,
    range: null,
    selectionRange: null,
    lists,
    flow,
  };
}

function listOf(
  id: string,
  part: NestedList["part"],
  steps: readonly Step[],
): NestedList {
  return { id, pointer: id, role: "sequence", part, steps };
}

function workflowOf(steps: readonly Step[]): WorkflowStructure {
  const root = { id: "/do", pointer: "/do", role: "sequence", steps } as const;
  return {
    namespace: "sales",
    name: "leads",
    title: null,
    triggers: [],
    steps: root,
  };
}

const sequence = workflowOf([
  stepOf("/do/fetch", "call", [done("/do/score")]),
  stepOf("/do/score", "set", [done(null)]),
]);

const guarded = workflowOf([
  stepOf(
    "/do/guard",
    "try",
    [done(null)],
    [
      listOf("/do/guard/try", "try", [
        stepOf("/do/guard/try/fetch", "call", [done(null)]),
      ]),
      listOf("/do/guard/catch/do", "catch", [
        stepOf("/do/guard/catch/do/recover", "set", [done(null)]),
      ]),
    ],
  ),
]);

describe("the canvas graph of a workflow's structure", () => {
  it("steps_follow_each_other_from_start_to_end", () => {
    const graph = graphOf(sequence, READ);
    const edges = graph.edges.map((edge) => `${edge.source}>${edge.target}`);

    expect(edges).toEqual([
      `${START}>/do/fetch`,
      "/do/fetch>/do/score",
      `/do/score>${END}`,
    ]);
  });

  it("an_edge_between_two_steps_is_where_a_step_goes_in", () => {
    const graph = graphOf(sequence, EDIT);
    const between = graph.edges.find((edge) => edge.target === "/do/score");

    expect(between?.insertAt).toEqual({ list: "/do", index: 1 });
  });

  it("a_try_is_a_block_and_its_catch_a_handler_joined_by_a_failure_edge", () => {
    const graph = graphOf(guarded, READ);
    const kinds = graph.nodes.map((node) => `${node.id}:${node.kind}`);
    const failure = graph.edges.find((edge) => edge.port === FAILURE);

    expect(kinds).toContain("/do/guard:group");
    expect(kinds).toContain("/do/guard/catch/do:handler");
    expect(failure?.target).toBe("/do/guard/catch/do");
  });

  it("a_closed_block_hides_its_steps", () => {
    const collapsed = new Set(["/do/guard"]);
    const graph = graphOf(guarded, { editable: false, collapsed });
    const ids = graph.nodes.map((node) => node.id);

    expect(ids).not.toContain("/do/guard/try/fetch");
  });

  it("an_empty_workflow_being_edited_offers_its_first_step", () => {
    const empty = workflowOf([]);
    const graph = graphOf(empty, EDIT);
    const add = graph.nodes.find((node) => node.kind === "add");

    expect(add?.addTo).toEqual({ list: "/do", index: 0 });
  });

  it("the_blocks_are_every_group_and_handler", () => {
    const blocks = containersOf(guarded);

    expect(blocks).toEqual(["/do/guard", "/do/guard/catch/do"]);
  });
});
