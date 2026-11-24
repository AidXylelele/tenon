import type {
  Catch,
  CatchTest,
  Delay,
  Jitter,
  Retry,
  RetryPolicy,
  TimeLimit,
} from "../forms/index.js";
import { groupOf, labelledOf, leafOf, lineOf, type Line } from "./line.js";
import { bindersText, durationText, expressionText } from "./values.js";

function testLineOf(test: CatchTest): Line {
  switch (test.kind) {
    case "match": {
      const filter = JSON.stringify(test.filter);
      return labelledOf(test.kind, filter);
    }
    case "when":
    case "exceptWhen": {
      const condition = expressionText(test.condition);
      return labelledOf(test.kind, condition);
    }
  }
}

export function catchLineOf(handler: Catch, recovery: Line): Line {
  const tests = handler.tests.map(testLineOf);
  const names = bindersText(handler.binders);
  const binders = labelledOf("binders", names);
  const children = [...tests, binders, recovery];

  return groupOf("catch", children);
}

function policyLineOf(policy: RetryPolicy): Line {
  const tests = policy.tests.map(testLineOf);
  const delayed = delayText(policy.delay);
  const counted = attemptsText(policy);
  const eachAttempt = limitText(policy.attempt);
  const retrying = limitText(policy.duration);
  const jittered = jitterText(policy.jitter);
  const delay = labelledOf("delay", delayed);
  const backoff = labelledOf("backoff", policy.backoff);
  const attempts = labelledOf("attempts", counted);
  const attempt = labelledOf("attempt", eachAttempt);
  const duration = labelledOf("duration", retrying);
  const jitter = labelledOf("jitter", jittered);
  const parts = [...tests, delay, backoff, attempts, attempt, duration, jitter];
  return lineOf("retry policy", parts);
}

function delayText(delay: Delay): string {
  switch (delay.kind) {
    case "noDelay":
      return "none";
    case "fixed":
    case "calendar":
    case "computed":
      return durationText(delay);
  }
}

function jitterText(jitter: Jitter): string {
  switch (jitter.kind) {
    case "noJitter":
      return "none";
    case "range": {
      const from = durationText(jitter.from);
      const to = durationText(jitter.to);
      return `${from}..${to}`;
    }
  }
}

function attemptsText(policy: RetryPolicy): string {
  switch (policy.attempts.kind) {
    case "unbounded":
      return "unbounded";
    case "count":
      return String(policy.attempts.count);
  }
}

function limitText(limit: TimeLimit): string {
  switch (limit.kind) {
    case "unlimited":
      return "unlimited";
    case "within":
      return durationText(limit.duration);
  }
}

export function retryLineOf(retry: Retry): Line {
  switch (retry.kind) {
    case "never":
      return leafOf("retry never");
    case "policy":
      return policyLineOf(retry);
  }
}
