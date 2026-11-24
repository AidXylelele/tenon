import { childPointerOf } from "../../runtime/index.js";
import { backoffKinds, defaults } from "../../standard/index.js";
import type {
  AttemptLimit,
  Backoff,
  Catch,
  ErrorDefinition,
  ErrorFilter,
  Jitter,
  Reference,
  RetryLimit,
  RetryPolicy,
  Timeout,
} from "../ast/index.js";
import { directiveOf } from "./directives.js";
import { durationOf } from "./durations.js";
import { fieldOf, objectFieldOf, optionalAt, requiredAt } from "./parts.js";
import { keyOf, numberOf, textOf } from "./scalars.js";
import { taskListOf } from "./tasks.js";
import type { Part } from "./types.js";
import { expressionOf, referenceOf, textTemplateOf } from "./values.js";

export function errorOf(part: Part): ErrorDefinition | Reference {
  if (typeof part.value === "string") {
    return referenceOf(part);
  }

  return errorDefinitionOf(part);
}

export function errorDefinitionOf(part: Part): ErrorDefinition {
  const type = requiredAt(part, "type", textTemplateOf);
  const status = requiredAt(part, "status", numberOf);
  const instance = optionalAt(part, "instance", textTemplateOf);
  const title = optionalAt(part, "title", textTemplateOf);
  const detail = optionalAt(part, "detail", textTemplateOf);

  return {
    kind: "error",
    pointer: part.pointer,
    type,
    status,
    instance,
    title,
    detail,
  };
}

export function catchOf(part: Part): Catch {
  const errors = errorFilterOf(part);
  const as = optionalAt(part, "as", textOf) ?? defaults.catchAs;
  const when = optionalAt(part, "when", expressionOf);
  const exceptWhen = optionalAt(part, "exceptWhen", expressionOf);
  const retry = optionalAt(part, "retry", retryOf);
  const tasks = optionalAt(part, "do", taskListOf);
  const then = optionalAt(part, "then", directiveOf);

  return {
    pointer: part.pointer,
    errors,
    as,
    when,
    exceptWhen,
    retry,
    do: tasks,
    then,
  };
}

function errorFilterOf(handler: Part): ErrorFilter | null {
  const errors = objectFieldOf(handler, "errors");
  return optionalAt(errors, "with", filterOf);
}

function filterOf(part: Part): ErrorFilter {
  const type = optionalAt(part, "type", textOf);
  const status = optionalAt(part, "status", numberOf);
  const instance = optionalAt(part, "instance", textOf);
  const title = optionalAt(part, "title", textOf);
  const detail = optionalAt(part, "detail", textOf);

  return { pointer: part.pointer, type, status, instance, title, detail };
}

function retryOf(part: Part): RetryPolicy | Reference {
  if (typeof part.value === "string") {
    return referenceOf(part);
  }

  return retryPolicyOf(part);
}

export function retryPolicyOf(part: Part): RetryPolicy {
  const when = optionalAt(part, "when", expressionOf);
  const exceptWhen = optionalAt(part, "exceptWhen", expressionOf);
  const delay = optionalAt(part, "delay", durationOf);
  const backoff = backoffAt(part);
  const limitField = objectFieldOf(part, "limit");
  const limit = limitOf(limitField);
  const jitter = optionalAt(part, "jitter", jitterOf);

  return {
    kind: "retry",
    pointer: part.pointer,
    when,
    exceptWhen,
    delay,
    backoff,
    limit,
    jitter,
  };
}

function backoffAt(policy: Part): Backoff {
  const written = fieldOf(policy, "backoff");

  if (written !== null) {
    const kind = keyOf(written, backoffKinds);
    return { kind, pointer: written.pointer };
  }

  const pointer = childPointerOf(policy.pointer, "backoff");
  return { kind: defaults.retryBackoff, pointer };
}

function limitOf(part: Part): RetryLimit {
  const attemptField = objectFieldOf(part, "attempt");
  const attempt = attemptOf(attemptField);
  const duration = optionalAt(part, "duration", durationOf);

  return { pointer: part.pointer, attempt, duration };
}

function attemptOf(part: Part): AttemptLimit {
  const count = optionalAt(part, "count", numberOf);
  const duration = optionalAt(part, "duration", durationOf);

  return { pointer: part.pointer, count, duration };
}

function jitterOf(part: Part): Jitter {
  const from = requiredAt(part, "from", durationOf);
  const to = requiredAt(part, "to", durationOf);

  return { pointer: part.pointer, from, to };
}

export function timeoutOf(part: Part): Timeout | Reference {
  if (typeof part.value === "string") {
    return referenceOf(part);
  }

  return timeoutDefinitionOf(part);
}

export function timeoutDefinitionOf(part: Part): Timeout {
  const after = requiredAt(part, "after", durationOf);
  return { kind: "timeout", pointer: part.pointer, after };
}
