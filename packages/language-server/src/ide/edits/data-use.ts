import { exportAsOf, exportAsPointerOf } from "../data/index.js";
import { valueAt } from "../pointers/index.js";
import { stepWithId } from "../steps/index.js";
import { combinedOf } from "./edits.js";
import { fieldSettingOf } from "./field-actions.js";
import type { Editable, Editing, SetField, UseData } from "./interfaces.js";
import { unknownStepOf } from "./step-actions.js";

const unchanged: Editing = { kind: "edited", changes: [], ids: [] };

export function dataUseOf(editable: Editable, action: UseData): Editing {
  const setting: SetField = {
    kind: "setField",
    pointer: action.pointer,
    value: action.value,
  };
  const used = fieldSettingOf(editable, setting);

  if (action.export === null) {
    return used;
  }

  const exported = exportOf(editable, action.export);
  return combinedOf([used, exported]);
}

function exportOf(editable: Editable, id: string): Editing {
  const step = stepWithId(editable.tree, id);

  if (step === null) {
    return { kind: "refused", reason: unknownStepOf(id) };
  }

  const pointer = exportAsPointerOf(step.pointer);
  const written = valueAt(editable.document, pointer);
  const exportAs = exportAsOf(step.name);

  if (written === exportAs) {
    return unchanged;
  }

  if (written !== undefined) {
    return { kind: "refused", reason: ownExportOf(id) };
  }

  const setting: SetField = { kind: "setField", pointer, value: exportAs };
  return fieldSettingOf(editable, setting);
}

function ownExportOf(id: string): string {
  return `The step ${id} writes its own export; edit it in the text.`;
}
