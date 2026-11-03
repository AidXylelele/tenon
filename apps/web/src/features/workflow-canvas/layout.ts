import type {
  ELK,
  ElkExtendedEdge,
  ElkLabel,
  ElkNode,
  ElkPort,
  LayoutOptions,
} from 'elkjs/lib/elk-api';
import {
  CASE,
  type CanvasEdge,
  type CanvasNode,
  END,
  FAILURE,
  type Graph,
  OUT,
  SIZE,
  START,
} from './graph';

// Where ELK puts the graph (research R16): the layered algorithm, top to bottom or left to
// right, with groups laid out together with the edges that leave them, orthogonal edges, and
// labels placed so they overlap nothing. The document's order is kept.

export type Direction = 'down' | 'right';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Box extends Point {
  readonly width: number;
  readonly height: number;
}

// Relative to the parent group; its ports relative to the node.
export interface PlacedNode extends Box {
  readonly ports: Readonly<Record<string, Point>>;
}

// On the canvas, whatever group the edge runs in.
export interface PlacedEdge {
  readonly points: readonly Point[];
  readonly labels: readonly PlacedLabel[];
}

export interface PlacedLabel extends Box {
  // `label` for the edge's words, `add` for the button that adds a step on it.
  readonly role: 'label' | 'add';
}

export interface Placement {
  readonly nodes: ReadonlyMap<string, PlacedNode>;
  readonly edges: ReadonlyMap<string, PlacedEdge>;
  readonly width: number;
  readonly height: number;
}

export const IN = 'in';

const LABEL_HEIGHT = 20;
const CHARACTER = 6.6;
const LABEL_PAD = 20;
const ADD = 26;
const SEPARATOR = '::';

export async function placementOf(
  graph: Graph,
  direction: Direction,
  editable: boolean,
  elk: ELK,
): Promise<Placement> {
  const builder = new ElkGraph(graph, direction, editable);
  const input = builder.root();
  const output = await elk.layout(input);
  return placementFrom(output);
}

class ElkGraph {
  private readonly children = new Map<string | null, CanvasNode[]>();
  private readonly parents = new Map<string, string | null>();
  private readonly containers = new Map<string, ElkNode>();

  constructor(
    private readonly graph: Graph,
    private readonly direction: Direction,
    private readonly editable: boolean,
  ) {
    for (const node of graph.nodes) {
      const siblings = this.children.get(node.parentId) ?? [];
      siblings.push(node);
      this.children.set(node.parentId, siblings);
      this.parents.set(node.id, node.parentId);
    }
  }

  root(): ElkNode {
    const top = this.children.get(null) ?? [];
    const root: ElkNode = {
      id: 'root',
      layoutOptions: this.rootOptions(),
      children: top.map((node) => this.nodeOf(node)),
      edges: [],
    };

    for (const edge of this.graph.edges) {
      const container = this.containerOf(edge);
      const holder = container === null ? root : this.containers.get(container);
      holder?.edges?.push(this.edgeOf(edge));
    }

    return root;
  }

  private rootOptions(): LayoutOptions {
    return {
      'elk.algorithm': 'layered',
      'elk.direction': this.direction === 'down' ? 'DOWN' : 'RIGHT',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.layered.cycleBreaking.strategy': 'MODEL_ORDER',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
      'elk.spacing.nodeNode': '40',
      'elk.layered.spacing.nodeNodeBetweenLayers': '40',
      'elk.spacing.edgeNode': '24',
      'elk.spacing.edgeEdge': '14',
      'elk.layered.spacing.edgeNodeBetweenLayers': '14',
      'elk.layered.spacing.edgeEdgeBetweenLayers': '14',
      'elk.spacing.edgeLabel': '6',
      'elk.padding': '[top=24,left=24,bottom=24,right=24]',
      'org.eclipse.elk.json.edgeCoords': 'ROOT',
    };
  }

  private nodeOf(node: CanvasNode): ElkNode {
    const ports = this.portsOf(node);
    const open =
      (node.kind === 'group' || node.kind === 'handler') && !node.collapsed;

    if (!open)
      return {
        id: node.id,
        width: node.width,
        height: node.height,
        ports,
        layoutOptions: this.leafOptions(node),
      };

    const inside = this.children.get(node.id) ?? [];
    // ELK sizes a group around its steps; an empty one keeps the size of its heading.
    const size =
      inside.length > 0
        ? {}
        : {
            width: SIZE.task.width + SIZE.pad * 2,
            height: headerOf(node) + SIZE.pad,
          };
    const group: ElkNode = {
      id: node.id,
      ...size,
      ports,
      layoutOptions: this.groupOptions(node),
      children: inside.map((child) => this.nodeOf(child)),
      edges: [],
    };
    this.containers.set(node.id, group);
    return group;
  }

  private leafOptions(node: CanvasNode): LayoutOptions {
    const cases = node.cases.length > 0;
    return {
      'elk.portConstraints': cases ? 'FIXED_ORDER' : 'FIXED_SIDE',
      'elk.portAlignment.default': cases ? 'DISTRIBUTED' : 'CENTER',
    };
  }

  private groupOptions(node: CanvasNode): LayoutOptions {
    const top = headerOf(node);
    const pad = SIZE.pad;
    return {
      'elk.direction': this.direction === 'down' ? 'DOWN' : 'RIGHT',
      'elk.padding': `[top=${String(top)},left=${String(pad)},bottom=${String(pad)},right=${String(pad)}]`,
      'elk.portConstraints': 'FIXED_SIDE',
      'elk.portAlignment.default': 'CENTER',
    };
  }

  // A step takes edges in on one side and sends them on from the opposite one; a failure
  // leaves a `try` sideways; a choice's cases leave in order, one port each.
  private portsOf(node: CanvasNode): ElkPort[] {
    const down = this.direction === 'down';
    const before = down ? 'NORTH' : 'WEST';
    const after = down ? 'SOUTH' : 'EAST';
    const aside = down ? 'EAST' : 'SOUTH';
    const ports: ElkPort[] = [];

    if (node.id !== START) ports.push(portOf(node.id, IN, before, null));

    if (node.id === END || node.kind === 'add') return ports;

    const count = node.cases.length;

    node.cases.forEach((each, position) => {
      // Ports are ordered clockwise: on the south side that runs from east to west.
      const index = down ? count - position : position;
      const name = `${CASE}${String(each.index)}`;
      ports.push(portOf(node.id, name, after, index));
    });

    const last = down ? 0 : count;
    ports.push(portOf(node.id, OUT, after, count > 0 ? last : null));

    if (node.entry?.kind === 'try' && node.kind === 'group')
      ports.push(portOf(node.id, FAILURE, aside, null));

    return ports;
  }

  private edgeOf(edge: CanvasEdge): ElkExtendedEdge {
    const labels: ElkLabel[] = [];

    if (edge.label !== null)
      labels.push({
        id: `${edge.id}#label`,
        text: edge.label,
        width: edge.label.length * CHARACTER + LABEL_PAD,
        height: LABEL_HEIGHT,
      });

    // ELK places only labels with text; the button draws its own `+`.
    if (this.editable && edge.insertAt !== null)
      labels.push({ id: `${edge.id}#add`, text: '+', width: ADD, height: ADD });

    const straight = edge.kind === 'next' ? '10' : '1';
    return {
      id: edge.id,
      sources: [`${edge.source}${SEPARATOR}${edge.port}`],
      targets: [`${edge.target}${SEPARATOR}${IN}`],
      labels,
      layoutOptions: { 'elk.layered.priority.straightness': straight },
    };
  }

  // The deepest group that holds both ends of an edge, where ELK wants the edge declared.
  private containerOf(edge: CanvasEdge): string | null {
    const from = this.ancestorsOf(edge.source);
    const to = new Set(this.ancestorsOf(edge.target));
    return from.find((id) => to.has(id)) ?? null;
  }

  private ancestorsOf(id: string): string[] {
    const chain: string[] = [];

    for (
      let parent = this.parents.get(id) ?? null;
      parent !== null;
      parent = this.parents.get(parent) ?? null
    )
      chain.push(parent);

    return chain;
  }
}

// The height of a group's heading: its name and summary, then its detail and note rows.
function headerOf(node: CanvasNode): number {
  const rows = (node.note === null ? 0 : 1) + (node.detail === null ? 0 : 1);
  return SIZE.header + rows * SIZE.row;
}

function portOf(
  nodeId: string,
  name: string,
  side: string,
  index: number | null,
): ElkPort {
  const layoutOptions: LayoutOptions = { 'elk.port.side': side };

  if (index !== null) layoutOptions['elk.port.index'] = String(index);

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
      const name = port.id.slice(port.id.indexOf(SEPARATOR) + SEPARATOR.length);
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
        label.id?.endsWith('#add') === true
          ? ('add' as const)
          : ('label' as const),
    }));
    edges.set(edge.id, { points, labels });
  }
}
