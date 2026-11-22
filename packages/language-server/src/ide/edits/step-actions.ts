import { renameAt } from "../names/index.js";
import { parentPointerOf, valueAt } from "../pointers/index.js";
import {
  listWithId,
  nameConflictOf,
  type StepNode,
  type StepNodeList,
  type StepTree,
  stepWithId,
} from "../steps/index.js";
import { offsetOf } from "../text/index.js";
import { inlineYamlOf, scalarLike, yamlOf } from "../yaml-text/index.js";
import type {
  Destination,
  DuplicateStep,
  Editable,
  Editing,
  InsertStep,
  MoveStep,
  RemoveStep,
  RenameStep,
  WrittenItem,
  WrittenStep,
} from "./interfaces.js";
import {
  insertionOf,
  inTextOrder,
  itemFormsOf,
  listTextOf,
  removalOf,
  withoutItem,
} from "./collection-text.js";
import { idChangesOf, placedStepOf } from "./ids.js";
import { copyNameOf, newNameOf, templateOf } from "./templates.js";

export function stepInsertionOf(
  editable: Editable,
  action: InsertStep,
): Editing {
  const list = listWithId(editable.tree, action.list);

  if (list === null) {
    return { kind: "refused", reason: unknownListOf(action.list) };
  }

  const collection = listTextOf(editable, list);
  const room = list.steps.length;
  const isWithin = isIndexWithin(action.index, room);

  if (collection === null) {
    return { kind: "refused", reason: unknownListOf(action.list) };
  }

  if (!isWithin) {
    return { kind: "refused", reason: outsideOf(action.index) };
  }

  const name = action.name ?? newNameOf(list, action.step);
  const conflict = nameConflictOf(list, name, null);

  if (conflict !== null) {
    return { kind: "refused", reason: conflict };
  }

  const template = templateOf(action.step);
  const item = { [name]: template };
  const block = yamlOf([item]);
  const inline = inlineYamlOf(item);
  const forms = { block, inline };
  const insertion = insertionOf(collection, action.index, forms);
  return { kind: "edited", changes: [insertion], ids: [] };
}

export function stepMoveOf(editable: Editable, action: MoveStep): Editing {
  const written = writtenStepOf(editable, action.step);
  const list = listWithId(editable.tree, action.list);

  if (written === null) {
    return { kind: "refused", reason: unknownStepOf(action.step) };
  }

  if (list === null) {
    return { kind: "refused", reason: unknownListOf(action.list) };
  }

  const below = `${written.step.pointer}/`;
  const isOwn = list.pointer.startsWith(below);

  if (isOwn) {
    return {
      kind: "refused",
      reason: "A step cannot move into its own lists.",
    };
  }

  const destination = { list, index: action.index };
  const isSameList = written.list === list;

  return isSameList
    ? reorderingOf(editable, written, action.index)
    : relocationOf(editable, written, destination);
}

export function stepRemovalOf(editable: Editable, action: RemoveStep): Editing {
  const written = writtenStepOf(editable, action.step);

  if (written === null) {
    return { kind: "refused", reason: unknownStepOf(action.step) };
  }

  const removal = removalOf(written.collection, written.span);
  const changes = inTextOrder(removal);
  return { kind: "edited", changes, ids: [] };
}

export function stepRenameOf(editable: Editable, action: RenameStep): Editing {
  const step = stepWithId(editable.tree, action.step);

  if (step === null) {
    return { kind: "refused", reason: unknownStepOf(action.step) };
  }

  const list = listOf(editable.tree, step);
  const key = editable.positions.keyRangeOf(step.pointer);

  if (list === null || key === null) {
    return { kind: "refused", reason: unknownStepOf(action.step) };
  }

  const renaming = renameAt(editable.snapshot, key.start, action.name);

  if (renaming.kind === "refused") {
    return renaming;
  }

  const names = list.steps.map((sibling) => sibling.name);
  const earlier = names.slice(0, step.index);
  const placed = placedStepOf(list, action.name, earlier);
  const ids = idChangesOf(step, placed);
  return { kind: "edited", changes: renaming.changes, ids };
}

export function stepDuplicateOf(
  editable: Editable,
  action: DuplicateStep,
): Editing {
  const written = writtenStepOf(editable, action.step);

  if (written === null) {
    return { kind: "refused", reason: unknownStepOf(action.step) };
  }

  const name = copyNameOf(written.list, written.step.name);
  const copy = copyOf(editable, written, name);

  if (copy === null) {
    return { kind: "refused", reason: unknownStepOf(action.step) };
  }

  const forms = itemFormsOf(written.collection, copy);
  const next = written.step.index + 1;
  const insertion = insertionOf(written.collection, next, forms);
  return { kind: "edited", changes: [insertion], ids: [] };
}

function reorderingOf(
  editable: Editable,
  written: WrittenStep,
  index: number,
): Editing {
  const room = written.list.steps.length - 1;
  const isWithin = isIndexWithin(index, room);

  if (!isWithin) {
    return { kind: "refused", reason: outsideOf(index) };
  }

  const isInPlace = index === written.step.index;

  if (isInPlace) {
    return { kind: "edited", changes: [], ids: [] };
  }

  const others = withoutItem(written.collection, written.span);
  const item = itemOf(editable, written);
  const forms = itemFormsOf(written.collection, item);
  const insertion = insertionOf(others, index, forms);
  const removal = removalOf(written.collection, written.span);
  const both = [...removal, insertion];
  const changes = inTextOrder(both);
  return { kind: "edited", changes, ids: [] };
}

function relocationOf(
  editable: Editable,
  written: WrittenStep,
  destination: Destination,
): Editing {
  const { list, index } = destination;
  const collection = listTextOf(editable, list);
  const room = list.steps.length;
  const isWithin = isIndexWithin(index, room);

  if (collection === null) {
    return { kind: "refused", reason: unknownListOf(list.id) };
  }

  if (!isWithin) {
    return { kind: "refused", reason: outsideOf(index) };
  }

  const step = written.step;
  const conflict = nameConflictOf(list, step.name, null);

  if (conflict !== null) {
    return { kind: "refused", reason: conflict };
  }

  const item = itemOf(editable, written);
  const forms = itemFormsOf(written.collection, item);
  const insertion = insertionOf(collection, index, forms);
  const removal = removalOf(written.collection, written.span);
  const both = [...removal, insertion];
  const changes = inTextOrder(both);
  const names = list.steps.map((sibling) => sibling.name);
  const earlier = names.slice(0, index);
  const placed = placedStepOf(list, step.name, earlier);
  const ids = idChangesOf(step, placed);
  return { kind: "edited", changes, ids };
}

export function writtenStepOf(
  editable: Editable,
  id: string,
): WrittenStep | null {
  const step = stepWithId(editable.tree, id);

  if (step === null) {
    return null;
  }

  const list = listOf(editable.tree, step);
  const collection = list === null ? null : listTextOf(editable, list);
  const span = collection?.items[step.index];

  if (list === null || collection === null || span === undefined) {
    return null;
  }

  return { step, list, collection, span };
}

function itemOf(editable: Editable, written: WrittenStep): WrittenItem {
  const { start, end } = written.span;
  const text = editable.text.slice(start, end);
  const item = parentPointerOf(written.step.pointer);
  const value = valueAt(editable.document, item) ?? null;

  return { text, value };
}

function copyOf(
  editable: Editable,
  written: WrittenStep,
  name: string,
): WrittenItem | null {
  const { text, positions, document } = editable;
  const { step, span } = written;
  const key = positions.keyRangeOf(step.pointer);

  if (key === null) {
    return null;
  }

  const keyStart = offsetOf(text, key.start);
  const keyEnd = offsetOf(text, key.end);
  const keyText = text.slice(keyStart, keyEnd);
  const renamedKey = scalarLike(keyText, name);
  const before = text.slice(span.start, keyStart);
  const after = text.slice(keyEnd, span.end);
  const copied = before + renamedKey + after;
  const task = valueAt(document, step.pointer) ?? null;
  const value = { [name]: task };

  return { text: copied, value };
}

function isIndexWithin(index: number, room: number): boolean {
  return Number.isInteger(index) && index >= 0 && index <= room;
}

function listOf(tree: StepTree, step: StepNode): StepNodeList | null {
  return tree.lists.get(step.list) ?? null;
}

export function unknownStepOf(id: string): string {
  return `No step with the id ${id} stands in the text.`;
}

function unknownListOf(id: string): string {
  return `No list with the id ${id} stands in the text.`;
}

function outsideOf(index: number): string {
  const written = String(index);

  return `The list has no place ${written}.`;
}
