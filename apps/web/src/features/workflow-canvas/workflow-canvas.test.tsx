import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Edge, Node, ReactFlowProps } from "@xyflow/react";
import type {
  NestedList,
  Step,
  Transition,
  WorkflowStructure,
} from "language-server/protocol";
import type { ComponentType, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Graph, Placement } from "@/operations/workflow-graph";
import type { CanvasNodeData, FlowEdgeData } from "./interfaces";
import { setCollapsed } from "./view-preferences";
import { WorkflowCanvas } from "./workflow-canvas";

type Flow = ReactFlowProps<Node<CanvasNodeData>, Edge<FlowEdgeData>>;

const { placementOf } = vi.hoisted(() => ({
  placementOf: vi.fn<(graph: Graph) => Promise<Placement>>(),
}));
let flow: Flow | null = null;

vi.mock("@/operations/workflow-graph", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/operations/workflow-graph")>();
  return { ...actual, placementOf };
});

vi.mock("@/libs/ui/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/react")>();
  return {
    ...actual,
    ReactFlowProvider: ({ children }: { readonly children: ReactNode }) =>
      children,
    useReactFlow: () => ({ fitView: vi.fn(), setViewport: vi.fn() }),
    ReactFlow: (props: Flow) => {
      flow = props;
      return (
        <div>
          {props.nodes?.map((node) => {
            const Type = props.nodeTypes?.[node.type ?? ""] as
              ComponentType<{ readonly data: unknown }> | undefined;

            if (Type === undefined) return null;

            return (
              <div
                key={node.id}
                onClick={(event) => props.onNodeClick?.(event, node)}
              >
                <Type data={node.data} />
              </div>
            );
          })}
          {props.children}
        </div>
      );
    },
    Background: () => null,
    Controls: () => null,
    MiniMap: () => null,
    Panel: ({ children }: { readonly children: ReactNode }) => (
      <div>{children}</div>
    ),
    Handle: () => null,
  };
});

function placementFor(graph: Graph): Placement {
  const box = { x: 0, y: 0, width: 200, height: 60, ports: {} };
  const nodes = new Map(graph.nodes.map((node) => [node.id, box]));
  const line = {
    points: [
      { x: 0, y: 0 },
      { x: 0, y: 10 },
    ],
    labels: [],
  };
  const edges = new Map(graph.edges.map((edge) => [edge.id, line]));
  return { nodes, edges, width: 400, height: 400 };
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

function step(
  id: string,
  kind: Step["kind"],
  lists: readonly NestedList[] = [],
  line = 0,
): Step {
  const name = id.split("/").at(-1) ?? id;
  const start = { line, character: 2 };
  const range = { start, end: start };
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
    range,
    selectionRange: range,
    lists,
    flow: [next(null)],
  };
}

function workflowAt(line: number): WorkflowStructure {
  const inner = step("/do/each/do/inner", "set", [], line + 2);
  const each = step(
    "/do/each",
    "for",
    [
      {
        id: "/do/each/do",
        pointer: "/do/each/do",
        role: "sequence",
        part: "do",
        steps: [inner],
      },
    ],
    line + 1,
  );
  const fetch = step("/do/fetch", "set", [], line);
  return {
    namespace: "sales",
    name: "leads",
    title: null,
    triggers: [],
    steps: {
      id: "/do",
      pointer: "/do",
      role: "sequence",
      steps: [fetch, each],
    },
  };
}

const onSelect = vi.fn<(step: string | null) => void>();
const editing = { onInsert: vi.fn(), onRemove: vi.fn() };

describe("the workflow canvas", () => {
  beforeEach(() => {
    flow = null;
    placementOf.mockReset();
    placementOf.mockImplementation((graph) =>
      Promise.resolve(placementFor(graph)),
    );
    onSelect.mockReset();
    editing.onRemove.mockReset();
    setCollapsed("sales/leads", []);
  });

  it("an_equal_structure_with_other_ranges_is_not_laid_out_again", async () => {
    const view = render(
      <WorkflowCanvas workflow={workflowAt(0)} scope="sales/leads" />,
    );
    await screen.findByRole("button", { name: "fetch, Set data" });

    view.rerender(
      <WorkflowCanvas workflow={workflowAt(5)} scope="sales/leads" />,
    );

    expect(placementOf).toHaveBeenCalledOnce();
  });

  it("reading_offers_no_add_and_no_delete", async () => {
    render(<WorkflowCanvas workflow={workflowAt(0)} scope="sales/leads" />);
    const fetch = await screen.findByRole("button", {
      name: "fetch, Set data",
    });

    fireEvent.keyDown(fetch, { key: "Delete" });

    expect(screen.queryByText("Add task")).toBeNull();
    expect(editing.onRemove).not.toHaveBeenCalled();
  });

  it("a_click_or_enter_picks_the_step", async () => {
    render(
      <WorkflowCanvas
        workflow={workflowAt(0)}
        scope="sales/leads"
        onSelect={onSelect}
      />,
    );
    const fetch = await screen.findByRole("button", {
      name: "fetch, Set data",
    });

    fireEvent.click(fetch);
    fireEvent.keyDown(fetch, { key: "Enter" });

    expect(onSelect.mock.calls).toEqual([["/do/fetch"], ["/do/fetch"]]);
  });

  it("delete_removes_the_step_while_editing", async () => {
    render(
      <WorkflowCanvas
        workflow={workflowAt(0)}
        scope="sales/leads"
        editing={editing}
      />,
    );
    const fetch = await screen.findByRole("button", {
      name: "fetch, Set data",
    });

    fireEvent.keyDown(fetch, { key: "Delete" });

    expect(editing.onRemove).toHaveBeenCalledWith("/do/fetch");
    expect(screen.getAllByText("Add task").length).toBeGreaterThan(0);
  });

  it("closing_every_block_hides_their_steps", async () => {
    render(<WorkflowCanvas workflow={workflowAt(0)} scope="sales/leads" />);
    await screen.findByRole("button", { name: "inner, Set data" });

    fireEvent.click(screen.getByRole("button", { name: "Close every block" }));

    await waitFor(() => {
      const ids = flow?.nodes?.map((node) => node.id) ?? [];
      expect(ids).not.toContain("/do/each/do/inner");
    });
  });
});
