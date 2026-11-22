import type {
  ast,
  JsonValue,
  RangeLocator,
  SemanticModel,
} from "interpreter/front-end";
import { type ConditionReading, conditionOf } from "../conditions/index.js";
import { stepFamilies } from "../families/index.js";
import { catchPolicyOf } from "./catches.js";
import { variantOf } from "../variants/index.js";
import { parentPointerOf, valueAt } from "../pointers/index.js";
import { type Basis, type Snapshot, sourceOf } from "../snapshot/index.js";
import {
  type StepNode,
  type StepNodeList,
  type StepTree,
  stepTreeOf,
  targetOf,
} from "../steps/index.js";
import type {
  Destination,
  NestedList,
  Sources,
  Step,
  StepList,
  StructureReading,
  Transition,
  Trigger,
  WorkflowStructure,
} from "./interfaces.js";
import {
  stepMillisecondsOf,
  summaryOf,
  triggerMillisecondsOf,
  triggerSummaryOf,
} from "./summaries.js";

const unbuilt: WorkflowStructure = {
  namespace: null,
  name: null,
  title: null,
  triggers: [],
  steps: { id: "/do", pointer: "/do", role: "sequence", steps: [] },
};

export function structureReadingOf(snapshot: Snapshot): StructureReading {
  const analysis = snapshot.analysis;
  const positions = sourceOf(snapshot.analysis)?.positions ?? null;

  switch (analysis.kind) {
    case "analyzed": {
      const workflow = workflowStructureOf(analysis.model, positions);
      return { stale: false, workflow };
    }
    case "refused":
      return staleStructureOf(snapshot.basis, positions);
  }
}

export function workflowStructureOf(
  model: SemanticModel,
  positions: RangeLocator | null,
): WorkflowStructure {
  const tree = stepTreeOf(model.workflow);
  const sources = { model, tree, positions };
  const header = model.workflow.document;
  const triggers = model.workflow.schedules.map((schedule) =>
    triggerOf(schedule, model),
  );
  const steps = stepListOf(tree.root, sources);

  return {
    namespace: header.namespace,
    name: header.name,
    title: header.title,
    triggers,
    steps,
  };
}

function staleStructureOf(
  basis: Basis | null,
  positions: RangeLocator | null,
): StructureReading {
  if (basis === null) {
    return { stale: true, workflow: unbuilt };
  }

  const workflow = workflowStructureOf(basis.model, positions);
  return { stale: true, workflow };
}

function triggerOf(schedule: ast.Schedule, model: SemanticModel): Trigger {
  const document = model.source.document;
  const summary = triggerSummaryOf(schedule, document);
  const milliseconds = triggerMillisecondsOf(schedule);

  return {
    kind: schedule.kind,
    pointer: schedule.pointer,
    summary,
    milliseconds,
  };
}

function stepListOf(list: StepNodeList, sources: Sources): StepList {
  const steps = list.steps.map((step) => stepOf(step, sources));

  return { id: list.id, pointer: list.pointer, role: list.role, steps };
}

function nestedListsOf(
  list: StepNodeList,
  sources: Sources,
): readonly NestedList[] {
  const part = list.part;

  if (part === null) {
    return [];
  }

  const projected = stepListOf(list, sources);
  return [{ ...projected, part }];
}

function stepOf(node: StepNode, sources: Sources): Step {
  const task = node.task;
  const document = sources.model.source.document;
  const family = stepFamilies[task.kind];
  const variant = variantOf(task);
  const summary = summaryOf(task, document);
  const milliseconds = stepMillisecondsOf(task);
  const written = task.metadata.note;
  const note = typeof written === "string" ? written : null;
  const item = parentPointerOf(node.pointer);
  const range = sources.positions?.itemRangeOf(item) ?? null;
  const selectionRange = sources.positions?.keyRangeOf(node.pointer) ?? null;
  const lists = node.lists.flatMap((list) => nestedListsOf(list, sources));
  const flow = flowOf(node, sources);
  const caught = catchPolicyOf(task, sources.model);

  return {
    id: node.id,
    pointer: node.pointer,
    name: node.name,
    kind: task.kind,
    variant,
    family,
    summary,
    milliseconds,
    note,
    range,
    selectionRange,
    lists,
    flow,
    catch: caught,
  };
}

function flowOf(node: StepNode, sources: Sources): readonly Transition[] {
  const task = node.task;
  const destination = destinationOf(task.then, node, sources);
  const done: Transition = {
    on: "done",
    case: null,
    when: null,
    condition: null,
    ...destination,
  };

  switch (task.kind) {
    case "switch": {
      const cases = task.switch.map((switchCase) =>
        caseTransitionOf(switchCase, node, sources),
      );
      return [...cases, done];
    }
    case "try": {
      const caught = caughtTransitionsOf(task.catch, node, sources);
      return [done, ...caught];
    }
    case "call":
    case "do":
    case "emit":
    case "for":
    case "fork":
    case "listen":
    case "raise":
    case "run":
    case "set":
    case "wait":
      return [done];
  }
}

function caseTransitionOf(
  switchCase: ast.SwitchCase,
  node: StepNode,
  sources: Sources,
): Transition {
  const destination = destinationOf(switchCase.then, node, sources);
  const when = switchCase.when?.source ?? null;
  const document = sources.model.source.document;
  const condition = caseConditionOf(switchCase.when, document);
  const name = switchCase.name;

  return { on: "case", case: name, when, condition, ...destination };
}

function caseConditionOf(
  when: ast.Expression | null,
  document: JsonValue,
): ConditionReading | null {
  if (when === null) {
    return null;
  }

  const written = valueAt(document, when.pointer);
  const text = typeof written === "string" ? written : when.source;
  return conditionOf(text);
}

function caughtTransitionsOf(
  caught: ast.Catch,
  node: StepNode,
  sources: Sources,
): readonly Transition[] {
  const then = caught.then;

  if (then === null) {
    return [];
  }

  const destination = destinationOf(then, node, sources);
  const transition: Transition = {
    on: "caught",
    case: null,
    when: null,
    condition: null,
    ...destination,
  };
  return [transition];
}

function destinationOf(
  directive: ast.Directive,
  node: StepNode,
  sources: Sources,
): Destination {
  switch (directive.kind) {
    case "continue":
      return { kind: "next", to: nextIdOf(node, sources.tree) };
    case "exit":
      return { kind: "exit", to: null };
    case "end":
      return { kind: "end", to: null };
    case "label": {
      const jumps = sources.model.symbols.jumps;
      const target = targetOf(sources.tree, jumps, directive.pointer);
      return { kind: "jump", to: target?.id ?? null };
    }
  }
}

function nextIdOf(node: StepNode, tree: StepTree): string | null {
  const list = tree.lists.get(node.list);
  const next = list?.steps[node.index + 1];

  return next?.id ?? null;
}
