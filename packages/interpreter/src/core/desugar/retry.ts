import type * as ast from "../../syntax/index.js";
import {
  type Delay,
  type Jitter,
  type Retry,
  type RetryPolicy,
  type TimeLimit,
  countedAttempts,
  jitterRange,
  noDelay,
  noJitter,
  noRetry,
  retryPolicy,
  unboundedAttempts,
  unlimitedDuration,
  withinDuration,
} from "../forms/index.js";
import type { StaticFrame } from "../storage/index.js";
import { type Substitution, componentOf } from "./components.js";
import type { Context } from "./context.js";
import { durationOf } from "./durations.js";
import { errorTestsOf } from "./error-tests.js";

export function retryOf(
  retry: ast.RetryPolicy | ast.Reference | null,
  frame: StaticFrame,
  context: Context,
): Retry {
  if (retry === null) {
    return noRetry;
  }

  const substitution = policyOf(retry, context);
  return retryPolicyOf(substitution.component, frame, substitution.context);
}

function policyOf(
  retry: ast.RetryPolicy | ast.Reference,
  context: Context,
): Substitution<ast.RetryPolicy> {
  const retries = context.model.symbols.references.retries;
  return componentOf(retry, retries, context);
}

function retryPolicyOf(
  policy: ast.RetryPolicy,
  frame: StaticFrame,
  context: Context,
): RetryPolicy {
  const caught = context.extended(frame);
  const limit = policy.limit;
  const tests = errorTestsOf(policy.when, policy.exceptWhen, caught);
  const delay = delayOf(policy.delay, caught);
  const backoff = policy.backoff.kind;
  const attempts = attemptsOf(limit.attempt.count);
  const attempt = timeLimitOf(limit.attempt.duration, context);
  const duration = timeLimitOf(limit.duration, caught);
  const jitter = jitterOf(policy.jitter, caught);

  return retryPolicy({
    tests,
    delay,
    backoff,
    attempts,
    attempt,
    duration,
    jitter,
  });
}

function delayOf(delay: ast.Duration | null, context: Context): Delay {
  if (delay === null) {
    return noDelay;
  }

  return durationOf(delay, context);
}

function attemptsOf(count: number | null): RetryPolicy["attempts"] {
  if (count === null) {
    return unboundedAttempts;
  }

  return countedAttempts({ count });
}

function timeLimitOf(
  written: ast.Duration | null,
  context: Context,
): TimeLimit {
  if (written === null) {
    return unlimitedDuration;
  }

  const duration = durationOf(written, context);
  return withinDuration({ duration });
}

function jitterOf(jitter: ast.Jitter | null, context: Context): Jitter {
  if (jitter === null) {
    return noJitter;
  }

  const from = durationOf(jitter.from, context);
  const to = durationOf(jitter.to, context);

  return jitterRange({ from, to });
}
