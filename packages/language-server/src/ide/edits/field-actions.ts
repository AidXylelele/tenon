import type { JsonValue } from "interpreter/front-end";
import type { TextChange } from "../text/index.js";
import {
  isJsonObject,
  lastTokenOf,
  parentPointerOf,
  valueAt,
} from "../pointers/index.js";
import { offsetOf, textIn } from "../text/index.js";
import { inlineYamlOf, scalarLike, yamlOf } from "../yaml-text/index.js";
import type {
  ClearField,
  EditableText,
  Editing,
  SetField,
} from "./interfaces.js";
import {
  afterColonOf,
  changeOf,
  insertionOf,
  inTextOrder,
  mappingTextOf,
  removalOf,
} from "./collection-text.js";

export function fieldSettingOf(
  editable: EditableText,
  action: SetField,
): Editing {
  const isDocument = action.pointer === "";

  if (isDocument) {
    return { kind: "refused", reason: unheldOf(action.pointer) };
  }

  const written = valueAt(editable.document, action.pointer);
  const change =
    written === undefined
      ? addedFieldOf(editable, action)
      : replacedFieldOf(editable, action);

  if (change === null) {
    return {
      kind: "refused",
      reason: `${action.pointer} has no object in the text to hold it.`,
    };
  }

  return { kind: "edited", changes: [change], ids: [] };
}

export function fieldClearingOf(
  editable: EditableText,
  action: ClearField,
): Editing {
  const document = editable.document;
  const pointer = action.pointer;
  const isDocument = pointer === "";
  const written = valueAt(document, pointer);

  if (isDocument || written === undefined) {
    return { kind: "refused", reason: unheldOf(pointer) };
  }

  const parent = parentPointerOf(pointer);
  const object = valueAt(document, parent);
  const keys = isJsonObject(object) ? Object.keys(object) : [];
  const collection = mappingTextOf(editable, parent, keys);
  const token = lastTokenOf(pointer);
  const index = keys.indexOf(token);
  const span = collection?.items[index];

  if (collection === null || span === undefined) {
    return {
      kind: "refused",
      reason: `${pointer} is not a member of an object.`,
    };
  }

  const removal = removalOf(collection, span);
  const changes = inTextOrder(removal);
  return { kind: "edited", changes, ids: [] };
}

function replacedFieldOf(
  editable: EditableText,
  action: SetField,
): TextChange | null {
  const { text, positions } = editable;
  const key = positions.keyRangeOf(action.pointer);
  const item = positions.itemRangeOf(action.pointer);
  const node = positions.rangeOf(action.pointer);

  if (item === null || node === null) {
    return null;
  }

  const writtenText = textIn(text, node);
  const valueText = valueTextOf(writtenText, action.value);
  const end = offsetOf(text, item.end);

  if (key === null) {
    const start = offsetOf(text, node.start);
    const span = { start, end };
    return changeOf(text, span, valueText);
  }

  const start = afterColonOf(text, key);
  const span = { start, end };
  const replacement = ` ${valueText}`;
  return changeOf(text, span, replacement);
}

function addedFieldOf(
  editable: EditableText,
  action: SetField,
): TextChange | null {
  const parent = parentPointerOf(action.pointer);
  const object = valueAt(editable.document, parent);
  const token = lastTokenOf(action.pointer);

  if (object === undefined) {
    const value = { [token]: action.value };
    const holder: SetField = { kind: "setField", pointer: parent, value };
    return addedFieldOf(editable, holder);
  }

  const isObject = isJsonObject(object);

  if (!isObject) {
    return null;
  }

  const keys = Object.keys(object);
  const collection = mappingTextOf(editable, parent, keys);

  if (collection === null) {
    return null;
  }

  const keyText = inlineYamlOf(token);
  const valueText = inlineYamlOf(action.value);
  const inline = `${keyText}: ${valueText}`;
  const added = { [token]: action.value };
  const block = yamlOf(added);
  const forms = { block, inline };
  return insertionOf(collection, keys.length, forms);
}

function valueTextOf(writtenText: string, value: JsonValue): string {
  if (typeof value === "string") {
    return scalarLike(writtenText, value);
  }

  return inlineYamlOf(value);
}

function unheldOf(pointer: string): string {
  return `No written field stands at '${pointer}'.`;
}
