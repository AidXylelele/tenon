import type { JsonObject } from "interpreter/front-end";
import { childPointerOf, isJsonObject, valueAt } from "../pointers/index.js";
import {
  nameConflictOf,
  protectedStepOf,
  type RetrySetting,
  retriedWhenOf,
  retryPolicyOf,
  type StepNode,
} from "../steps/index.js";
import { dedentedOf, indentedOf, textIn } from "../text/index.js";
import { inlineYamlOf, yamlOf } from "../yaml-text/index.js";
import {
  changeOf,
  editedSliceOf,
  insertionOf,
  itemFormsOf,
  mappingTextOf,
  removalOf,
} from "./collection-text.js";
import { fieldClearingOf, fieldSettingOf } from "./field-actions.js";
import { idChangesOf, placedStepOf } from "./ids.js";
import type {
  CatchHandling,
  ClearField,
  Editable,
  Editing,
  Failure,
  Handling,
  SetFailure,
  SetField,
  Wrapping,
  WrittenItem,
  WrittenRetry,
  WrittenStep,
} from "./interfaces.js";
import { unknownStepOf, writtenStepOf } from "./step-actions.js";

const unchanged: Editing = { kind: "edited", changes: [], ids: [] };

const defaultBinder = "error";

const stopping: Handling = { kind: "stop" };

const continuing: Handling = {
  kind: "catch",
  catch: {},
  retry: null,
  isHandling: false,
};

const handlingAtOnce: Handling = {
  kind: "catch",
  catch: { do: [] },
  retry: null,
  isHandling: true,
};

export function failureSettingOf(
  editable: Editable,
  action: SetFailure,
): Editing {
  const written = writtenStepOf(editable, action.step);

  if (written === null) {
    return { kind: "refused", reason: unknownStepOf(action.step) };
  }

  const inner = protectedStepOf(written.step);
  const binder = binderOf(written.step, inner);
  const handling = handlingOf(action.failure, binder);

  if (handling.kind === "refused") {
    return handling;
  }

  if (handling.kind === "stop") {
    return stoppingOf(editable, written, inner);
  }

  if (inner === null) {
    return protectionOf(editable, written, handling.catch);
  }

  return handlingChangeOf(editable, written, handling);
}

function stoppingOf(
  editable: Editable,
  written: WrittenStep,
  inner: StepNode | null,
): Editing {
  if (inner === null) {
    return unchanged;
  }

  return unprotectionOf(editable, written, inner);
}

function binderOf(step: StepNode, inner: StepNode | null): string {
  const task = step.task;

  if (inner === null || task.kind !== "try") {
    return defaultBinder;
  }

  return task.catch.as;
}

function handlingOf(failure: Failure, binder: string): Handling {
  switch (failure.kind) {
    case "stop":
      return stopping;
    case "continue":
      return continuing;
    case "retry":
      return retryingOf(failure.retry, binder);
    case "handle":
      return handlingAfterOf(failure.retry ?? null, binder);
  }
}

function retryingOf(retry: RetrySetting, binder: string): Handling {
  const written = writtenRetryOf(retry, binder);

  if (written.kind === "refused") {
    return written;
  }

  const policy = written.policy;
  const caught = { retry: policy };
  return { kind: "catch", catch: caught, retry: policy, isHandling: false };
}

function handlingAfterOf(retry: RetrySetting | null, binder: string): Handling {
  if (retry === null) {
    return handlingAtOnce;
  }

  const written = writtenRetryOf(retry, binder);

  if (written.kind === "refused") {
    return written;
  }

  const policy = written.policy;
  const caught = { retry: policy, do: [] };
  return { kind: "catch", catch: caught, retry: policy, isHandling: true };
}

function writtenRetryOf(retry: RetrySetting, binder: string): WrittenRetry {
  const when = retriedWhenOf(retry.on, binder);

  if (when?.kind === "refused") {
    return when;
  }

  const text = when?.text ?? null;
  const policy = retryPolicyOf(retry, text);
  return { kind: "policy", policy };
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
  handling: CatchHandling,
): Editing {
  const { step } = written;
  const caughtPointer = childPointerOf(step.pointer, "catch");
  const caught = valueAt(editable.document, caughtPointer);
  const isHandled = isJsonObject(caught) && caught.do !== undefined;

  if (isHandled && handling.isHandling) {
    return retryChangeOf(editable, caughtPointer, handling.retry);
  }

  const task = valueAt(editable.document, step.pointer);
  const keys = isJsonObject(task) ? Object.keys(task) : [];
  const mapping = mappingTextOf(editable, step.pointer, keys);
  const index = keys.indexOf("catch");
  const caughtSpan = mapping?.items[index];

  if (mapping === null || caughtSpan === undefined) {
    return { kind: "refused", reason: unknownStepOf(step.id) };
  }

  const member = { catch: handling.catch };
  const replacement =
    mapping.kind === "block"
      ? indentedOf(yamlOf(member), mapping.indent)
      : `catch: ${inlineYamlOf(handling.catch)}`;
  const change = changeOf(editable.text, caughtSpan, replacement);

  return { kind: "edited", changes: [change], ids: [] };
}

function retryChangeOf(
  editable: Editable,
  caughtPointer: string,
  retry: JsonObject | null,
): Editing {
  const pointer = childPointerOf(caughtPointer, "retry");
  const isWritten = valueAt(editable.document, pointer) !== undefined;

  if (retry !== null) {
    const setting: SetField = { kind: "setField", pointer, value: retry };
    return fieldSettingOf(editable, setting);
  }

  if (!isWritten) {
    return unchanged;
  }

  const clearing: ClearField = { kind: "clearField", pointer };
  return fieldClearingOf(editable, clearing);
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
