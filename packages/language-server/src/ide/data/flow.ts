import type { ast } from "interpreter/front-end";
import {
  directivesOf,
  type StepNode,
  type StepNodeList,
} from "../steps/index.js";
import {
  inputAndValuesAs,
  printedResultOf,
  writtenResultOf,
} from "../variants/index.js";
import type {
  DataFlow,
  Earlier,
  FieldPlace,
  Shape,
  StepShapes,
} from "./interfaces.js";
import {
  mergedShapeOf,
  numberShape,
  schemaShapeOf,
  templateShapeOf,
  textShape,
  unknownShape,
} from "./shapes.js";

export function earlierOf(flow: DataFlow, node: StepNode): readonly Earlier[] {
  const list = flow.tree.lists.get(node.list);
  const holder = flow.holders.get(node.list) ?? null;
  const before = beforeOf(list, node);

  if (list === undefined || holder === null) {
    return before;
  }

  const leaving: Earlier = { kind: "block", block: holder, list };
  const outer = earlierOf(flow, holder);
  return [...before, leaving, ...outer];
}

export function producerOf(
  flow: DataFlow,
  node: StepNode,
  place: FieldPlace,
): StepNode | null {
  const isTransformed = place === "definition" && node.task.input.from !== null;

  if (place === "result" || isTransformed) {
    return null;
  }

  const list = flow.tree.lists.get(node.list);
  const previous = list?.steps[node.index - 1];
  const isConcurrent = list?.role === "branches";

  if (previous === undefined || isConcurrent) {
    return null;
  }

  const fallsThrough = fallsThroughOf(previous.task);
  const isTarget = flow.targets.has(node.pointer);
  const isGuarded = previous.task.if !== null;
  const isOnlyEntry = fallsThrough && !isTarget && !isGuarded;

  if (!isOnlyEntry) {
    return null;
  }

  const isPassedOn = isPassingOnOf(previous);

  if (isPassedOn) {
    return producerOf(flow, previous, "definition");
  }

  return previous;
}

export function chainShapesOf(
  flow: DataFlow,
  node: StepNode,
): ReadonlyMap<string, StepShapes> {
  const lists = chainListsOf(flow, node);
  const shapes = lists.flatMap((list) => [...listShapesOf(flow, list)]);

  return new Map(shapes);
}

export function definitionShapeOf(node: StepNode, incoming: Shape): Shape {
  const isTransformed = node.task.input.from !== null;

  if (isTransformed) {
    return unknownShape;
  }

  return incoming;
}

export function workflowInputShapeOf(workflow: ast.Workflow): Shape {
  return schemaShapeOf(workflow.input.schema) ?? unknownShape;
}

export function startShapeOf(workflow: ast.Workflow): Shape {
  const isTransformed = workflow.input.from !== null;

  if (isTransformed) {
    return unknownShape;
  }

  return workflowInputShapeOf(workflow);
}

export function isPassingOnOf(step: StepNode): boolean {
  return step.task.kind === "switch" && step.task.output.as === null;
}

function beforeOf(
  list: StepNodeList | undefined,
  node: StepNode,
): readonly Earlier[] {
  const isConcurrent = list?.role === "branches";

  if (list === undefined || isConcurrent) {
    return [];
  }

  const before = list.steps.slice(0, node.index).toReversed();
  return before.map((step) => ({ kind: "step", step }));
}

function chainListsOf(flow: DataFlow, node: StepNode): readonly StepNodeList[] {
  const list = flow.tree.lists.get(node.list);
  const holder = flow.holders.get(node.list) ?? null;
  const own = list === undefined ? [] : [list];

  if (holder === null) {
    return own;
  }

  const outer = chainListsOf(flow, holder);
  return [...own, ...outer];
}

function listShapesOf(
  flow: DataFlow,
  list: StepNodeList,
): ReadonlyMap<string, StepShapes> {
  const shapes = new Map<string, StepShapes>();

  for (const step of list.steps) {
    const incoming = incomingShapeOf(flow, step, shapes);
    const output = outputShapeOf(flow, step, incoming);
    shapes.set(step.pointer, { incoming, output });
  }

  return shapes;
}

function incomingShapeOf(
  flow: DataFlow,
  node: StepNode,
  shapes: ReadonlyMap<string, StepShapes>,
): Shape {
  const producer = producerOf(flow, node, "raw");

  if (producer !== null) {
    return shapes.get(producer.pointer)?.output ?? unknownShape;
  }

  const isWorkflowStart =
    node.list === flow.tree.root.pointer && node.index === 0;

  if (!isWorkflowStart) {
    return unknownShape;
  }

  return startShapeOf(flow.workflow);
}

function outputShapeOf(flow: DataFlow, node: StepNode, incoming: Shape): Shape {
  const task = node.task;
  const schema = schemaShapeOf(task.output.schema);

  if (schema !== null) {
    return schema;
  }

  switch (task.kind) {
    case "set":
      return setShapeOf(flow, node, incoming);
    case "run":
      return runShapeOf(flow, node, task);
    case "switch":
      return passedShapeOf(node, incoming);
    case "call":
    case "do":
    case "emit":
    case "for":
    case "fork":
    case "listen":
    case "raise":
    case "try":
    case "wait":
      return unknownShape;
  }
}

function setShapeOf(flow: DataFlow, node: StepNode, incoming: Shape): Shape {
  const task = node.task;

  if (task.kind !== "set") {
    return unknownShape;
  }

  const values = templateShapeOf(task.set);
  const written = writtenResultOf(node, flow.document);

  if (written.as === undefined) {
    return values;
  }

  if (written.as !== inputAndValuesAs) {
    return unknownShape;
  }

  const defined = definitionShapeOf(node, incoming);
  return mergedShapeOf(defined, values);
}

function runShapeOf(
  flow: DataFlow,
  node: StepNode,
  task: ast.TaskCommon & ast.RunTask,
): Shape {
  const isWorkflow = task.process.kind === "workflow";
  const written = writtenResultOf(node, flow.document);
  const result = printedResultOf(written);

  if (isWorkflow) {
    return unknownShape;
  }

  switch (result) {
    case "printedText":
      return textShape;
    case "exitCode":
      return numberShape;
    case "printedJson":
    case "inputAndValues":
    case "valuesOnly":
    case "written":
      return unknownShape;
  }
}

function passedShapeOf(node: StepNode, incoming: Shape): Shape {
  const isTransformed = node.task.output.as !== null;

  if (isTransformed) {
    return unknownShape;
  }

  return definitionShapeOf(node, incoming);
}

function fallsThroughOf(task: ast.Task): boolean {
  const directives = reachedDirectivesOf(task);

  return directives.some((directive) => directive.kind === "continue");
}

function reachedDirectivesOf(task: ast.Task): readonly ast.Directive[] {
  if (task.kind !== "switch") {
    return directivesOf(task);
  }

  const cases = task.switch.map((each) => each.then);
  const hasDefault = task.switch.some((each) => each.when === null);

  if (hasDefault) {
    return cases;
  }

  return [...cases, task.then];
}
