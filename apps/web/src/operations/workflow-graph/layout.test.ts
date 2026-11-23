import ELK from "elkjs/lib/elk.bundled.js";
import type {
  NestedList,
  Step,
  Transition,
  WorkflowStructure,
} from "language-server/protocol";
import { describe, expect, it, vi } from "vitest";
import { graphOf } from "./graph";
import type { Direction, Graph, Placement, Point } from "./interfaces";
import { placementOf } from "./layout";

vi.mock("@/libs/flow/elk-engine", () => ({
  elkEngine: () => Promise.resolve(new ELK()),
}));

interface Box extends Point {
  readonly width: number;
  readonly height: number;
}

function next(to: string | null): Transition {
  return {
    condition: null,
    on: "done",
    case: null,
    when: null,
    kind: "next",
    to,
  };
}

function jump(name: string, when: string | null, to: string): Transition {
  return { condition: null, on: "case", case: name, when, kind: "jump", to };
}

function step(
  id: string,
  kind: Step["kind"],
  flow: readonly Transition[],
  lists: readonly NestedList[] = [],
): Step {
  const name = id.split("/").at(-1) ?? id;
  const range = null;
  const base = { id, pointer: id, name, kind, family: "data" } as const;
  return {
    variant: null,
    catch: null,
    ...base,
    summary: null,
    milliseconds: null,
    note: null,
    range,
    selectionRange: range,
    lists,
    flow,
  };
}

function list(
  id: string,
  part: NestedList["part"],
  steps: readonly Step[],
  role: NestedList["role"] = "sequence",
): NestedList {
  return { id, pointer: id, role, part, steps };
}

const pipeline: WorkflowStructure = {
  namespace: "sales",
  name: "lead-pipeline",
  title: null,
  triggers: [],
  steps: {
    id: "/do",
    pointer: "/do",
    role: "sequence",
    steps: [
      step("/do/fetchLead", "set", [next("/do/route")]),
      step("/do/route", "switch", [
        jump("hot", "${ .score > 50 }", "/do/enrich"),
        jump("cold", null, "/do/archive"),
      ]),
      step(
        "/do/enrich",
        "try",
        [next("/do/eachTouch")],
        [
          list("/do/enrich/try", "try", [
            step("/do/enrich/try/callCrm", "call", [
              next("/do/enrich/try/merge"),
            ]),
            step("/do/enrich/try/merge", "set", [next(null)]),
          ]),
          list("/do/enrich/catch/do", "catch", [
            step("/do/enrich/catch/do/useCache", "set", [next(null)]),
          ]),
        ],
      ),
      step(
        "/do/eachTouch",
        "for",
        [next("/do/notifyAll")],
        [
          list("/do/eachTouch/do", "do", [
            step("/do/eachTouch/do/pauseBetween", "wait", [next(null)]),
          ]),
        ],
      ),
      step(
        "/do/notifyAll",
        "fork",
        [next("/do/archive")],
        [
          list(
            "/do/notifyAll/fork/branches",
            "branches",
            [
              step("/do/notifyAll/fork/branches/email", "set", [next(null)]),
              step("/do/notifyAll/fork/branches/slack", "set", [next(null)]),
            ],
            "branches",
          ),
        ],
      ),
      step("/do/archive", "set", [
        {
          condition: null,
          on: "done",
          case: null,
          when: null,
          kind: "end",
          to: null,
        },
      ]),
    ],
  },
};

async function placed(
  direction: Direction,
  editable = false,
): Promise<{ graph: Graph; placement: Placement }> {
  const graph = graphOf(pipeline, { editable, collapsed: new Set() });
  const placement = await placementOf(graph, direction, editable);
  return { graph, placement };
}

function absolute(graph: Graph, placement: Placement): Map<string, Box> {
  const boxes = new Map<string, Box>();

  for (const node of graph.nodes) {
    const own = placement.nodes.get(node.id);

    if (own === undefined) continue;

    const parent = node.parentId === null ? null : boxes.get(node.parentId);
    boxes.set(node.id, {
      x: own.x + (parent?.x ?? 0),
      y: own.y + (parent?.y ?? 0),
      width: own.width,
      height: own.height,
    });
  }

  return boxes;
}

function apart(a: Box, b: Box): boolean {
  return (
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

describe("the canvas laid out by ELK", () => {
  it("keeps_the_steps_order_from_top_to_bottom", async () => {
    const { graph, placement } = await placed("down");
    const boxes = absolute(graph, placement);
    const order = [
      "start",
      "/do/fetchLead",
      "/do/route",
      "/do/enrich",
      "/do/eachTouch",
      "/do/notifyAll",
      "/do/archive",
      "end",
    ];
    const tops = order.map((id) => boxes.get(id)?.y ?? Number.NaN);

    expect(tops).toEqual(tops.toSorted((a, b) => a - b));
  });

  it.each<Direction>(["down", "right"])(
    "puts_no_two_steps_over_each_other_%s",
    async (direction) => {
      const { graph, placement } = await placed(direction, true);
      const boxes = absolute(graph, placement);
      const leaves = graph.nodes.filter(
        (node) => node.kind !== "group" && node.kind !== "handler",
      );
      const overlaps = leaves.flatMap((one, index) =>
        leaves.slice(index + 1).flatMap((other) => {
          const a = boxes.get(one.id);
          const b = boxes.get(other.id);
          const clear = a === undefined || b === undefined || apart(a, b);
          return clear ? [] : [`${one.id} over ${other.id}`];
        }),
      );

      expect(overlaps).toEqual([]);
    },
  );

  it("places_every_edge_its_labels_and_its_add_buttons", async () => {
    const { graph, placement } = await placed("down", true);
    const missing = graph.edges.filter(
      (edge) => (placement.edges.get(edge.id)?.points.length ?? 0) < 2,
    );
    const hot = graph.edges.find((edge) => edge.label === "hot");
    const labels = placement.edges.get(hot?.id ?? "")?.labels ?? [];
    const onward = graph.edges.find((edge) => edge.insertAt !== null);
    const add = placement.edges.get(onward?.id ?? "")?.labels ?? [];

    expect(missing.map((edge) => edge.id)).toEqual([]);
    expect(labels.map((label) => label.role)).toEqual(["label"]);
    expect(add.map((label) => label.role)).toContain("add");
  });

  it("sends_the_cases_of_a_choice_from_left_to_right_in_their_order", async () => {
    const { placement } = await placed("down");
    const ports = placement.nodes.get("/do/route")?.ports ?? {};

    expect(ports["case-0"]?.x).toBeLessThan(ports["case-1"]?.x ?? 0);
  });
});
