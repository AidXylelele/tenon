import type { ast, JsonObject } from "interpreter/front-end";
import { nameConflictOf, type StepTree } from "../steps/index.js";
import { startingContentOf, type StepVariant } from "../variants/index.js";
import { insertionOf, newItemFormsOf } from "./collection-text.js";
import { combinedOf } from "./edits.js";
import { fieldSettingOf } from "./field-actions.js";
import type {
  Editable,
  Editing,
  InsertStepOnBranch,
  SetField,
  Switching,
  WrittenStep,
} from "./interfaces.js";
import { unknownStepOf, writtenStepOf } from "./step-actions.js";
import { newNameOf } from "./step-names.js";

const forkedSwitch =
  "A switch that is a branch of a fork has no list to add a step to.";

export function branchInsertionOf(
  editable: Editable,
  action: InsertStepOnBranch,
): Editing {
  const written = writtenStepOf(editable, action.switch);

  if (written === null) {
    return { kind: "refused", reason: unknownStepOf(action.switch) };
  }

  const { step, list } = written;
  const task = step.task;
  const isForked = list.role === "branches";

  if (task.kind !== "switch") {
    return { kind: "refused", reason: notSwitchOf(step.id) };
  }

  if (isForked) {
    return { kind: "refused", reason: forkedSwitch };
  }

  const chosen = task.switch.find((each) => each.name === action.case);

  if (chosen === undefined) {
    return { kind: "refused", reason: unknownBranchOf(step.id, action.case) };
  }

  const switching = { written, task, chosen };
  return newBranchStepOf(editable, switching, action);
}

function newBranchStepOf(
  editable: Editable,
  switching: Switching,
  action: InsertStepOnBranch,
): Editing {
  const { step, list, collection } = switching.written;
  const name = action.name ?? newNameOf(list, action.step);
  const conflict = nameConflictOf(list, name, null);

  if (conflict !== null) {
    return { kind: "refused", reason: conflict };
  }

  const settings = directiveSettingsOf(editable.tree, switching, name);
  const editings = settings.map((setting) => fieldSettingOf(editable, setting));
  const item = newStepOf(switching.chosen, name, action.step);
  const forms = newItemFormsOf(item);
  const after = step.index + 1;
  const insertion = insertionOf(collection, after, forms);
  const inserted: Editing = { kind: "edited", changes: [insertion], ids: [] };
  const all = [...editings, inserted];

  return combinedOf(all);
}

function directiveSettingsOf(
  tree: StepTree,
  switching: Switching,
  name: string,
): readonly SetField[] {
  const ways = fallThroughsOf(switching);
  const onward = onwardOf(tree, switching.written);
  const rerouted = ways.map((pointer) => settingOf(pointer, onward));
  const chosen = switching.chosen;
  const isContinued = chosen.then.kind === "continue";

  if (isContinued) {
    return rerouted;
  }

  const entry = settingOf(chosen.then.pointer, name);
  return [entry, ...rerouted];
}

function fallThroughsOf(switching: Switching): readonly string[] {
  const { task, chosen } = switching;
  const others = task.switch.filter((each) => each !== chosen);
  const continued = others.filter((each) => each.then.kind === "continue");
  const cases = continued.map((each) => each.then.pointer);
  const hasDefault = task.switch.some((each) => each.when === null);
  const isOwnThenReached = !hasDefault && task.then.kind === "continue";

  if (!isOwnThenReached) {
    return cases;
  }

  return [...cases, task.then.pointer];
}

function onwardOf(tree: StepTree, written: WrittenStep): string {
  const { step, list } = written;
  const next = list.steps[step.index + 1];
  const isWorkflowList = list === tree.root;

  if (next !== undefined) {
    return next.name;
  }

  return isWorkflowList ? "end" : "exit";
}

function newStepOf(
  chosen: ast.SwitchCase,
  name: string,
  variant: StepVariant,
): JsonObject {
  const content = startingContentOf(variant);
  const then = writtenDirectiveOf(chosen.then);

  if (then === null) {
    return { [name]: content };
  }

  return { [name]: { ...content, then } };
}

function writtenDirectiveOf(directive: ast.Directive): string | null {
  switch (directive.kind) {
    case "continue":
      return null;
    case "exit":
    case "end":
      return directive.kind;
    case "label":
      return directive.name;
  }
}

function settingOf(pointer: string, value: string): SetField {
  return { kind: "setField", pointer, value };
}

function notSwitchOf(id: string): string {
  return `The step ${id} is not a switch.`;
}

function unknownBranchOf(id: string, name: string): string {
  return `The switch ${id} has no branch named '${name}'.`;
}
