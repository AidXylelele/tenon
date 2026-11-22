import type { JsonObject, JsonValue } from "../../api/index.js";
import type {
  CatchTest,
  Delay,
  Jitter,
  RetryPolicy,
  Term,
  TimeLimit,
} from "../../core/index.js";
import {
  derivedFractionOf,
  isJsonEqual,
  isTruthy,
} from "../../runtime/index.js";
import {
  type Attempt,
  type HandleK,
  type UnlimitedWindow,
  type WindowUntil,
  retriesUntil,
  unlimitedRetries,
} from "../frames/index.js";
import {
  type RetryKey,
  attemptPathOf,
  effectIdOf,
  retryKeyOf,
} from "../identity/index.js";
import {
  type BoundValues,
  type Here,
  withEnvironment,
} from "../registers/index.js";
import { expressionValueOf, millisecondsOf } from "../values/index.js";
import type { View } from "../view.js";
import { nextAttemptOf } from "./attempts.js";
import { type Amounts, factorOf, waitOf } from "./backoff.js";

interface Passing {
  readonly kind: "pass";
}

interface Recovering {
  readonly kind: "recover";
  readonly body: Term;
  readonly here: Here;
}

interface Reraising {
  readonly kind: "reraise";
}

export interface Retrying {
  readonly kind: "retry";
  readonly next: Attempt;
  readonly timer: RetryKey;
  readonly until: number;
}

type Decision = Passing | Recovering | Reraising | Retrying;

interface Caught {
  readonly frame: HandleK;
  readonly error: JsonObject;
  readonly here: Here;
}

type Opened = UnlimitedWindow | WindowUntil;

const passing: Passing = { kind: "pass" };

const reraising: Reraising = { kind: "reraise" };

export function decisionOf(
  frame: HandleK,
  error: JsonObject,
  view: View,
): Decision {
  const caught = caughtOf(frame, error);
  const tests = frame.handle.catch.tests;
  const isTaken = takes(tests, caught, view);

  if (!isTaken) {
    return passing;
  }

  const retry = frame.handle.retry;

  switch (retry.kind) {
    case "never":
      return declinedOf(caught);
    case "policy":
      return grantOf(retry, caught, view);
  }
}

function grantOf(policy: RetryPolicy, caught: Caught, view: View): Decision {
  const attempt = caught.frame.attempt;
  const isCounted = isWithinCount(policy.attempts, attempt.number);

  if (!isCounted) {
    return declinedOf(caught);
  }

  const isRetried = takes(policy.tests, caught, view);

  if (!isRetried) {
    return declinedOf(caught);
  }

  return timedOf(policy, caught, view);
}

function timedOf(policy: RetryPolicy, caught: Caught, view: View): Decision {
  const amounts = amountsOf(policy, caught.here, view);
  const window = retryingWindowOf(policy.duration, caught, view);
  const attempt = caught.frame.attempt;
  const next = nextAttemptOf(attempt, window);
  const path = attemptPathOf(caught.frame.scope.path, next.number);
  const timer = retryKeyOf(path);
  const fraction = fractionOf(policy.jitter, timer, view);
  const factor = factorOf(policy.backoff, attempt.number);
  const wait = waitOf(amounts, factor, fraction);
  const until = view.context.now + wait;
  const isInTime = isWithin(window, until);

  if (!isInTime) {
    return declinedOf(caught);
  }

  return { kind: "retry", next, timer, until };
}

function caughtOf(frame: HandleK, error: JsonObject): Caught {
  const binders = frame.handle.catch.binders;
  const bound: BoundValues = { error };
  const environment = frame.scope.environment.bound(binders, bound);
  const scope = withEnvironment(frame.scope, environment);
  const here: Here = { scope, value: error };

  return { frame, error, here };
}

function declinedOf(caught: Caught): Decision {
  const recovery = caught.frame.handle.catch.recovery;

  switch (recovery.kind) {
    case "recover": {
      const scope = caught.here.scope;
      const input = caught.frame.attempt.input;
      const here: Here = { scope, value: input };
      return { kind: "recover", body: recovery.body, here };
    }
    case "reraise":
      return reraising;
  }
}

function takes(
  tests: readonly CatchTest[],
  caught: Caught,
  view: View,
): boolean {
  return tests.every((test) => passes(test, caught, view));
}

function passes(test: CatchTest, caught: Caught, view: View): boolean {
  switch (test.kind) {
    case "match":
      return carriesAll(caught.error, test.filter);
    case "when": {
      const value = expressionValueOf(test.condition, caught.here, view);
      return isTruthy(value);
    }
    case "exceptWhen": {
      const value = expressionValueOf(test.condition, caught.here, view);
      return !isTruthy(value);
    }
  }
}

function carriesAll(error: JsonObject, filter: JsonObject): boolean {
  const written = Object.entries(filter);

  return written.every(([property, value]) => carries(error, property, value));
}

function carries(
  error: JsonObject,
  property: string,
  value: JsonValue,
): boolean {
  const isOwn = Object.hasOwn(error, property);
  const carried = error[property];
  const isCarried = isOwn && carried !== undefined;

  if (!isCarried) {
    return false;
  }

  return isJsonEqual(carried, value);
}

function isWithinCount(
  attempts: RetryPolicy["attempts"],
  number: number,
): boolean {
  switch (attempts.kind) {
    case "unbounded":
      return true;
    case "count":
      return number <= attempts.count;
  }
}

function amountsOf(policy: RetryPolicy, here: Here, view: View): Amounts {
  const delay = delayOf(policy.delay, here, view);
  const jitter = policy.jitter;

  switch (jitter.kind) {
    case "noJitter":
      return { delay, from: 0, to: 0 };
    case "range": {
      const from = millisecondsOf(jitter.from, here, view);
      const to = millisecondsOf(jitter.to, here, view);
      return { delay, from, to };
    }
  }
}

function delayOf(delay: Delay, here: Here, view: View): number {
  switch (delay.kind) {
    case "noDelay":
      return 0;
    case "fixed":
    case "calendar":
    case "computed":
      return millisecondsOf(delay, here, view);
  }
}

function fractionOf(jitter: Jitter, timer: RetryKey, view: View): number {
  switch (jitter.kind) {
    case "noJitter":
      return 0;
    case "range": {
      const id = effectIdOf(timer);
      return derivedFractionOf(view.run.instance, id);
    }
  }
}

function retryingWindowOf(
  limit: TimeLimit,
  caught: Caught,
  view: View,
): Opened {
  const window = caught.frame.attempt.window;

  switch (window.kind) {
    case "unopened":
      return openedOf(limit, caught, view);
    case "unlimited":
    case "until":
      return window;
  }
}

function openedOf(limit: TimeLimit, caught: Caught, view: View): Opened {
  switch (limit.kind) {
    case "unlimited":
      return unlimitedRetries;
    case "within": {
      const length = millisecondsOf(limit.duration, caught.here, view);
      const instant = caught.frame.attempt.firstStarted + length;
      return retriesUntil(instant);
    }
  }
}

function isWithin(window: Opened, start: number): boolean {
  switch (window.kind) {
    case "unlimited":
      return true;
    case "until":
      return start <= window.instant;
  }
}
