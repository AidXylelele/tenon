import type {
  Directive,
  Finding,
  LabelDirective,
  Task,
  TaskList,
} from "../../syntax/index.js";
import type { ListOccurrence } from "../occurrences/index.js";
import { nameFindingOf } from "./findings.js";
import type {
  FunctionSymbol,
  LabelTarget,
  Labelling,
  ListLabels,
  Placement,
} from "./types.js";

const none: readonly Finding[] = [];

const unwritten: readonly Directive[] = [];

const unnamed: ReadonlyMap<string, number> = new Map();

const unlisted: readonly Task[] = [];

export function labelTablesOf(
  lists: readonly ListOccurrence[],
  functions: ReadonlyMap<string, FunctionSymbol>,
): Labelling {
  const bodies = [...functions.values()];
  const labelled = lists.map(listLabelsOf);
  const tables = labelled.map(
    ({ list, names }) => [list.pointer, names] as const,
  );
  const jumps = jumpsOf(labelled);
  const listed = labelled.flatMap(listFindingsOf);
  const unlistedTargets = bodies.flatMap(bodyTargetsOf);
  const unlistedFindings = unlistedTargets.flatMap(targetFindingsOf);

  return {
    labels: new Map(tables),
    jumps,
    findings: [...listed, ...unlistedFindings],
  };
}

function listLabelsOf({ list, role }: ListOccurrence): ListLabels {
  const names = firstIndexesOf(list);
  const targets = list.tasks.flatMap((task) => {
    const placement: Placement = { task, role, names, tasks: list.tasks };
    return targetsOf(placement);
  });

  return { list, names, targets };
}

function firstIndexesOf(list: TaskList): ReadonlyMap<string, number> {
  const names = new Map<string, number>();

  for (const [index, task] of list.tasks.entries()) {
    const isRepeated = names.has(task.name);

    if (!isRepeated) {
      names.set(task.name, index);
    }
  }

  return names;
}

function jumpsOf(labelled: readonly ListLabels[]): ReadonlyMap<string, string> {
  const targets = labelled.flatMap((labels) => labels.targets);
  const found = targets.filter((target) => target.kind === "found");
  const jumps = found.map(
    ({ label, task }) => [label.pointer, task.pointer] as const,
  );

  return new Map(jumps);
}

function listFindingsOf(labels: ListLabels): readonly Finding[] {
  const repeated = labels.list.tasks.filter(
    (task, index) => labels.names.get(task.name) !== index,
  );
  const duplicates = repeated.map((task) =>
    nameFindingOf("duplicateTask", "duplicate-task", task),
  );
  const misdirected = labels.targets.flatMap(targetFindingsOf);

  return [...duplicates, ...misdirected];
}

function bodyTargetsOf({ task }: FunctionSymbol): readonly LabelTarget[] {
  const placement: Placement = {
    task,
    role: "sequence",
    names: unnamed,
    tasks: unlisted,
  };
  return targetsOf(placement);
}

function targetsOf(placement: Placement): readonly LabelTarget[] {
  const labels = labelsOf(placement.task);
  return labels.map((label) => targetOf(label, placement));
}

function targetOf(label: LabelDirective, placement: Placement): LabelTarget {
  const named = namedTaskOf(label, placement);

  if (named === undefined) {
    return { kind: "unknown", label };
  }

  const crossing = placement.role === "branches" && named !== placement.task;

  if (crossing) {
    return { kind: "crossing", label };
  }

  return { kind: "found", label, task: named };
}

function namedTaskOf(
  label: LabelDirective,
  placement: Placement,
): Task | undefined {
  const index = placement.names.get(label.name);

  if (index === undefined) {
    return undefined;
  }

  return placement.tasks[index];
}

function targetFindingsOf(target: LabelTarget): readonly Finding[] {
  switch (target.kind) {
    case "found":
      return none;
    case "unknown":
      return [nameFindingOf("unknownTask", "unknown-task", target.label)];
    case "crossing":
      return [nameFindingOf("branchJump", "branch-jump", target.label)];
  }
}

function labelsOf(task: Task): readonly LabelDirective[] {
  const directives = [task.then, ...ownDirectivesOf(task)];
  return directives.filter((directive) => directive.kind === "label");
}

function ownDirectivesOf(task: Task): readonly Directive[] {
  switch (task.kind) {
    case "switch":
      return task.switch.map((switchCase) => switchCase.then);
    case "try":
      return caughtDirectivesOf(task.catch.then);
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
      return unwritten;
  }
}

function caughtDirectivesOf(then: Directive | null): readonly Directive[] {
  if (then === null) {
    return unwritten;
  }

  return [then];
}
