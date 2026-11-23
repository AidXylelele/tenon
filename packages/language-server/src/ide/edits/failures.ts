import type { ast, JsonObject, JsonValue } from "interpreter/front-end";
import { childPointerOf, isJsonObject, valueAt } from "../pointers/index.js";
import { modelOf } from "../snapshot/index.js";
import {
  nameConflictOf,
  protectedStepOf,
  type RetrySetting,
  retryFieldsOf,
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
import { combinedOf, fieldWritingOf } from "./field-actions.js";
import { idChangesOf, placedStepOf } from "./ids.js";
import type {
  CatchWriting,
  Editable,
  Editing,
  PolicyWriting,
  ProtectingFailure,
  SetFailure,
  Wrapping,
  WrittenItem,
  WrittenStep,
} from "./interfaces.js";
import { retryEditsOf } from "./retry-fields.js";
import { unknownStepOf, writtenStepOf } from "./step-actions.js";

const unchanged: Editing = { kind: "edited", changes: [], ids: [] };

const defaultBinder = "error";

const noPolicy: PolicyWriting = { kind: "policy", policy: null };

const noSteps: readonly JsonValue[] = [];

export function failureSettingOf(
  editable: Editable,
  action: SetFailure,
): Editing {
  const written = writtenStepOf(editable, action.step);

  if (written === null) {
    return { kind: "refused", reason: unknownStepOf(action.step) };
  }

  const failure = action.failure;
  const inner = protectedStepOf(written.step);
  const task = written.step.task;

  if (failure.kind === "stop") {
    return stoppingOf(editable, written, inner);
  }

  if (inner === null || task.kind !== "try") {
    return newProtectionOf(editable, written, failure);
  }

  return catchChangeOf(editable, written, task.catch, failure);
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

function newProtectionOf(
  editable: Editable,
  written: WrittenStep,
  failure: ProtectingFailure,
): Editing {
  const caught = newCatchOf(failure, defaultBinder);

  if (caught.kind === "refused") {
    return caught;
  }

  return protectionOf(editable, written, caught.catch);
}

function catchChangeOf(
  editable: Editable,
  written: WrittenStep,
  caught: ast.Catch,
  failure: ProtectingFailure,
): Editing {
  const retry = settingOf(failure);
  const isHandled = failure.kind === "handle" && caught.do !== null;

  if (retry !== null && caught.retry !== null) {
    return retryKeepingOf(editable, caught, caught.retry, failure, retry);
  }

  if (isHandled) {
    return handledRetryOf(editable, caught, retry);
  }

  const replacement = newCatchOf(failure, caught.as);

  if (replacement.kind === "refused") {
    return replacement;
  }

  return catchReplacementOf(editable, written, replacement.catch);
}

function retryKeepingOf(
  editable: Editable,
  caught: ast.Catch,
  written: ast.RetryPolicy | ast.Reference,
  failure: ProtectingFailure,
  retry: RetrySetting,
): Editing {
  const policy = policyPointerOf(editable, written);

  if (policy === null) {
    return { kind: "refused", reason: unknownRetryOf(written) };
  }

  const fields = retryEditsOf(editable, policy, retry, caught.as);
  const afterward = afterwardEditsOf(editable, caught, failure);
  const editings = [fields].concat(afterward);
  return combinedOf(editings);
}

function afterwardEditsOf(
  editable: Editable,
  caught: ast.Catch,
  failure: ProtectingFailure,
): readonly Editing[] {
  const steps = childPointerOf(caught.pointer, "do");
  const then = childPointerOf(caught.pointer, "then");

  if (failure.kind === "handle") {
    const kept = caught.do === null ? noSteps : null;
    return [fieldWritingOf(editable, steps, kept)];
  }

  const cleared = fieldWritingOf(editable, steps, null);
  const unrouted = fieldWritingOf(editable, then, null);
  return [cleared, unrouted];
}

function handledRetryOf(
  editable: Editable,
  caught: ast.Catch,
  retry: RetrySetting | null,
): Editing {
  const policy = newPolicyOf(retry, caught.as);

  if (policy.kind === "refused") {
    return policy;
  }

  const pointer = childPointerOf(caught.pointer, "retry");
  return fieldWritingOf(editable, pointer, policy.policy);
}

function policyPointerOf(
  editable: Editable,
  written: ast.RetryPolicy | ast.Reference,
): string | null {
  switch (written.kind) {
    case "retry":
      return written.pointer;
    case "reference": {
      const model = modelOf(editable.snapshot);
      const named = model?.symbols.references.retries.get(written.pointer);
      return named?.pointer ?? null;
    }
  }
}

function settingOf(failure: ProtectingFailure): RetrySetting | null {
  switch (failure.kind) {
    case "continue":
      return null;
    case "retry":
      return failure.retry;
    case "handle": {
      const retry = failure.retry ?? null;
      return retry;
    }
  }
}

function newCatchOf(failure: ProtectingFailure, binder: string): CatchWriting {
  const retry = settingOf(failure);
  const policy = newPolicyOf(retry, binder);

  if (policy.kind === "refused") {
    return policy;
  }

  const isNamed = binder !== defaultBinder;
  const isHandling = failure.kind === "handle";
  const as = isNamed ? binder : null;
  const steps = isHandling ? noSteps : null;
  const members: readonly (readonly [string, JsonValue | null])[] = [
    ["as", as],
    ["retry", policy.policy],
    ["do", steps],
  ];
  const written = members.filter(([, value]) => value !== null);
  const caught = Object.fromEntries(written);
  return { kind: "catch", catch: caught };
}

function newPolicyOf(
  retry: RetrySetting | null,
  binder: string,
): PolicyWriting {
  if (retry === null) {
    return noPolicy;
  }

  const reading = retryFieldsOf(retry, binder);

  if (reading.kind === "refused") {
    return reading;
  }

  const policy = retryPolicyOf(reading.fields);
  return { kind: "policy", policy };
}

function unknownRetryOf(written: ast.RetryPolicy | ast.Reference): string {
  return `No retry policy stands at ${written.pointer}.`;
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

function catchReplacementOf(
  editable: Editable,
  written: WrittenStep,
  caught: JsonObject,
): Editing {
  const { step } = written;
  const task = valueAt(editable.document, step.pointer);
  const keys = isJsonObject(task) ? Object.keys(task) : [];
  const mapping = mappingTextOf(editable, step.pointer, keys);
  const index = keys.indexOf("catch");
  const caughtSpan = mapping?.items[index];

  if (mapping === null || caughtSpan === undefined) {
    return { kind: "refused", reason: unknownStepOf(step.id) };
  }

  const member = { catch: caught };
  const replacement =
    mapping.kind === "block"
      ? indentedOf(yamlOf(member), mapping.indent)
      : `catch: ${inlineYamlOf(caught)}`;
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
