import type {
  ErrorDefinition,
  Jitter,
  Reference,
  RetryLimit,
  RetryPolicy,
  Timeout,
} from "../../syntax/index.js";
import {
  durationOccurrencesOf,
  referenceOccurrencesOf,
  retryReferenceOccurrencesOf,
  templateOccurrencesOf,
} from "./data.js";
import type { Context, Occurrence } from "./types.js";

const none: readonly Occurrence[] = [];

export function errorOccurrencesOf(
  error: ErrorDefinition | Reference | null,
  context: Context,
): readonly Occurrence[] {
  if (error === null) {
    return none;
  }

  switch (error.kind) {
    case "reference":
      return referenceOccurrencesOf("errors", error, context);
    case "error":
      return [
        ...templateOccurrencesOf(error.type, context),
        ...templateOccurrencesOf(error.instance, context),
        ...templateOccurrencesOf(error.title, context),
        ...templateOccurrencesOf(error.detail, context),
      ];
  }
}

export function retryOccurrencesOf(
  retry: RetryPolicy | Reference | null,
  handler: Context,
  context: Context,
): readonly Occurrence[] {
  if (retry === null) {
    return none;
  }

  switch (retry.kind) {
    case "reference":
      return retryReferenceOccurrencesOf(retry, handler, context);
    case "retry":
      return [
        ...templateOccurrencesOf(retry.when, handler),
        ...templateOccurrencesOf(retry.exceptWhen, handler),
        ...durationOccurrencesOf(retry.delay, handler),
        ...limitOccurrencesOf(retry.limit, handler, context),
        ...jitterOccurrencesOf(retry.jitter, handler),
      ];
  }
}

export function declaredRetryOccurrencesOf(
  retry: RetryPolicy,
  context: Context,
): readonly Occurrence[] {
  return retryOccurrencesOf(retry, context, context);
}

export function timeoutOccurrencesOf(
  timeout: Timeout | Reference | null,
  context: Context,
): readonly Occurrence[] {
  if (timeout === null) {
    return none;
  }

  switch (timeout.kind) {
    case "reference":
      return referenceOccurrencesOf("timeouts", timeout, context);
    case "timeout":
      return durationOccurrencesOf(timeout.after, context);
  }
}

function limitOccurrencesOf(
  limit: RetryLimit,
  handler: Context,
  context: Context,
): readonly Occurrence[] {
  return [
    ...durationOccurrencesOf(limit.attempt.duration, context),
    ...durationOccurrencesOf(limit.duration, handler),
  ];
}

function jitterOccurrencesOf(
  jitter: Jitter | null,
  context: Context,
): readonly Occurrence[] {
  if (jitter === null) {
    return none;
  }

  return [
    ...durationOccurrencesOf(jitter.from, context),
    ...durationOccurrencesOf(jitter.to, context),
  ];
}
