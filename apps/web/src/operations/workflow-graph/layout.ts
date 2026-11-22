import type {
  ElkExtendedEdge,
  ElkLabel,
  ElkNode,
  ElkPort,
  LayoutOptions,
} from "elkjs/lib/elk-api";
import { elkEngine } from "@/libs/flow/elk-engine";
import { CASE, END, FAILURE, IN, OUT, SIZE, START } from "./graph";
import type {
  CanvasEdge,
  CanvasNode,
  Direction,
  Graph,
  PlacedEdge,
  PlacedNode,
  Placement,
  Point,
} from "./interfaces";

const LABEL_HEIGHT = 20;
const CHARACTER = 6.6;
const LABEL_PAD = 20;
const ADD = 26;
const SEPARATOR = "::";

interface Tree {
  readonly graph: Graph;
  readonly direction: Direction;
  readonly editable: boolean;
  readonly children: ReadonlyMap<string | null, readonly CanvasNode[]>;
  readonly parents: ReadonlyMap<string, string | null>;
  readonly containers: Map<string, ElkNode>;
}

export async function placementOf(
  graph: Graph,
  direction: Direction,
  editable: boolean,
): Promise<Placement> {
  const elk = await elkEngine();
  const tree = treeOf(graph, direction, editable);
  const input = rootOf(tree);
  const output = await elk.layout(input);
  return placementFrom(output);
}

function treeOf(graph: Graph, direction: Direction, editable: boolean): Tree {
  const children = new Map<string | null, CanvasNode[]>();
  const parents = new Map<string, string | null>();

  for (const node of graph.nodes) {
    const siblings = children.get(node.parentId) ?? [];
    children.set(node.parentId, [...siblings, node]);
    parents.set(node.id, node.parentId);
  }

  return {
    graph,
    direction,
    editable,
    children,
    parents,
    containers: new Map(),
  };
}

function rootOf(tree: Tree): ElkNode {
  const top = tree.children.get(null) ?? [];
  const children = top.map((node) => elkNodeOf(tree, node));
  const root: ElkNode = {
    id: "root",
    layoutOptions: rootOptionsOf(tree.direction),
    children,
    edges: [],
  };

  for (const edge of tree.graph.edges) {
    const container = containerOf(tree, edge);
    const holder = container === null ? root : tree.containers.get(container);
    const elkEdge = elkEdgeOf(tree, edge);
    holder?.edges?.push(elkEdge);
  }

  return root;
}

function rootOptionsOf(direction: Direction): LayoutOptions {
  return {
    "elk.algorithm": "layered",
    "elk.direction": direction === "down" ? "DOWN" : "RIGHT",
    "elk.hierarchyHandling": "INCLUDE_CHILDREN",
    "elk.edgeRouting": "ORTHOGONAL",
    "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
    "elk.layered.cycleBreaking.strategy": "MODEL_ORDER",
    "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
    "elk.layered.nodePlacement.bk.fixedAlignment": "BALANCED",
    "elk.spacing.nodeNode": "40",
    "elk.layered.spacing.nodeNodeBetweenLayers": "40",
    "elk.spacing.edgeNode": "24",
    "elk.spacing.edgeEdge": "14",
    "elk.layered.spacing.edgeNodeBetweenLayers": "14",
    "elk.layered.spacing.edgeEdgeBetweenLayers": "14",
    "elk.spacing.edgeLabel": "6",
    "elk.padding": "[top=24,left=24,bottom=24,right=24]",
    "org.eclipse.elk.json.edgeCoords": "ROOT",
  };
}

function elkNodeOf(tree: Tree, node: CanvasNode): ElkNode {
  const ports = portsOf(tree.direction, node);
  const container = node.kind === "group" || node.kind === "handler";
  const open = container && !node.collapsed;

  if (!open)
    return {
      id: node.id,
      width: node.width,
      height: node.height,
      ports,
      layoutOptions: leafOptionsOf(node),
    };

  const inside = tree.children.get(node.id) ?? [];
  const header = headerOf(node);
  const empty = {
    width: SIZE.task.width + SIZE.pad * 2,
    height: header + SIZE.pad,
  };
  const size = inside.length > 0 ? {} : empty;
  const group: ElkNode = {
    id: node.id,
    ...size,
    ports,
    layoutOptions: groupOptionsOf(tree.direction, header),
    children: inside.map((child) => elkNodeOf(tree, child)),
    edges: [],
  };
  tree.containers.set(node.id, group);
  return group;
}

function leafOptionsOf(node: CanvasNode): LayoutOptions {
  const cases = node.cases.length > 0;
  return {
    "elk.portConstraints": cases ? "FIXED_ORDER" : "FIXED_SIDE",
    "elk.portAlignment.default": cases ? "DISTRIBUTED" : "CENTER",
  };
}

function groupOptionsOf(direction: Direction, header: number): LayoutOptions {
  const top = String(header);
  const pad = String(SIZE.pad);
  return {
    "elk.direction": direction === "down" ? "DOWN" : "RIGHT",
    "elk.padding": `[top=${top},left=${pad},bottom=${pad},right=${pad}]`,
    "elk.portConstraints": "FIXED_SIDE",
    "elk.portAlignment.default": "CENTER",
  };
}

function portsOf(direction: Direction, node: CanvasNode): ElkPort[] {
  const down = direction === "down";
  const before = down ? "NORTH" : "WEST";
  const after = down ? "SOUTH" : "EAST";
  const aside = down ? "EAST" : "SOUTH";
  const ports: ElkPort[] = [];

  if (node.id !== START) ports.push(portOf(node.id, IN, before, null));

  if (node.id === END || node.kind === "add") return ports;

  const count = node.cases.length;

  node.cases.forEach((each, position) => {
    const index = down ? count - position : position;
    const name = `${CASE}${String(each.index)}`;
    ports.push(portOf(node.id, name, after, index));
  });

  const last = down ? 0 : count;
  const outIndex = count > 0 ? last : null;
  ports.push(portOf(node.id, OUT, after, outIndex));

  if (node.failing) ports.push(portOf(node.id, FAILURE, aside, null));

  return ports;
}

function elkEdgeOf(tree: Tree, edge: CanvasEdge): ElkExtendedEdge {
  const labels: ElkLabel[] = [];

  if (edge.label !== null)
    labels.push({
      id: `${edge.id}#label`,
      text: edge.label,
      width: edge.label.length * CHARACTER + LABEL_PAD,
      height: LABEL_HEIGHT,
    });

  if (tree.editable && edge.insertAt !== null)
    labels.push({ id: `${edge.id}#add`, text: "+", width: ADD, height: ADD });

  const straight = edge.kind === "next" ? "10" : "1";
  return {
    id: edge.id,
    sources: [`${edge.source}${SEPARATOR}${edge.port}`],
    targets: [`${edge.target}${SEPARATOR}${IN}`],
    labels,
    layoutOptions: { "elk.layered.priority.straightness": straight },
  };
}

function containerOf(tree: Tree, edge: CanvasEdge): string | null {
  const from = ancestorsOf(tree, edge.source);
  const to = new Set(ancestorsOf(tree, edge.target));
  return from.find((id) => to.has(id)) ?? null;
}

function ancestorsOf(tree: Tree, id: string): string[] {
  const parent = tree.parents.get(id) ?? null;

  if (parent === null) return [];

  return [parent, ...ancestorsOf(tree, parent)];
}

function headerOf(node: CanvasNode): number {
  const note = node.step?.note ?? null;
  const rows = note === null ? 0 : 1;
  return SIZE.header + rows * SIZE.row;
}

function portOf(
  nodeId: string,
  name: string,
  side: string,
  index: number | null,
): ElkPort {
  const sideOnly = { "elk.port.side": side };
  const layoutOptions: LayoutOptions =
    index === null
      ? sideOnly
      : { ...sideOnly, "elk.port.index": String(index) };

  return {
    id: `${nodeId}${SEPARATOR}${name}`,
    width: 1,
    height: 1,
    layoutOptions,
  };
}

function placementFrom(root: ElkNode): Placement {
  const nodes = new Map<string, PlacedNode>();
  const edges = new Map<string, PlacedEdge>();
  collect(root, nodes, edges);
  return {
    nodes,
    edges,
    width: root.width ?? 0,
    height: root.height ?? 0,
  };
}

function collect(
  node: ElkNode,
  nodes: Map<string, PlacedNode>,
  edges: Map<string, PlacedEdge>,
): void {
  for (const child of node.children ?? []) {
    const ports: Record<string, Point> = {};

    for (const port of child.ports ?? []) {
      const at = port.id.indexOf(SEPARATOR) + SEPARATOR.length;
      const name = port.id.slice(at);
      ports[name] = { x: port.x ?? 0, y: port.y ?? 0 };
    }

    nodes.set(child.id, {
      x: child.x ?? 0,
      y: child.y ?? 0,
      width: child.width ?? 0,
      height: child.height ?? 0,
      ports,
    });
    collect(child, nodes, edges);
  }

  for (const edge of node.edges ?? []) {
    const points = (edge.sections ?? []).flatMap((section) => [
      section.startPoint,
      ...(section.bendPoints ?? []),
      section.endPoint,
    ]);
    const labels = (edge.labels ?? []).map((label) => ({
      x: label.x ?? 0,
      y: label.y ?? 0,
      width: label.width ?? 0,
      height: label.height ?? 0,
      role:
        label.id?.endsWith("#add") === true
          ? ("add" as const)
          : ("label" as const),
    }));
    edges.set(edge.id, { points, labels });
  }
}
