import type { ast } from "interpreter/front-end";
import {
  directivesOf,
  type StepNode,
  stepHolding,
  type StepTree,
} from "../steps/index.js";
import {
  inputAndValuesAs,
  printedResultOf,
  writtenResultOf,
} from "../variants/index.js";
import type { DataFlow, FieldPlace, Shape } from "./interfaces.js";
import {
  mergedShapeOf,
  numberShape,
  schemaShapeOf,
  templateShapeOf,
  textShape,
  unknownShape,
} from "./shapes.js";

export function earlierStepsOf(
  tree: StepTree,
  node: StepNode,
): readonly StepNode[] {
  const list = tree.lists.get(node.list);
  const outer = outerStepsOf(tree, node);
  const isConcurrent = list?.role === "branches";

  if (list === undefined || isConcurrent) {
    return outer;
  }

  const before = list.steps.slice(0, node.index).toReversed();
  return [...before, ...outer];
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
  const isTarget = isTargetOf(flow, node);
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

export function outputShapeOf(flow: DataFlow, node: StepNode): Shape {
  const task = node.task;
  const schema = schemaShapeOf(task.output.schema);

  if (schema !== null) {
    return schema;
  }

  switch (task.kind) {
    case "set":
      return setShapeOf(flow, node, task);
    case "run":
      return runShapeOf(flow, node, task);
    case "switch":
      return passedShapeOf(flow, node);
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

export function definitionShapeOf(flow: DataFlow, node: StepNode): Shape {
  const isTransformed = node.task.input.from !== null;

  if (isTransformed) {
    return unknownShape;
  }

  return incomingShapeOf(flow, node);
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

function incomingShapeOf(flow: DataFlow, node: StepNode): Shape {
  const producer = producerOf(flow, node, "raw");

  if (producer !== null) {
    return outputShapeOf(flow, producer);
  }

  const isWorkflowStart =
    node.list === flow.tree.root.pointer && node.index === 0;

  if (!isWorkflowStart) {
    return unknownShape;
  }

  return startShapeOf(flow.workflow);
}

function setShapeOf(
  flow: DataFlow,
  node: StepNode,
  task: ast.TaskCommon & ast.SetTask,
): Shape {
  const values = templateShapeOf(task.set);
  const written = writtenResultOf(node, flow.document);

  if (written.as === undefined) {
    return values;
  }

  if (written.as !== inputAndValuesAs) {
    return unknownShape;
  }

  const incoming = definitionShapeOf(flow, node);
  return mergedShapeOf(incoming, values);
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

function passedShapeOf(flow: DataFlow, node: StepNode): Shape {
  const isTransformed = node.task.output.as !== null;

  if (isTransformed) {
    return unknownShape;
  }

  return definitionShapeOf(flow, node);
}

function outerStepsOf(tree: StepTree, node: StepNode): readonly StepNode[] {
  const holder = stepHolding(tree, node.list);

  if (holder === null) {
    return [];
  }

  return earlierStepsOf(tree, holder);
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

function isTargetOf(flow: DataFlow, node: StepNode): boolean {
  const targets = [...flow.jumps.values()];

  return targets.includes(node.pointer);
}
