import type {
  NestedList,
  Step,
  StepList,
  Transition,
  WorkflowStructure,
} from "language-server/protocol";
import type {
  CanvasEdge,
  CanvasNode,
  EdgeKind,
  Graph,
  GraphCase,
  GraphOptions,
  NodeKind,
  Place,
} from "./interfaces";

export const START = "start";
export const END = "end";
export const IN = "in";
export const OUT = "out";
export const FAILURE = "failure";
export const CASE = "case-";

export const SIZE = {
  task: { width: 272, height: 72 },
  start: { width: 272, height: 72 },
  end: { width: 132, height: 44 },
  add: { width: 132, height: 40 },
  row: 22,
  header: 64,
  pad: 20,
} as const;

interface Size {
  readonly width: number;
  readonly height: number;
}

interface Building {
  readonly options: GraphOptions;
  readonly names: ReadonlyMap<string, string>;
  readonly nodes: CanvasNode[];
  readonly edges: CanvasEdge[];
}

export function graphOf(
  workflow: WorkflowStructure,
  options: GraphOptions,
): Graph {
  const root = workflow.steps;
  const names = namesOf(root);
  const building: Building = { options, names, nodes: [], edges: [] };
  const empty = options.editable ? addIdOf(root.id) : END;
  const first = root.steps[0]?.id ?? empty;
  const entry = { list: root.id, index: 0 };

  building.nodes.push(leafOf(START, "start", null, null, SIZE.start));
  placeList(building, root, null, true);
  building.nodes.push(leafOf(END, "end", null, null, SIZE.end));
  building.edges.push(edgeOf(START, OUT, first, "next", null, entry));
  connectList(building, root, END, true);

  return { nodes: building.nodes, edges: building.edges };
}

function addIdOf(listId: string): string {
  return `add:${listId}`;
}

export function containersOf(workflow: WorkflowStructure): string[] {
  const whole = graphOf(workflow, { editable: false, collapsed: new Set() });
  return whole.nodes
    .filter((node) => node.kind === "group" || node.kind === "handler")
    .map((node) => node.id);
}

function placeList(
  building: Building,
  list: StepList,
  parentId: string | null,
  root: boolean,
): void {
  const branch = list.role === "branches";

  for (const step of list.steps) placeStep(building, step, parentId, branch);

  const appendable = !root || list.steps.length === 0;

  if (!building.options.editable || !appendable) return;

  const add = leafOf(addIdOf(list.id), "add", parentId, null, SIZE.add);
  const addTo = { list: list.id, index: list.steps.length };
  building.nodes.push({ ...add, addTo });
}

function placeStep(
  building: Building,
  step: Step,
  parentId: string | null,
  branch: boolean,
): void {
  const inner = innerListsOf(step);
  const handler = handlerOf(step);

  if (inner.length === 0) building.nodes.push(taskOf(step, parentId, handler));
  else placeGroup(building, step, parentId, inner, handler);

  if (handler === null || branch) return;

  const shown = handler.steps.length > 0 || building.options.editable;

  if (shown) placeHandler(building, step, handler, parentId);
}

function taskOf(
  step: Step,
  parentId: string | null,
  handler: NestedList | null,
): CanvasNode {
  const rows = step.note === null ? 0 : 1;
  const size = sizeWith(SIZE.task, rows);
  const task = leafOf(step.id, "task", parentId, step, size);
  const cases = casesOf(step);
  const failing = handler !== null;
  return { ...task, cases, failing };
}

function placeGroup(
  building: Building,
  step: Step,
  parentId: string | null,
  inner: readonly NestedList[],
  handler: NestedList | null,
): void {
  const collapsed = building.options.collapsed.has(step.id);
  const rows = step.note === null ? 0 : 1;
  const size = sizeWith(SIZE.task, rows);
  const group = leafOf(step.id, "group", parentId, step, size);
  const inside = inner.reduce((sum, list) => sum + countOf(list), 0);
  const failing = handler !== null;
  building.nodes.push({ ...group, collapsed, inside, failing });

  if (collapsed) return;

  for (const list of inner) placeList(building, list, step.id, false);
}

function placeHandler(
  building: Building,
  step: Step,
  handler: NestedList,
  parentId: string | null,
): void {
  const collapsed = building.options.collapsed.has(handler.id);
  const node = leafOf(handler.id, "handler", parentId, step, SIZE.task);
  const inside = countOf(handler);
  building.nodes.push({ ...node, collapsed, inside });

  if (collapsed) return;

  placeList(building, handler, handler.id, false);
}

function connectList(
  building: Building,
  list: StepList,
  onward: string,
  root: boolean,
): void {
  if (list.role === "branches") {
    for (const step of list.steps) connectInside(building, step, onward);
    return;
  }

  list.steps.forEach((step, index) => {
    const done = step.flow.find((transition) => transition.on === "done");
    const after =
      done === undefined ? null : targetOf(building, done, onward, root);
    const inner = after ?? onward;
    const defaulted = casesOf(step).some((each) => each.when === null);
    const flows = done !== undefined && step.kind !== "raise" && !defaulted;

    connectInside(building, step, inner);
    connectCases(building, step, onward, root);

    if (flows) connectDone(building, step, done, list, index, onward, root);

    connectFailure(building, step, after, root);
  });
}

function connectInside(building: Building, step: Step, onward: string): void {
  const collapsed = building.options.collapsed;

  if (!collapsed.has(step.id))
    for (const list of innerListsOf(step))
      connectList(building, list, onward, false);

  const handler = handlerOf(step);

  if (handler !== null && !collapsed.has(handler.id))
    connectList(building, handler, onward, false);
}

function connectCases(
  building: Building,
  step: Step,
  onward: string,
  root: boolean,
): void {
  const cases = step.flow.filter((transition) => transition.on === "case");

  cases.forEach((transition, index) => {
    const target = targetOf(building, transition, onward, root);

    if (target === null) return;

    const name = transition.case ?? "";
    const label = transition.when === null ? `${name} (otherwise)` : name;
    const port = `${CASE}${String(index)}`;
    const edge = edgeOf(step.id, port, target, "case", label, null);
    building.edges.push(edge);
  });
}

function connectDone(
  building: Building,
  step: Step,
  done: Transition,
  list: StepList,
  index: number,
  onward: string,
  root: boolean,
): void {
  const target = targetOf(building, done, onward, root);
  const sequential = done.kind === "next";

  if (target === null) {
    if (!building.options.editable || !sequential || root) return;

    const append = addIdOf(list.id);
    const edge = edgeOf(step.id, OUT, append, "append", null, null);
    building.edges.push(edge);
    return;
  }

  const kind: EdgeKind = done.kind;
  const label = labelOf(building, done);
  const insertAt = sequential ? { list: list.id, index: index + 1 } : null;
  const edge = edgeOf(step.id, OUT, target, kind, label, insertAt);
  building.edges.push(edge);
}

function connectFailure(
  building: Building,
  step: Step,
  after: string | null,
  root: boolean,
): void {
  const handler = handlerOf(step);

  if (handler === null) return;

  const shown = handler.steps.length > 0 || building.options.editable;

  if (!shown) return;

  const failure = edgeOf(
    step.id,
    FAILURE,
    handler.id,
    "error",
    "If it fails",
    null,
  );
  building.edges.push(failure);

  const caught = step.flow.find((transition) => transition.on === "caught");
  const onward = after ?? END;
  const handled =
    caught === undefined ? after : targetOf(building, caught, onward, root);

  if (handled === null) return;

  const edge = edgeOf(handler.id, OUT, handled, "next", null, null);
  building.edges.push(edge);
}

function targetOf(
  building: Building,
  transition: Transition,
  onward: string,
  root: boolean,
): string | null {
  switch (transition.kind) {
    case "next":
      return transition.to ?? (root ? END : null);
    case "jump":
      return transition.to !== null && building.names.has(transition.to)
        ? transition.to
        : null;
    case "end":
      return END;
    case "exit":
      return root ? END : onward;
  }
}

function labelOf(building: Building, transition: Transition): string | null {
  switch (transition.kind) {
    case "next":
      return null;
    case "jump": {
      const to = transition.to ?? "";
      const name = building.names.get(to) ?? to;
      return `Go to ${name}`;
    }
    case "end":
      return "End the run";
    case "exit":
      return "Leave the block";
  }
}

function casesOf(step: Step): GraphCase[] {
  const cases = step.flow.filter((transition) => transition.on === "case");
  return cases.map((transition, index) => ({
    when: transition.when,
    index,
  }));
}

function innerListsOf(step: Step): NestedList[] {
  return step.lists.filter((list) => list.part !== "catch");
}

function handlerOf(step: Step): NestedList | null {
  return step.lists.find((list) => list.part === "catch") ?? null;
}

function countOf(list: StepList): number {
  return list.steps.reduce(
    (sum, step) =>
      sum + 1 + step.lists.reduce((inner, each) => inner + countOf(each), 0),
    0,
  );
}

function namesOf(list: StepList): Map<string, string> {
  const names = new Map<string, string>();

  for (const step of list.steps) {
    names.set(step.id, step.name);

    for (const nested of step.lists)
      for (const [id, name] of namesOf(nested)) names.set(id, name);
  }

  return names;
}

function sizeWith(size: Size, rows: number): Size {
  return { width: size.width, height: size.height + rows * SIZE.row };
}

function leafOf(
  id: string,
  kind: NodeKind,
  parentId: string | null,
  step: Step | null,
  size: Size,
): CanvasNode {
  return {
    id,
    kind,
    parentId,
    step,
    cases: [],
    addTo: null,
    failing: false,
    collapsed: false,
    inside: 0,
    width: size.width,
    height: size.height,
  };
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
  };
}
