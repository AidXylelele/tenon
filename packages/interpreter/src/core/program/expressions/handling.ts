import type {
  Catch,
  CatchTest,
  Delay,
  DurationTerm,
  Expression,
  Jitter,
  Retry,
  RetryPolicy,
  TimeLimit,
} from "../../forms/index.js";
import { durationExpressionsOf } from "./values.js";

const none: readonly Expression[] = [];

const noDurations: readonly DurationTerm[] = [];

export function catchExpressionsOf(handler: Catch): readonly Expression[] {
  return handler.tests.flatMap(testExpressionsOf);
}

export function retryExpressionsOf(retry: Retry): readonly Expression[] {
  switch (retry.kind) {
    case "never":
      return none;
    case "policy":
      return policyExpressionsOf(retry);
  }
}

function testExpressionsOf(test: CatchTest): readonly Expression[] {
  switch (test.kind) {
    case "match":
      return none;
    case "when":
    case "exceptWhen":
      return [test.condition];
  }
}

function policyExpressionsOf(policy: RetryPolicy): readonly Expression[] {
  const tests = policy.tests.flatMap(testExpressionsOf);
  const attempt = limitDurationsOf(policy.attempt);
  const delay = delayDurationsOf(policy.delay);
  const jitter = jitterDurationsOf(policy.jitter);
  const duration = limitDurationsOf(policy.duration);
  const durations = [...attempt, ...delay, ...jitter, ...duration];
  const computed = durations.flatMap(durationExpressionsOf);

  return [...tests, ...computed];
}

function delayDurationsOf(delay: Delay): readonly DurationTerm[] {
  switch (delay.kind) {
    case "noDelay":
      return noDurations;
    case "fixed":
    case "calendar":
    case "computed":
      return [delay];
  }
}

function jitterDurationsOf(jitter: Jitter): readonly DurationTerm[] {
  switch (jitter.kind) {
    case "noJitter":
      return noDurations;
    case "range":
      return [jitter.from, jitter.to];
  }
}

function limitDurationsOf(limit: TimeLimit): readonly DurationTerm[] {
  switch (limit.kind) {
    case "unlimited":
      return noDurations;
    case "within":
      return [limit.duration];
  }
}
