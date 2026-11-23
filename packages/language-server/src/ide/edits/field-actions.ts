import type { JsonValue } from "interpreter/front-end";
import type { TextChange } from "../text/index.js";
import {
  isJsonObject,
  lastTokenOf,
  parentPointerOf,
  valueAt,
} from "../pointers/index.js";
import { lineTextAt, offsetOf, textIn } from "../text/index.js";
import {
  blockScalarLike,
  inlineYamlOf,
  isBlockScalarFor,
  isKeptBlockOf,
  lineInBlockLike,
  scalarLike,
  type WrittenScalar,
  yamlOf,
} from "../yaml-text/index.js";
import { conditionTextOf } from "../conditions/index.js";
import { templateTextOf, writtenTemplateOf } from "../templates/index.js";
import type {
  ClearField,
  EditableText,
  Editing,
  FieldAction,
  SetCondition,
  SetField,
  SetTemplate,
  ValueText,
  WrittenField,
} from "./interfaces.js";
import {
  afterColonOf,
  changeOf,
  insertionOf,
  inTextOrder,
  isBlockMember,
  mappingTextOf,
  removalOf,
} from "./collection-text.js";

const unedited: Editing = { kind: "edited", changes: [], ids: [] };

export function combinedOf(editings: readonly Editing[]): Editing {
  const refusal = editings.find((editing) => editing.kind === "refused");

  if (refusal !== undefined) {
    return refusal;
  }

  const changes = editings.flatMap((editing) => {
    switch (editing.kind) {
      case "edited":
        return editing.changes;
      case "refused":
        return [];
    }
  });
  const ordered = inTextOrder(changes);

  return { kind: "edited", changes: ordered, ids: [] };
}

export function fieldEditingOf(
  editable: EditableText,
  action: FieldAction,
): Editing {
  switch (action.kind) {
    case "setField":
      return fieldSettingOf(editable, action);
    case "clearField":
      return fieldClearingOf(editable, action);
    case "setCondition":
      return conditionSettingOf(editable, action);
    case "setTemplate":
      return templateSettingOf(editable, action);
  }
}

export function fieldWritingOf(
  editable: EditableText,
  pointer: string,
  value: JsonValue | null,
): Editing {
  const written = valueAt(editable.document, pointer);
  const isWritten = written !== undefined;
  const writtenText = JSON.stringify(written);
  const valueText = JSON.stringify(value);
  const isStanding = writtenText === valueText;

  if (value !== null && isStanding) {
    return unedited;
  }

  if (value !== null) {
    const setting: SetField = { kind: "setField", pointer, value };
    return fieldSettingOf(editable, setting);
  }

  if (!isWritten) {
    return unedited;
  }

  const clearing: ClearField = { kind: "clearField", pointer };
  return fieldClearingOf(editable, clearing);
}

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

function conditionSettingOf(
  editable: EditableText,
  action: SetCondition,
): Editing {
  const written = conditionTextOf(action.condition);

  switch (written.kind) {
    case "text": {
      const setting: SetField = {
        kind: "setField",
        pointer: action.pointer,
        value: written.text,
      };
      return fieldSettingOf(editable, setting);
    }
    case "refused":
      return written;
  }
}

function templateSettingOf(
  editable: EditableText,
  action: SetTemplate,
): Editing {
  const pointer = action.pointer;
  const written = valueAt(editable.document, pointer);
  const standing = writtenTemplateOf(written, pointer);
  const template = templateTextOf(action.parts);

  if (standing.kind === "refused") {
    return standing;
  }

  if (standing.kind === "expression") {
    return {
      kind: "refused",
      reason: `${pointer} holds an expression a template does not show; edit it as jq.`,
    };
  }

  switch (template.kind) {
    case "text": {
      const setting: SetField = {
        kind: "setField",
        pointer,
        value: template.text,
      };
      return fieldSettingOf(editable, setting);
    }
    case "refused":
      return template;
  }
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

  const field = { item, node };
  const value = valueTextOf(editable, action, field);
  const end = value.end;

  if (key === null) {
    const start = offsetOf(text, node.start);
    const span = { start, end };
    return changeOf(text, span, value.text);
  }

  const start = afterColonOf(text, key);
  const span = { start, end };
  const replacement = ` ${value.text}`;
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

function valueTextOf(
  editable: EditableText,
  action: SetField,
  field: WrittenField,
): ValueText {
  const text = editable.text;
  const value = action.value;
  const end = offsetOf(text, field.item.end);

  if (typeof value !== "string") {
    const inline = inlineYamlOf(value);
    return { text: inline, end };
  }

  const written = writtenScalarOf(text, field);
  const isBlock = isBlockMember(editable, action.pointer);

  if (!isBlock) {
    const scalar = scalarLike(written.text, value);
    return { text: scalar, end };
  }

  const lineEnd = end + written.trailing.length;
  const blockEnd = lineEnd + written.kept.length;
  const isBlockScalar = isBlockScalarFor(written, value);

  if (isBlockScalar) {
    const block = blockScalarLike(written, value);
    return { text: block, end: blockEnd };
  }

  const line = lineInBlockLike(written, value);
  const lineSpanEnd = written.kept === "" ? end : blockEnd;
  return { text: line, end: lineSpanEnd };
}

function writtenScalarOf(text: string, field: WrittenField): WrittenScalar {
  const { item, node } = field;
  const written = textIn(text, node);
  const line = lineTextAt(text, item.end);
  const valueEnd = item.end.column - 1;
  const trailing = line.slice(valueEnd);
  const indent = item.start.column - 1;
  const end = offsetOf(text, item.end);
  const lineEnd = end + trailing.length;
  const isKept = isKeptBlockOf(written);
  const kept = isKept ? keptLinesAt(text, lineEnd) : "";
  const after = text.slice(lineEnd + kept.length + 1);
  const [following = ""] = after.split("\n", 1);

  return { text: written, indent, trailing, kept, following };
}

function keptLinesAt(text: string, lineEnd: number): string {
  const rest = text.slice(lineEnd);
  const found = /^(?:\n[ \t]*(?=\n))*/.exec(rest);

  return found?.[0] ?? "";
}

function unheldOf(pointer: string): string {
  return `No written field stands at '${pointer}'.`;
}
