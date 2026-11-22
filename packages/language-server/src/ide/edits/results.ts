import type { JsonValue } from "interpreter/front-end";
import { isJsonObject, parentPointerOf, valueAt } from "../pointers/index.js";
import { type StepNode, stepWithId } from "../steps/index.js";
import {
  outputAsPointerOf,
  resultChoicesOf,
  type ResultMembers,
  resultMembersOf,
  type ReturnMode,
  returnPointerOf,
  variantOf,
} from "../variants/index.js";
import { combinedOf } from "./collection-text.js";
import { fieldEditingOf } from "./field-actions.js";
import type {
  Editable,
  Editing,
  FieldAction,
  SetResult,
} from "./interfaces.js";
import { unknownStepOf } from "./step-actions.js";

export function resultSettingOf(
  editable: Editable,
  action: SetResult,
): Editing {
  const step = stepWithId(editable.tree, action.step);

  if (step === null) {
    return { kind: "refused", reason: unknownStepOf(action.step) };
  }

  const variant = variantOf(step.task);
  const choices = resultChoicesOf(variant);
  const isOffered = choices.includes(action.result);

  if (!isOffered) {
    return { kind: "refused", reason: unofferedOf(action) };
  }

  const members = resultMembersOf(action.result);
  const actions = resultActionsOf(editable.document, step, members);
  const editings = actions.map((each) => fieldEditingOf(editable, each));

  return combinedOf(editings);
}

function resultActionsOf(
  document: JsonValue,
  step: StepNode,
  members: ResultMembers,
): readonly FieldAction[] {
  const outputAs = outputAsPointerOf(step.pointer);
  const asActions = outputAsActionsOf(document, outputAs, members.as);
  const task = step.task;

  if (task.kind !== "run") {
    return asActions;
  }

  const returned = { pointer: step.pointer, mode: task.return };
  const returnActions = returnActionsOf(returned, members.return);
  return [...asActions, ...returnActions];
}

function outputAsActionsOf(
  document: JsonValue,
  pointer: string,
  as: string | null,
): readonly FieldAction[] {
  const written = valueAt(document, pointer);

  if (as !== null) {
    return settingOf(written, pointer, as);
  }

  if (written === undefined) {
    return [];
  }

  const output = parentPointerOf(pointer);
  const holder = valueAt(document, output);
  const members = isJsonObject(holder) ? Object.keys(holder) : [];
  const isSole = members.length === 1;
  const cleared = isSole ? output : pointer;

  return [{ kind: "clearField", pointer: cleared }];
}

function returnActionsOf(
  returned: { readonly pointer: string; readonly mode: ReturnMode },
  required: ReturnMode | null,
): readonly FieldAction[] {
  const isReturned = required === null || required === returned.mode;

  if (isReturned) {
    return [];
  }

  const pointer = returnPointerOf(returned.pointer);
  return [{ kind: "setField", pointer, value: required }];
}

function settingOf(
  written: JsonValue | undefined,
  pointer: string,
  value: string,
): readonly FieldAction[] {
  const isWritten = written === value;

  if (isWritten) {
    return [];
  }

  return [{ kind: "setField", pointer, value }];
}

function unofferedOf(action: SetResult): string {
  return `The step ${action.step} offers no result '${action.result}'.`;
}
