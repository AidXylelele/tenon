import { isObject, type JsonObject } from '@/libs/document-text/json';
import {
  allEntries,
  entriesAt,
  nestedListsOf,
  type Protection,
  protectionOf,
  retryTextOf,
  ROOT_LIST,
  type TaskEntry,
} from '@/operations/workflow-document';

// A document as a graph (research R16): every step a node, every block a group that holds its
// steps, a `try`'s failure handling a group of its own, and only what the DSL says becomes an
// edge. This decides what is drawn; ELK decides where (`layout.ts`).

export const SIZE = {
  task: { width: 272, height: 72 },
  // A note, or a row of badges, under a step's summary.
  row: 22,
  start: { width: 272, height: 72 },
  end: { width: 132, height: 44 },
  add: { width: 132, height: 40 },
  // A group's own heading, above its steps.
  header: 64,
  pad: 20,
} as const;

export type NodeKind = 'start' | 'end' | 'task' | 'group' | 'handler' | 'add';

export interface Case {
  readonly name: string;
  readonly then: string;
  readonly when: string | null;
  // The case's position in the document's `switch` list, which ports and writes use.
  readonly index: number;
}

export interface Place {
  readonly listPointer: string;
  readonly index: number;
}

export interface CanvasNode {
  readonly id: string;
  readonly kind: NodeKind;
  readonly parentId: string | null;
  // The task the node is; for a handler, the `try` it handles failures of.
  readonly entry: TaskEntry | null;
  // A `try` that protects one step on its own is drawn as that step.
  readonly protection: Protection | null;
  readonly cases: readonly Case[];
  // The author's note (`metadata.note`), or the workflow's summary on Start.
  readonly note: string | null;
  // What a group's heading adds: how a `try` retries, how a fork runs its branches.
  readonly detail: string | null;
  // Where an `add` node adds a step.
  readonly addTo: Place | null;
  // A branch of a fork runs beside its siblings: nothing connects it to them.
  readonly branch: boolean;
  // A group drawn closed, as one node that counts its steps.
  readonly collapsed: boolean;
  readonly steps: number;
  // A leaf's size; ELK sizes an open group around its steps.
  readonly width: number;
  readonly height: number;
}

export type EdgeKind =
  'next' | 'case' | 'jump' | 'end' | 'exit' | 'error' | 'append';

export interface CanvasEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  // The port it leaves from: `out`, `err` (a failure) or `case-<index>`.
  readonly port: string;
  readonly kind: EdgeKind;
  readonly label: string | null;
  // A step added on this edge goes here.
  readonly insertAt: Place | null;
  // The case of a switch this edge leaves from, by its position in the document.
  readonly caseIndex: number | null;
}

export interface Graph {
  readonly nodes: readonly CanvasNode[];
  readonly edges: readonly CanvasEdge[];
}

export interface GraphOptions {
  readonly editable: boolean;
  // The groups drawn closed, by node id.
  readonly collapsed: ReadonlySet<string>;
}

export const START = 'start';
export const END = 'end';
export const OUT = 'out';
export const FAILURE = 'err';
export const CASE = 'case-';

const CONTINUE = 'continue';
const EXIT = 'exit';
const BRANCHES = '/fork/branches';

export function graphOf(document: JsonObject, options: GraphOptions): Graph {
  const builder = new GraphBuilder(document, options);
  return builder.graph();
}

// The id of the group that holds a `try`'s failure handling.
export function handlerId(tryPointer: string): string {
  return `${tryPointer}/catch/do`;
}

export function addId(listPointer: string): string {
  return `add:${listPointer}`;
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

// The position of the case a port leaves from, or null for a port that is not a case's.
export function caseIndexOf(port: string | null): number | null {
  if (port === null || !port.startsWith(CASE)) return null;

  return Number(port.slice(CASE.length));
}

// Whether a list is the branches of a fork, which run side by side.
export function isBranchList(listPointer: string): boolean {
  return listPointer.endsWith(BRANCHES);
}

// The list a node's step belongs to and its index in it, from the step's pointer.
export function placeOf(pointer: string): Place | null {
  const match = /^(.*)\/(\d+)\/[^/]+$/.exec(pointer);

  if (match === null) return null;

  return { listPointer: match[1] ?? '', index: Number(match[2]) };
}

class GraphBuilder {
  private readonly nodes: CanvasNode[] = [];
  private readonly edges: CanvasEdge[] = [];

  constructor(
    private readonly document: JsonObject,
    private readonly options: GraphOptions,
  ) {}

  graph(): Graph {
    const summary = this.summary();
    const rows = summary === null ? 0 : 1;
    const size = {
      width: SIZE.start.width,
      height: SIZE.start.height + rows * SIZE.row,
    };
    const start = this.leaf(START, 'start', null, null, size, summary);
    this.nodes.push(start);
    this.placeList(ROOT_LIST, null);
    this.nodes.push(this.leaf(END, 'end', null, null, SIZE.end, null));
    this.connectList(ROOT_LIST, END, END);

    const entries = entriesAt(this.document, ROOT_LIST);
    const empty = this.options.editable ? addId(ROOT_LIST) : END;
    const first = entries[0]?.pointer ?? empty;
    const at = { listPointer: ROOT_LIST, index: 0 };
    this.edges.unshift(edgeOf(START, OUT, first, 'next', null, at));

    return { nodes: this.nodes, edges: this.edges };
  }

  private summary(): string | null {
    const header = isObject(this.document.document)
      ? this.document.document
      : {};
    const summary = header.summary;
    return typeof summary === 'string' && summary.trim() !== ''
      ? summary
      : null;
  }

  private placeList(listPointer: string, parentId: string | null): void {
    const entries = entriesAt(this.document, listPointer);
    const branch = isBranchList(listPointer);

    for (const entry of entries) this.placeEntry(entry, parentId, branch);

    if (!this.options.editable) return;

    if (listPointer === ROOT_LIST && entries.length > 0) return;

    const add = this.leaf(
      addId(listPointer),
      'add',
      parentId,
      null,
      SIZE.add,
      null,
    );
    const addTo = { listPointer, index: entries.length };
    this.nodes.push({ ...add, addTo });
  }

  private placeEntry(
    entry: TaskEntry,
    parentId: string | null,
    branch: boolean,
  ): void {
    const protection = protectionOf(this.document, entry);

    if (protection !== null) {
      this.nodes.push(this.step(entry, parentId, branch, protection));
      return;
    }

    const lists = nestedListsOf(entry);

    if (lists.length === 0) {
      this.nodes.push(this.step(entry, parentId, branch, null));
      return;
    }

    const steps = lists.filter((list) => !list.pointer.endsWith('/catch/do'));
    const handler = lists.find((list) => list.pointer.endsWith('/catch/do'));
    this.placeGroup(
      entry,
      parentId,
      branch,
      steps.map((list) => list.pointer),
    );

    if (handler !== undefined && this.hasSteps(handler.pointer))
      this.placeHandler(entry, parentId, handler.pointer);
  }

  private placeGroup(
    entry: TaskEntry,
    parentId: string | null,
    branch: boolean,
    lists: readonly string[],
  ): void {
    const collapsed = this.options.collapsed.has(entry.pointer);
    const count = lists.reduce((sum, list) => sum + this.countOf(list), 0);
    const detail = this.detailOf(entry);
    const group: CanvasNode = {
      ...this.leaf(
        entry.pointer,
        'group',
        parentId,
        entry,
        SIZE.task,
        noteOf(entry),
      ),
      branch,
      collapsed,
      steps: count,
      detail,
      height: SIZE.task.height + (detail === null ? 0 : SIZE.row),
    };
    this.nodes.push(group);

    if (collapsed) return;

    for (const list of lists) this.placeList(list, entry.pointer);
  }

  private placeHandler(
    entry: TaskEntry,
    parentId: string | null,
    listPointer: string,
  ): void {
    const id = handlerId(entry.pointer);
    const collapsed = this.options.collapsed.has(id);
    const handler: CanvasNode = {
      ...this.leaf(id, 'handler', parentId, entry, SIZE.task, null),
      collapsed,
      steps: this.countOf(listPointer),
    };
    this.nodes.push(handler);

    if (!collapsed) this.placeList(listPointer, id);
  }

  private step(
    entry: TaskEntry,
    parentId: string | null,
    branch: boolean,
    protection: Protection | null,
  ): CanvasNode {
    const shown = protection?.step ?? entry;
    const note = noteOf(entry) ?? noteOf(shown);
    const rows = (note === null ? 0 : 1) + (protection === null ? 0 : 1);
    const cases = shown.kind === 'switch' ? casesOf(shown) : [];
    const size = {
      width: SIZE.task.width,
      height: SIZE.task.height + rows * SIZE.row,
    };
    return {
      ...this.leaf(entry.pointer, 'task', parentId, entry, size, note),
      protection,
      cases,
      branch,
    };
  }

  private detailOf(entry: TaskEntry): string | null {
    if (entry.kind === 'try') {
      const handling = isObject(entry.task.catch) ? entry.task.catch : {};
      return retryTextOf(handling.retry);
    }

    if (entry.kind === 'fork') {
      const fork = isObject(entry.task.fork) ? entry.task.fork : {};
      return fork.compete === true
        ? 'The first branch to finish wins'
        : 'Every branch runs at once';
    }

    return null;
  }

  private hasSteps(listPointer: string): boolean {
    return entriesAt(this.document, listPointer).length > 0;
  }

  private countOf(listPointer: string): number {
    return allEntries(this.document, listPointer).length;
  }

  // The edges inside one list: what follows each step, and where it ends. `after` is where
  // the list's last step goes: the end for the root, nothing inside a group, whose own edge
  // goes on. `onward` is where the list goes when it is done, which a `then: exit` reaches.
  private connectList(
    listPointer: string,
    after: string | null,
    onward: string,
  ): void {
    const entries = entriesAt(this.document, listPointer);
    const named = new Map(entries.map((entry) => [entry.name, entry.pointer]));

    entries.forEach((entry, index) => {
      const next = entries[index + 1]?.pointer ?? after;
      const continues = entries[index + 1]?.pointer ?? onward;
      const insertAt = { listPointer, index: index + 1 };
      const route = { next, onward, named, insertAt, listPointer };

      this.connectInside(entry, continues);

      const shown = protectionOf(this.document, entry)?.step ?? entry;

      if (shown.kind === 'switch') {
        this.connectCases(entry, shown, route);
        return;
      }

      if (shown.kind === 'raise') return;

      this.connectThen(entry.pointer, OUT, then(entry.task), route, null);

      if (entry.kind === 'try') this.connectFailure(entry, next);
    });
  }

  // The lists a step holds, unless its group is drawn closed.
  private connectInside(entry: TaskEntry, continues: string): void {
    if (protectionOf(this.document, entry) !== null) return;

    for (const list of nestedListsOf(entry)) {
      const holder = list.pointer.endsWith('/catch/do')
        ? handlerId(entry.pointer)
        : entry.pointer;

      if (this.options.collapsed.has(holder)) continue;

      if (isBranchList(list.pointer)) {
        for (const branch of entriesAt(this.document, list.pointer))
          this.connectInside(branch, continues);
        continue;
      }

      this.connectList(list.pointer, null, continues);
    }
  }

  // A `try` with steps to run on failure: its failure edge to them, and theirs onward.
  private connectFailure(entry: TaskEntry, next: string | null): void {
    const handler = `${entry.pointer}/catch/do`;

    if (!this.hasSteps(handler)) return;

    const id = handlerId(entry.pointer);
    const handling = isObject(entry.task.catch) ? entry.task.catch : {};
    const label =
      retryTextOf(handling.retry) === null
        ? 'If it fails'
        : 'If it still fails';
    this.edges.push(edgeOf(entry.pointer, FAILURE, id, 'error', label, null));

    if (next !== null)
      this.edges.push(edgeOf(id, OUT, next, 'next', null, null));
  }

  // A switch's cases, and, when no case is taken by default, where it goes when none
  // matches: its own `then`, or the next step.
  private connectCases(entry: TaskEntry, shown: TaskEntry, route: Route): void {
    const cases = casesOf(shown);

    for (const each of cases) {
      const target = this.targetOf(each.then, route);

      if (target === null) continue;

      const label = each.when === null ? `${each.name} (otherwise)` : each.name;
      const port = `${CASE}${String(each.index)}`;
      const made = edgeOf(entry.pointer, port, target, 'case', label, null);
      this.edges.push({ ...made, caseIndex: each.index });
    }

    if (cases.some((each) => each.when === null)) return;

    this.connectThen(entry.pointer, OUT, then(entry.task), route, 'no match');
  }

  private connectThen(
    source: string,
    port: string,
    directive: string,
    route: Route,
    label: string | null,
  ): void {
    const target = this.targetOf(directive, route);

    if (target === null) {
      if (directive !== CONTINUE || !this.options.editable) return;

      if (route.listPointer === ROOT_LIST) return;

      const add = addId(route.listPointer);
      this.edges.push(edgeOf(source, port, add, 'append', null, null));
      return;
    }

    const kind = kindOf(directive);
    const text = label ?? labelOf(directive);
    const insertAt = kind === 'next' && label === null ? route.insertAt : null;
    this.edges.push(edgeOf(source, port, target, kind, text, insertAt));
  }

  // Where a flow directive leads (DSL 1.0.3): on to the next step, to a named step of the
  // same list, out of the block, or to the end of the run.
  private targetOf(directive: string, route: Route): string | null {
    if (directive === CONTINUE) return route.next;

    if (directive === 'end') return END;

    if (directive === EXIT) return route.onward;

    return route.named.get(directive) ?? null;
  }

  private leaf(
    id: string,
    kind: NodeKind,
    parentId: string | null,
    entry: TaskEntry | null,
    size: { readonly width: number; readonly height: number },
    note: string | null,
  ): CanvasNode {
    return {
      id,
      kind,
      parentId,
      entry,
      protection: null,
      cases: [],
      note,
      detail: null,
      addTo: null,
      branch: false,
      collapsed: false,
      steps: 0,
      width: size.width,
      height: size.height,
    };
  }
}

interface Route {
  readonly next: string | null;
  readonly onward: string;
  readonly named: ReadonlyMap<string, string>;
  readonly insertAt: Place;
  readonly listPointer: string;
}

function then(task: JsonObject): string {
  return typeof task.then === 'string' ? task.then : CONTINUE;
}

function kindOf(directive: string): EdgeKind {
  if (directive === CONTINUE) return 'next';

  if (directive === 'end') return 'end';

  if (directive === EXIT) return 'exit';

  return 'jump';
}

function labelOf(directive: string): string | null {
  if (directive === CONTINUE) return null;

  if (directive === 'end') return 'End the run';

  if (directive === EXIT) return 'Leave the block';

  return `Go to ${directive}`;
}

function noteOf(entry: TaskEntry): string | null {
  const metadata = isObject(entry.task.metadata) ? entry.task.metadata : {};
  const note = metadata.note;
  return typeof note === 'string' && note.trim() !== '' ? note.trim() : null;
}

function edgeOf(
  source: string,
  port: string,
  target: string,
  kind: EdgeKind,
  label: string | null,
  insertAt: Place | null,
): CanvasEdge {
  return {
    id: `${kind}:${source}:${port}>${target}`,
    source,
    target,
    port,
    kind,
    label,
    insertAt,
    caseIndex: null,
  };
}
