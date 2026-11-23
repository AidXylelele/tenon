import type { JsonObject, JsonValue } from "interpreter/front-end";
import {
  type ComparingRow,
  type Condition,
  type ConditionRow,
  type ConditionText,
  conditionOf,
  conditionTextOf,
} from "../conditions/index.js";
import { memberAccessOf } from "../jq-text/index.js";
import type {
  RetryFields,
  RetryFieldsReading,
  RetryOn,
  RetrySetting,
} from "./interfaces.js";

const timeoutType =
  "https://open-workflow-specification.org/spec/1.0.0/errors/timeout";

const anyError: RetryOn = { kind: "any" };

const timeouts: RetryOn = { kind: "timeouts" };

const writtenErrors: RetryOn = { kind: "written" };

const noStatus: ConditionText = {
  kind: "refused",
  reason: "A retry on statuses names at least one status.",
};

export function retryFieldsOf(
  retry: RetrySetting,
  binder: string,
): RetryFieldsReading {
  const when = retriedWhenOf(retry.on, binder);

  if (when?.kind === "refused") {
    return when;
  }

  const text = when?.text ?? null;
  const delay = delayOf(retry.milliseconds);
  const backoff = { [retry.backoff]: {} };
  const count = retry.retries;
  const fields = { when: text, delay, backoff, count };
  return { kind: "fields", fields };
}

export function retryPolicyOf(fields: RetryFields): JsonObject {
  const limit = limitOf(fields.count);
  const members: readonly (readonly [string, JsonValue | null])[] = [
    ["when", fields.when],
    ["delay", fields.delay],
    ["backoff", fields.backoff],
    ["limit", limit],
  ];
  const written = members.filter(([, value]) => value !== null);

  return Object.fromEntries(written);
}

function retriedWhenOf(on: RetryOn, binder: string): ConditionText | null {
  switch (on.kind) {
    case "any":
    case "written":
      return null;
    case "statuses":
      return statusesWhenOf(on.statuses, binder);
    case "timeouts": {
      const row = errorRowOf(binder, "type", timeoutType);
      return conditionTextOf({ join: "all", rows: [row] });
    }
  }
}

function limitOf(count: number | null): JsonObject | null {
  if (count === null) {
    return null;
  }

  return { attempt: { count } };
}

export function retryOnOf(
  when: string | null,
  exceptWhen: string | null,
  binder: string,
): RetryOn {
  if (exceptWhen !== null) {
    return writtenErrors;
  }

  if (when === null) {
    return anyError;
  }

  const reading = conditionOf(when);

  if (reading.kind === "expression") {
    return writtenErrors;
  }

  return conditionErrorsOf(reading.condition, binder);
}

function statusesWhenOf(
  statuses: readonly number[],
  binder: string,
): ConditionText {
  const isEmpty = statuses.length === 0;

  if (isEmpty) {
    return noStatus;
  }

  const rows = statuses.map((status) => errorRowOf(binder, "status", status));
  return conditionTextOf({ join: "any", rows });
}

function conditionErrorsOf(condition: Condition, binder: string): RetryOn {
  const { join, rows } = condition;
  const isSingle = rows.length === 1;
  const isEither = isSingle || join === "any";
  const isTimeout = isSingle && rows.every((row) => isTimeoutRow(row, binder));
  const statuses = rows.map((row) => statusOf(row, binder));
  const numbers = statuses.filter((status) => status !== null);
  const isStatuses = rows.length > 0 && numbers.length === rows.length;

  if (isTimeout) {
    return timeouts;
  }

  if (!isEither) {
    return writtenErrors;
  }

  if (!isStatuses) {
    return writtenErrors;
  }

  return { kind: "statuses", statuses: numbers };
}

function statusOf(row: ConditionRow, binder: string): number | null {
  const left = errorMemberOf(binder, "status");
  const right = row.right;
  const isStatus = row.comparison === "is" && row.left === left;

  if (!isStatus || right?.kind !== "value") {
    return null;
  }

  const value = right.value;
  return typeof value === "number" ? value : null;
}

function isTimeoutRow(row: ConditionRow, binder: string): boolean {
  const left = errorMemberOf(binder, "type");
  const right = row.right;
  const isType = row.comparison === "is" && row.left === left;

  return isType && right?.kind === "value" && right.value === timeoutType;
}

function errorRowOf(
  binder: string,
  member: string,
  value: string | number,
): ComparingRow {
  const left = errorMemberOf(binder, member);

  return { left, comparison: "is", right: { kind: "value", value } };
}

function errorMemberOf(binder: string, member: string): string {
  const variable = `$${binder}`;

  return memberAccessOf(variable, member);
}

function delayOf(milliseconds: number): JsonObject | null {
  const isNone = milliseconds === 0;
  const isWholeSeconds = milliseconds % 1000 === 0;

  if (isNone) {
    return null;
  }

  if (isWholeSeconds) {
    const seconds = milliseconds / 1000;
    return { seconds };
  }

  return { milliseconds };
}
