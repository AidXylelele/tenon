import type { JsonObject } from '@/libs/data-access/types';
import { isObject } from '../document/json';
import {
  entriesAt,
  nestedListsOf,
  ROOT_LIST,
  type TaskEntry,
} from '../document/tasks';

// A document as a graph on the canvas, laid out by its own structure (research R11): a list
// runs left to right, a container holds its lanes, a fork stacks its branches, and only what
// the DSL says becomes an edge: the next step, a case of a switch, a `then`, the end.

export const SIZE = {
  node: { width: 236, height: 64 },
  start: { width: 216, height: 64 },
  end: { width: 64, height: 64 },
  add: { width: 120, height: 40 },
  gapX: 64,
  gapY: 24,
  header: 52,
  pad: 20,
  laneLabel: 26,
  case: 24,
} as const;

export type CanvasNodeKind = 'start' | 'end' | 'task' | 'container' | 'add';

export interface Lane {
  readonly label: string;
  readonly pointer: string;
  // Relative to the container's top-left corner.
  readonly y: number;
  readonly height: number;
}

export interface Case {
  readonly name: string;
  readonly then: string;
  readonly when: string | null;
}

export interface CanvasNode {
  readonly id: string;
  readonly kind: CanvasNodeKind;
  // Relative to the parent container, or to the canvas when there is none.
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly parentId: string | null;
  readonly entry: TaskEntry | null;
  readonly lanes: readonly Lane[];
  readonly cases: readonly Case[];
  // Where an `add` node adds a step.
  readonly addTo: {
    readonly listPointer: string;
    readonly index: number;
  } | null;
}

export type EdgeKind = 'next' | 'case' | 'jump' | 'end' | 'append';

export interface CanvasEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly sourceHandle: string | null;
  readonly kind: EdgeKind;
  readonly label: string | null;
  // A step added on this edge goes here.
  readonly insertAt: {
    readonly listPointer: string;
    readonly index: number;
  } | null;
}

export interface Graph {
  readonly nodes: readonly CanvasNode[];
  readonly edges: readonly CanvasEdge[];
}

export const START = 'start';
export const END = 'end';

const CONTINUE = 'continue';

interface Box {
  readonly width: number;
  readonly height: number;
}

export function graphOf(document: JsonObject, editable: boolean): Graph {
  const layout = new Layout(document, editable);
  return layout.graph();
}

// The cases of a switch task, in order.
export function casesOf(entry: TaskEntry): Case[] {
  const items = entry.task.switch;

  if (!Array.isArray(items)) return [];

  return items.flatMap((item) => {
    if (!isObject(item)) return [];

    const [name] = Object.keys(item);
    const body = name === undefined ? undefined : item[name];

    if (name === undefined || !isObject(body)) return [];

    return [
      {
        name,
        then: typeof body.then === 'string' ? body.then : CONTINUE,
        when: typeof body.when === 'string' ? body.when : null,
      },
    ];
  });
}

class Layout {
  private readonly nodes: CanvasNode[] = [];
  private readonly edges: CanvasEdge[] = [];

  constructor(
    private readonly document: JsonObject,
    private readonly editable: boolean,
  ) {}

  graph(): Graph {
    const root = this.measureList(ROOT_LIST, 'row');
    const height = Math.max(root.height, SIZE.start.height);
    const listX = SIZE.start.width + SIZE.gapX;
    const endX = listX + root.width + (root.width > 0 ? SIZE.gapX : 0);

    this.nodes.push(
      this.plain(
        START,
        'start',
        0,
        (height - SIZE.start.height) / 2,
        SIZE.start,
        null,
      ),
    );
    this.placeList(ROOT_LIST, 'row', listX, 0, height, null);
    this.nodes.push(
      this.plain(
        END,
        'end',
        endX,
        (height - SIZE.end.height) / 2,
        SIZE.end,
        null,
      ),
    );
    this.connectList(ROOT_LIST, END);

    const entries = entriesAt(this.document, ROOT_LIST);
    const first =
      entries[0]?.pointer ?? (this.editable ? addId(ROOT_LIST) : END);
    this.edges.unshift(
      edge(START, first, 'next', null, null, {
        listPointer: ROOT_LIST,
        index: 0,
      }),
    );

    return { nodes: this.nodes, edges: this.edges };
  }

  // The size of a list laid out in a row (a sequence) or a column (fork branches).
  private measureList(listPointer: string, direction: 'row' | 'column'): Box {
    const boxes = entriesAt(this.document, listPointer).map((entry) =>
      this.measure(entry),
    );

    if (this.editable && (listPointer !== ROOT_LIST || boxes.length === 0))
      boxes.push(SIZE.add);

    if (boxes.length === 0) return { width: 0, height: 0 };

    const gap = direction === 'row' ? SIZE.gapX : SIZE.gapY;
    const along = boxes.reduce(
      (sum, box) => sum + (direction === 'row' ? box.width : box.height),
      0,
    );
    const across = Math.max(
      ...boxes.map((box) => (direction === 'row' ? box.height : box.width)),
    );
    const length = along + gap * (boxes.length - 1);
    return direction === 'row'
      ? { width: length, height: across }
      : { width: across, height: length };
  }

  private measure(entry: TaskEntry): Box {
    const lists = nestedListsOf(entry);

    if (lists.length === 0) return this.leafSize(entry);

    const lanes = lists.map((list) =>
      this.measureList(list.pointer, entry.kind === 'fork' ? 'column' : 'row'),
    );
    const inner = Math.max(SIZE.node.width, ...lanes.map((lane) => lane.width));
    const height =
      SIZE.header +
      lanes.reduce(
        (sum, lane) =>
          sum +
          SIZE.laneLabel +
          Math.max(lane.height, SIZE.add.height) +
          SIZE.pad,
        0,
      );
    return { width: inner + SIZE.pad * 2, height };
  }

  private leafSize(entry: TaskEntry): Box {
    if (entry.kind !== 'switch') return SIZE.node;

    const cases = casesOf(entry).length;
    return {
      width: SIZE.node.width,
      height: Math.max(SIZE.node.height, 36 + cases * SIZE.case),
    };
  }

  private placeList(
    listPointer: string,
    direction: 'row' | 'column',
    x: number,
    y: number,
    across: number,
    parentId: string | null,
  ): void {
    const entries = entriesAt(this.document, listPointer);
    let cursor = direction === 'row' ? x : y;

    for (const entry of entries) {
      const box = this.measure(entry);
      const at =
        direction === 'row'
          ? { x: cursor, y: y + (across - box.height) / 2 }
          : { x: x, y: cursor };
      this.placeEntry(entry, at.x, at.y, box, parentId);
      cursor +=
        (direction === 'row' ? box.width : box.height) +
        (direction === 'row' ? SIZE.gapX : SIZE.gapY);
    }

    if (!this.editable || (listPointer === ROOT_LIST && entries.length > 0))
      return;

    const at =
      direction === 'row'
        ? { x: cursor, y: y + (across - SIZE.add.height) / 2 }
        : { x: x, y: cursor };
    this.nodes.push({
      ...this.plain(addId(listPointer), 'add', at.x, at.y, SIZE.add, parentId),
      addTo: { listPointer, index: entries.length },
    });
  }

  private placeEntry(
    entry: TaskEntry,
    x: number,
    y: number,
    box: Box,
    parentId: string | null,
  ): void {
    const lists = nestedListsOf(entry);

    if (lists.length === 0) {
      this.nodes.push({
        ...this.plain(entry.pointer, 'task', x, y, box, parentId),
        entry,
        cases: entry.kind === 'switch' ? casesOf(entry) : [],
      });
      return;
    }

    const lanes: Lane[] = [];
    let laneY = SIZE.header;
    const container: CanvasNode = {
      ...this.plain(entry.pointer, 'container', x, y, box, parentId),
      entry,
      lanes,
    };
    this.nodes.push(container);

    for (const list of lists) {
      const direction = entry.kind === 'fork' ? 'column' : 'row';
      const size = this.measureList(list.pointer, direction);
      const height = Math.max(size.height, SIZE.add.height);
      lanes.push({
        label: list.label,
        pointer: list.pointer,
        y: laneY,
        height: SIZE.laneLabel + height,
      });
      this.placeList(
        list.pointer,
        direction,
        SIZE.pad,
        laneY + SIZE.laneLabel,
        height,
        entry.pointer,
      );

      if (direction === 'row') this.connectList(list.pointer, null);

      laneY += SIZE.laneLabel + height + SIZE.pad;
    }
  }

  // The edges inside one list: what follows each step, and where it ends. `after` is where the
  // list goes when it ends (the end node for the root, nothing inside a container).
  private connectList(listPointer: string, after: string | null): void {
    const entries = entriesAt(this.document, listPointer);
    const named = new Map(entries.map((entry) => [entry.name, entry.pointer]));

    entries.forEach((entry, index) => {
      const next = entries[index + 1]?.pointer ?? after;
      const insertAt = { listPointer, index: index + 1 };

      if (entry.kind === 'switch') {
        casesOf(entry).forEach((each, at) => {
          const target = this.targetOf(each.then, next, named);

          if (target !== null)
            this.edges.push(
              edge(
                entry.pointer,
                target,
                'case',
                `case-${at}`,
                each.name,
                null,
                `${entry.pointer}#${at}`,
              ),
            );
        });
        return;
      }

      if (entry.kind === 'raise') return;

      const then =
        typeof entry.task.then === 'string' ? entry.task.then : CONTINUE;

      if (then !== CONTINUE) {
        const target = this.targetOf(then, next, named);

        if (target !== null)
          this.edges.push(
            edge(
              entry.pointer,
              target,
              then === 'end' ? 'end' : 'jump',
              'out',
              `then ${then}`,
              null,
            ),
          );

        return;
      }

      if (next !== null) {
        this.edges.push(
          edge(entry.pointer, next, 'next', 'out', null, insertAt),
        );
        return;
      }

      if (this.editable)
        this.edges.push(
          edge(entry.pointer, addId(listPointer), 'append', 'out', null, null),
        );
    });
  }

  private targetOf(
    directive: string,
    next: string | null,
    named: ReadonlyMap<string, string>,
  ): string | null {
    if (directive === CONTINUE) return next;

    if (directive === 'end') return END;

    if (directive === 'exit') return null;

    return named.get(directive) ?? null;
  }

  private plain(
    id: string,
    kind: CanvasNodeKind,
    x: number,
    y: number,
    box: Box,
    parentId: string | null,
  ): CanvasNode {
    return {
      id,
      kind,
      x,
      y,
      width: box.width,
      height: box.height,
      parentId,
      entry: null,
      lanes: [],
      cases: [],
      addTo: null,
    };
  }
}

export function addId(listPointer: string): string {
  return `add:${listPointer}`;
}

function edge(
  source: string,
  target: string,
  kind: EdgeKind,
  sourceHandle: string | null,
  label: string | null,
  insertAt: CanvasEdge['insertAt'],
  key = `${source}>${target}`,
): CanvasEdge {
  return {
    id: `${kind}:${key}`,
    source,
    target,
    sourceHandle,
    kind,
    label,
    insertAt,
  };
}

// The list a node's step belongs to and its index in it, from the step's pointer.
export function placeOf(
  pointer: string,
): { readonly listPointer: string; readonly index: number } | null {
  const match = /^(.*)\/(\d+)\/[^/]+$/.exec(pointer);

  if (match === null) return null;

  return { listPointer: match[1] ?? '', index: Number(match[2]) };
}
