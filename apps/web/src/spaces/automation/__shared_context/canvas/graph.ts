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
  // The space under a switch's cases.
  caseFoot: 8,
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
  // The case's position in the document's `switch` list, which handles and writes use.
  readonly index: number;
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
  // A branch of a fork runs beside its siblings: nothing connects it to them.
  readonly branch: boolean;
  // The step leaves its block (`then: exit` inside a container), which draws no edge.
  readonly leaves: boolean;
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
  // The case of a switch this edge leaves from, by its position in the document.
  readonly caseIndex: number | null;
}

export interface Graph {
  readonly nodes: readonly CanvasNode[];
  readonly edges: readonly CanvasEdge[];
}

export const START = 'start';
export const END = 'end';

const CONTINUE = 'continue';
const EXIT = 'exit';
const BRANCHES = '/fork/branches';

interface Box {
  readonly width: number;
  readonly height: number;
}

export function graphOf(document: JsonObject, editable: boolean): Graph {
  const layout = new Layout(document, editable);
  return layout.graph();
}

// The cases of a switch task, in order, each with its position in the document.
export function casesOf(entry: TaskEntry): Case[] {
  const items = entry.task.switch;

  if (!Array.isArray(items)) return [];

  return items.flatMap((item, index) => {
    if (!isObject(item)) return [];

    const [name] = Object.keys(item);
    const body = name === undefined ? undefined : item[name];

    if (name === undefined || !isObject(body)) return [];

    return [
      {
        name,
        then: typeof body.then === 'string' ? body.then : CONTINUE,
        when: typeof body.when === 'string' ? body.when : null,
        index,
      },
    ];
  });
}

// Whether a list is the branches of a fork, which run side by side.
export function isBranchList(listPointer: string): boolean {
  return listPointer.endsWith(BRANCHES);
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
    const startY = (height - SIZE.start.height) / 2;
    const endY = (height - SIZE.end.height) / 2;

    this.nodes.push(this.plain(START, 'start', 0, startY, SIZE.start, null));
    this.placeList(ROOT_LIST, 'row', listX, 0, height, null);
    this.nodes.push(this.plain(END, 'end', endX, endY, SIZE.end, null));
    this.connectList(ROOT_LIST, END);

    const entries = entriesAt(this.document, ROOT_LIST);
    const empty = this.editable ? addId(ROOT_LIST) : END;
    const first = entries[0]?.pointer ?? empty;
    const start = { listPointer: ROOT_LIST, index: 0 };
    this.edges.unshift(edge(START, first, 'next', null, null, start));

    return { nodes: this.nodes, edges: this.edges };
  }

  // The size of a list laid out in a row (a sequence) or a column (fork branches).
  private measureList(listPointer: string, direction: 'row' | 'column'): Box {
    const entries = entriesAt(this.document, listPointer);
    const boxes = entries.map((entry) => this.measure(entry));

    if (this.editable && (listPointer !== ROOT_LIST || boxes.length === 0))
      boxes.push(SIZE.add);

    if (boxes.length === 0) return { width: 0, height: 0 };

    const row = direction === 'row';
    const gap = row ? SIZE.gapX : SIZE.gapY;
    const along = boxes.reduce(
      (sum, box) => sum + (row ? box.width : box.height),
      0,
    );
    const across = Math.max(
      ...boxes.map((box) => (row ? box.height : box.width)),
    );
    const length = along + gap * (boxes.length - 1);
    return row
      ? { width: length, height: across }
      : { width: across, height: length };
  }

  private measure(entry: TaskEntry): Box {
    const lists = nestedListsOf(entry);

    if (lists.length === 0) return this.leafSize(entry);

    const direction = entry.kind === 'fork' ? 'column' : 'row';
    const lanes = lists.map((list) =>
      this.measureList(list.pointer, direction),
    );
    const inner = Math.max(SIZE.node.width, ...lanes.map((lane) => lane.width));
    const lanesHeight = lanes.reduce(
      (sum, lane) =>
        sum +
        SIZE.laneLabel +
        Math.max(lane.height, SIZE.add.height) +
        SIZE.pad,
      0,
    );
    return { width: inner + SIZE.pad * 2, height: SIZE.header + lanesHeight };
  }

  private leafSize(entry: TaskEntry): Box {
    if (entry.kind !== 'switch') return SIZE.node;

    const cases = casesOf(entry).length;
    const height = SIZE.node.height + cases * SIZE.case + SIZE.caseFoot;
    return { width: SIZE.node.width, height };
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
    const row = direction === 'row';
    const branch = isBranchList(listPointer);
    let cursor = row ? x : y;

    for (const entry of entries) {
      const box = this.measure(entry);
      const at = row
        ? { x: cursor, y: y + (across - box.height) / 2 }
        : { x, y: cursor };
      this.placeEntry(entry, at.x, at.y, box, parentId, branch);
      cursor += (row ? box.width : box.height) + (row ? SIZE.gapX : SIZE.gapY);
    }

    if (!this.editable || (listPointer === ROOT_LIST && entries.length > 0))
      return;

    const at = row
      ? { x: cursor, y: y + (across - SIZE.add.height) / 2 }
      : { x, y: cursor };
    const add = this.plain(
      addId(listPointer),
      'add',
      at.x,
      at.y,
      SIZE.add,
      parentId,
    );
    this.nodes.push({ ...add, addTo: { listPointer, index: entries.length } });
  }

  private placeEntry(
    entry: TaskEntry,
    x: number,
    y: number,
    box: Box,
    parentId: string | null,
    branch: boolean,
  ): void {
    const lists = nestedListsOf(entry);
    const leaves = parentId !== null && this.leavesBlock(entry);

    if (lists.length === 0) {
      const node = this.plain(entry.pointer, 'task', x, y, box, parentId);
      const cases = entry.kind === 'switch' ? casesOf(entry) : [];
      this.nodes.push({ ...node, entry, cases, branch, leaves });
      return;
    }

    const lanes: Lane[] = [];
    const node = this.plain(entry.pointer, 'container', x, y, box, parentId);
    this.nodes.push({ ...node, entry, lanes, branch, leaves });
    let laneY = SIZE.header;

    for (const list of lists) {
      const direction = entry.kind === 'fork' ? 'column' : 'row';
      const size = this.measureList(list.pointer, direction);
      const height = Math.max(size.height, SIZE.add.height);
      const contentY = laneY + SIZE.laneLabel;
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
        contentY,
        height,
        entry.pointer,
      );

      if (direction === 'row') this.connectList(list.pointer, null);

      laneY += SIZE.laneLabel + height + SIZE.pad;
    }
  }

  // Whether the step's own `then` is `exit`: inside a container it leaves the block.
  private leavesBlock(entry: TaskEntry): boolean {
    return entry.task.then === EXIT;
  }

  // The edges inside one list: what follows each step, and where it ends. `after` is where the
  // list goes when it ends: the end node for the root, nothing inside a container.
  private connectList(listPointer: string, after: string | null): void {
    const entries = entriesAt(this.document, listPointer);
    const named = new Map(entries.map((entry) => [entry.name, entry.pointer]));

    entries.forEach((entry, index) => {
      const next = entries[index + 1]?.pointer ?? after;
      const insertAt = { listPointer, index: index + 1 };
      const then =
        typeof entry.task.then === 'string' ? entry.task.then : CONTINUE;

      if (entry.kind === 'switch') {
        this.connectCases(entry, next, after, named);
        return;
      }

      if (entry.kind === 'raise') return;

      if (then !== CONTINUE) {
        this.connectThen(entry.pointer, 'out', then, next, after, named, null);
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

  // A switch's cases, and, when none of them is taken by default, where it goes when no case
  // matches: its own `then`, or the next step.
  private connectCases(
    entry: TaskEntry,
    next: string | null,
    after: string | null,
    named: ReadonlyMap<string, string>,
  ): void {
    const cases = casesOf(entry);

    for (const each of cases) {
      const target = this.targetOf(each.then, next, after, named);

      if (target !== null)
        this.edges.push(
          edge(
            entry.pointer,
            target,
            'case',
            `case-${each.index}`,
            each.name,
            null,
            each.index,
          ),
        );
    }

    if (cases.some((each) => each.when === null)) return;

    const then =
      typeof entry.task.then === 'string' ? entry.task.then : CONTINUE;
    this.connectThen(
      entry.pointer,
      'out',
      then,
      next,
      after,
      named,
      'no match',
    );
  }

  private connectThen(
    source: string,
    handle: string,
    then: string,
    next: string | null,
    after: string | null,
    named: ReadonlyMap<string, string>,
    label: string | null,
  ): void {
    const target = this.targetOf(then, next, after, named);

    if (target === null) return;

    const kind =
      target === END && then !== CONTINUE
        ? 'end'
        : then === CONTINUE
          ? 'next'
          : 'jump';
    const text = label ?? (then === CONTINUE ? null : `then ${then}`);
    this.edges.push(edge(source, target, kind, handle, text, null));
  }

  // Where a flow directive leads (DSL 1.0.3): on to the next step, to a named step of the
  // same list, out of the block, or to the end of the run.
  private targetOf(
    directive: string,
    next: string | null,
    after: string | null,
    named: ReadonlyMap<string, string>,
  ): string | null {
    if (directive === CONTINUE) return next;

    if (directive === 'end') return END;

    if (directive === EXIT) return after;

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
      branch: false,
      leaves: false,
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
  caseIndex: number | null = null,
): CanvasEdge {
  const key =
    caseIndex === null ? `${source}>${target}` : `${source}#${caseIndex}`;
  return {
    id: `${kind}:${key}`,
    source,
    target,
    sourceHandle,
    kind,
    label,
    insertAt,
    caseIndex,
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
