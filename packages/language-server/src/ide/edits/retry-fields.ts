import type { JsonValue } from "interpreter/front-end";
import { childPointerOf } from "../pointers/index.js";
import { type RetrySetting, retryFieldsOf } from "../steps/index.js";
import { combinedOf, fieldWritingOf } from "./field-actions.js";
import type { EditableText, Editing } from "./interfaces.js";

export function retryEditsOf(
  editable: EditableText,
  policy: string,
  retry: RetrySetting,
  binder: string,
): Editing {
  const reading = retryFieldsOf(retry, binder);

  if (reading.kind === "refused") {
    return reading;
  }

  const { when, delay, backoff, count } = reading.fields;
  const limit = childPointerOf(policy, "limit");
  const attempt = childPointerOf(limit, "attempt");
  const delayPointer = childPointerOf(policy, "delay");
  const backoffPointer = childPointerOf(policy, "backoff");
  const countPointer = childPointerOf(attempt, "count");
  const whenPointer = childPointerOf(policy, "when");
  const exceptWhenPointer = childPointerOf(policy, "exceptWhen");
  const timing: readonly (readonly [string, JsonValue | null])[] = [
    [delayPointer, delay],
    [backoffPointer, backoff],
    [countPointer, count],
  ];
  const conditions: readonly (readonly [string, JsonValue | null])[] = [
    [whenPointer, when],
    [exceptWhenPointer, null],
  ];
  const isWritten = retry.on.kind === "written";
  const timingEdits = timing.map(([pointer, value]) =>
    fieldWritingOf(editable, pointer, value),
  );

  if (isWritten) {
    return combinedOf(timingEdits);
  }

  const conditionEdits = conditions.map(([pointer, value]) =>
    fieldWritingOf(editable, pointer, value),
  );
  const editings = conditionEdits.concat(timingEdits);
  return combinedOf(editings);
}
