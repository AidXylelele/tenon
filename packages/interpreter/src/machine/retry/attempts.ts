import type { Handle, TimeLimit } from "../../core/index.js";
import {
  type Attempt,
  type Frame,
  type RetryWindow,
  attemptOf,
  handleK,
  unopenedRetries,
} from "../frames/index.js";
import { attemptPathOf } from "../identity/index.js";
import { type Here, withPath } from "../registers/index.js";
import { limitEntryOf } from "../time/index.js";
import {
  type Transition,
  evaluating,
  raising,
  transitionOf,
} from "../transitions/index.js";
import { instantOf } from "../values/index.js";
import type { View } from "../view.js";

export interface AttemptStart {
  readonly handle: Handle;
  readonly attempt: Attempt;
  readonly here: Here;
}

const firstNumber = 1;

export function firstAttemptOf(here: Here, view: View): Attempt {
  return attemptOf({
    number: firstNumber,
    input: here.value,
    firstStarted: view.context.now,
    window: unopenedRetries,
  });
}

export function nextAttemptOf(attempt: Attempt, window: RetryWindow): Attempt {
  const number = attempt.number + 1;

  return attemptOf({
    number,
    input: attempt.input,
    firstStarted: attempt.firstStarted,
    window,
  });
}

export function attemptEnteredOf(start: AttemptStart, view: View): Transition {
  const retry = start.handle.retry;

  switch (retry.kind) {
    case "never":
      return handledOf(start, []);
    case "policy":
      return limitedOf(retry.attempt, start, view);
  }
}

function limitedOf(
  limit: TimeLimit,
  start: AttemptStart,
  view: View,
): Transition {
  switch (limit.kind) {
    case "unlimited":
      return handledOf(start, []);
    case "within": {
      const instant = instantOf(limit.duration, start.here, view);
      return withinOf(instant, start, view);
    }
  }
}

function withinOf(
  instant: number,
  start: AttemptStart,
  view: View,
): Transition {
  const entry = limitEntryOf(instant, view.context.now);

  switch (entry.kind) {
    case "passed": {
      const handler = handlerOf(start);
      const next = raising(entry.timeout);
      const frames = [handler];
      return transitionOf(next, frames, []);
    }
    case "running": {
      const above = [entry.frame];
      return handledOf(start, above);
    }
  }
}

function handledOf(start: AttemptStart, above: readonly Frame[]): Transition {
  const handler = handlerOf(start);
  const frames = [handler, ...above];
  const scope = start.here.scope;
  const path = attemptPathOf(scope.path, start.attempt.number);
  const attempting = withPath(scope, path);
  const here: Here = { scope: attempting, value: start.attempt.input };
  const next = evaluating(start.handle.body, here);

  return transitionOf(next, frames, []);
}

function handlerOf(start: AttemptStart): Frame {
  return handleK({
    handle: start.handle,
    attempt: start.attempt,
    scope: start.here.scope,
  });
}
