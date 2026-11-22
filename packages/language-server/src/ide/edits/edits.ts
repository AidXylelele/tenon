import { type Snapshot, sourceOf } from "../snapshot/index.js";
import { stepTreeOf } from "../steps/index.js";
import type {
  EditAction,
  Editable,
  EditableText,
  Editing,
  FieldAction,
  StepAction,
} from "./interfaces.js";
import { branchInsertionOf } from "./branches.js";
import { dataUseOf } from "./data-use.js";
import { failureSettingOf } from "./failures.js";
import { fieldClearingOf, fieldSettingOf } from "./field-actions.js";
import { resultSettingOf } from "./results.js";
import {
  stepDuplicateOf,
  stepInsertionOf,
  stepMoveOf,
  stepRemovalOf,
  stepRenameOf,
} from "./step-actions.js";

export const unanalysed: Editing = {
  kind: "refused",
  reason: "The document does not analyse; edit it in the text.",
};

export const unreadable: Editing = {
  kind: "refused",
  reason: "The text does not read; edit it in the text.",
};

export function editsOf(snapshot: Snapshot, action: EditAction): Editing {
  switch (action.kind) {
    case "setField":
    case "clearField":
      return fieldEditsOf(snapshot, action);
    case "insertStep":
    case "insertStepOnBranch":
    case "moveStep":
    case "removeStep":
    case "renameStep":
    case "duplicateStep":
    case "setFailure":
    case "setResult":
    case "useData":
      return stepEditsOf(snapshot, action);
  }
}

export function editableOf(snapshot: Snapshot): Editable | null {
  const analysis = snapshot.analysis;

  if (analysis.kind === "refused") {
    return null;
  }

  const model = analysis.model;
  const positions = model.source.positions;

  if (positions === null) {
    return null;
  }

  const tree = stepTreeOf(model.workflow);
  const document = model.source.document;
  return { snapshot, text: snapshot.text, document, positions, tree };
}

function fieldEditsOf(snapshot: Snapshot, action: FieldAction): Editing {
  const editable = editableTextOf(snapshot);

  if (editable === null) {
    return unreadable;
  }

  switch (action.kind) {
    case "setField":
      return fieldSettingOf(editable, action);
    case "clearField":
      return fieldClearingOf(editable, action);
  }
}

function stepEditsOf(snapshot: Snapshot, action: StepAction): Editing {
  const editable = editableOf(snapshot);

  if (editable === null) {
    return unanalysed;
  }

  switch (action.kind) {
    case "insertStep":
      return stepInsertionOf(editable, action);
    case "insertStepOnBranch":
      return branchInsertionOf(editable, action);
    case "moveStep":
      return stepMoveOf(editable, action);
    case "removeStep":
      return stepRemovalOf(editable, action);
    case "renameStep":
      return stepRenameOf(editable, action);
    case "duplicateStep":
      return stepDuplicateOf(editable, action);
    case "setFailure":
      return failureSettingOf(editable, action);
    case "setResult":
      return resultSettingOf(editable, action);
    case "useData":
      return dataUseOf(editable, action);
  }
}

export function editableTextOf(snapshot: Snapshot): EditableText | null {
  const source = sourceOf(snapshot.analysis);
  const positions = source?.positions ?? null;

  if (source === null || positions === null) {
    return null;
  }

  return { text: snapshot.text, document: source.document, positions };
}
