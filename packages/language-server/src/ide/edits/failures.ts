import type { JsonObject } from "interpreter/front-end";
import { childPointerOf, isJsonObject, valueAt } from "../pointers/index.js";
import {
  nameConflictOf,
  protectedStepOf,
  type StepNode,
} from "../steps/index.js";
import {
  appliedOf,
  dedentedOf,
  indentedOf,
  type TextChange,
  textIn,
} from "../text/index.js";
import { inlineYamlOf, yamlOf } from "../yaml-text/index.js";
import {
  changeOf,
  insertionOf,
  itemFormsOf,
  mappingTextOf,
  removalOf,
} from "./collection-text.js";
import { idChangesOf, placedStepOf } from "./ids.js";
import type {
  Editable,
  Editing,
  Failure,
  SetFailure,
  Span,
  Wrapping,
  WrittenItem,
  WrittenStep,
} from "./interfaces.js";
import { unknownStepOf, writtenStepOf } from "./step-actions.js";

const unchanged: Editing = { kind: "edited", changes: [], ids: [] };

export function failureSettingOf(
  editable: Editable,
  action: SetFailure,
): Editing {
  const written = writtenStepOf(editable, action.step);

  if (written === null) {
    return { kind: "refused", reason: unknownStepOf(action.step) };
  }

  const inner = protectedStepOf(written.step);
  const handling = handlingOf(action.failure);

  if (inner === null) {
    return handling === null
      ? unchanged
      : protectionOf(editable, written, handling);
  }

  return handling === null
    ? unprotectionOf(editable, written, inner)
    : handlingChangeOf(editable, written, handling);
}

function handlingOf(failure: Failure): JsonObject | null {
  switch (failure.kind) {
    case "stop":
      return null;
    case "continue":
      return {};
    case "retry": {
      const backoff = failure.growing ? "exponential" : "constant";
      const retry = {
        delay: { seconds: failure.seconds },
        backoff: { [backoff]: {} },
        limit: { attempt: { count: failure.attempts } },
      };
      return { retry };
    }
    case "handle":
      return { do: [] };
  }
}

function protectionOf(
  editable: Editable,
  written: WrittenStep,
  handling: JsonObject,
): Editing {
  const { step, collection, span } = written;
  const keyRange = editable.positions.keyRangeOf(step.pointer);

  if (keyRange === null) {
    return { kind: "refused", reason: unknownStepOf(step.id) };
  }

  const key = textIn(editable.text, keyRange);
  const inner = textWithoutThenOf(editable, written);
  const then = writtenThenOf(editable, step);
  const wrapping = { key, inner, handling, then };
  const replacement =
    collection.kind === "block"
      ? blockWrapperOf(wrapping, collection.indent)
      : flowWrapperOf(wrapping);
  const change = changeOf(editable.text, span, replacement);
  const body = {
    id: `${step.id}/try`,
    pointer: childPointerOf(step.pointer, "try"),
  };
  const placed = placedStepOf(body, step.name, []);
  const ids = idChangesOf(step, placed);

  return { kind: "edited", changes: [change], ids };
}

function unprotectionOf(
  editable: Editable,
  written: WrittenStep,
  inner: StepNode,
): Editing {
  const { step, list, collection, span } = written;
  const conflict = nameConflictOf(list, inner.name, step.pointer);
  const innerWritten = writtenStepOf(editable, inner.id);

  if (conflict !== null) {
    return { kind: "refused", reason: conflict };
  }

  if (innerWritten === null) {
    return { kind: "refused", reason: unknownStepOf(inner.id) };
  }

  const item = textWithThenOf(editable, step, innerWritten);
  const forms = itemFormsOf(innerWritten.collection, item);
  const replacement =
    collection.kind === "block"
      ? indentedOf(forms.block, collection.indent)
      : forms.inline;
  const change = changeOf(editable.text, span, replacement);
  const names = list.steps.map((sibling) => sibling.name);
  const earlier = names.slice(0, step.index);
  const placed = placedStepOf(list, inner.name, earlier);
  const ids = idChangesOf(inner, placed);

  return { kind: "edited", changes: [change], ids };
}

function handlingChangeOf(
  editable: Editable,
  written: WrittenStep,
  handling: JsonObject,
): Editing {
  const { step } = written;
  const caughtPointer = childPointerOf(step.pointer, "catch");
  const caught = valueAt(editable.document, caughtPointer);
  const isHandled = isJsonObject(caught) && caught.do !== undefined;
  const isHandling = handling.do !== undefined;

  if (isHandled && isHandling) {
    return unchanged;
  }

  const task = valueAt(editable.document, step.pointer);
  const keys = isJsonObject(task) ? Object.keys(task) : [];
  const mapping = mappingTextOf(editable, step.pointer, keys);
  const index = keys.indexOf("catch");
  const caughtSpan = mapping?.items[index];

  if (mapping === null || caughtSpan === undefined) {
    return { kind: "refused", reason: unknownStepOf(step.id) };
  }

  const member = { catch: handling };
  const replacement =
    mapping.kind === "block"
      ? indentedOf(yamlOf(member), mapping.indent)
      : `catch: ${inlineYamlOf(handling)}`;
  const change = changeOf(editable.text, caughtSpan, replacement);

  return { kind: "edited", changes: [change], ids: [] };
}

function blockWrapperOf(wrapping: Wrapping, indent: number): string {
  const inner = dedentedOf(wrapping.inner, indent);
  const body = indentedOf(inner, 6);
  const member = { catch: wrapping.handling };
  const handling = indentedOf(yamlOf(member), 4);
  const then = wrapping.then === null ? "" : `    then: ${wrapping.then}\n`;
  const wrapper = `- ${wrapping.key}:\n    try:\n${body}${handling}${then}`;

  return indentedOf(wrapper, indent);
}

function flowWrapperOf(wrapping: Wrapping): string {
  const handling = inlineYamlOf(wrapping.handling);
  const then = wrapping.then === null ? "" : `, then: ${wrapping.then}`;
  const body = `try: [ ${wrapping.inner} ], catch: ${handling}${then}`;

  return `{ ${wrapping.key}: { ${body} } }`;
}

function textWithoutThenOf(editable: Editable, written: WrittenStep): string {
  const { step, span } = written;
  const task = valueAt(editable.document, step.pointer);
  const keys = isJsonObject(task) ? Object.keys(task) : [];
  const mapping = mappingTextOf(editable, step.pointer, keys);
  const index = keys.indexOf("then");
  const thenSpan = mapping?.items[index];

  if (mapping === null || thenSpan === undefined) {
    return editable.text.slice(span.start, span.end);
  }

  const removal = removalOf(mapping, thenSpan);
  return editedSliceOf(editable.text, span, removal);
}

function textWithThenOf(
  editable: Editable,
  wrapper: StepNode,
  inner: WrittenStep,
): WrittenItem {
  const { step, span } = inner;
  const thenPointer = childPointerOf(wrapper.pointer, "then");
  const then = writtenThenOf(editable, wrapper);
  const innerThen = writtenThenOf(editable, step);
  const text = editable.text.slice(span.start, span.end);
  const task = valueAt(editable.document, step.pointer);
  const written = isJsonObject(task) ? task : {};
  const value = { [step.name]: written };

  if (then === null || innerThen !== null) {
    return { text, value };
  }

  const keys = Object.keys(written);
  const mapping = mappingTextOf(editable, step.pointer, keys);

  if (mapping === null) {
    return { text, value };
  }

  const member = `then: ${then}`;
  const forms = { block: `${member}\n`, inline: member };
  const insertion = insertionOf(mapping, keys.length, forms);
  const carried = editedSliceOf(editable.text, span, [insertion]);
  const thenValue = valueAt(editable.document, thenPointer) ?? null;
  const carriedValue = { [step.name]: { ...written, then: thenValue } };

  return { text: carried, value: carriedValue };
}

function writtenThenOf(editable: Editable, step: StepNode): string | null {
  const pointer = childPointerOf(step.pointer, "then");
  const isWritten = valueAt(editable.document, pointer) !== undefined;
  const range = isWritten ? editable.positions.rangeOf(pointer) : null;

  return range === null ? null : textIn(editable.text, range);
}

function editedSliceOf(
  text: string,
  span: Span,
  changes: readonly TextChange[],
): string {
  const edited = appliedOf(text, changes);
  const growth = edited.length - text.length;

  return edited.slice(span.start, span.end + growth);
}
