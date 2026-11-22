import type { JsonObject } from "../../api/index.js";
import {
  type Flow,
  continueDirective,
  endDirective,
  exitDirective,
} from "../../core/index.js";
import {
  type FlowDirective,
  flowDirectives,
  isMemberOf,
} from "../../standard/index.js";
import {
  type Completion,
  type Signal,
  completionOf,
  exitedSignal,
  jumpSignalOf,
  normalSignal,
} from "../completions/index.js";
import {
  type Attempt,
  type Joined,
  type RetryWindow,
  attemptOf,
  joinedOutput,
  pendingBranch,
  retriesUntil,
  unlimitedRetries,
  unopenedRetries,
} from "../frames/index.js";
import {
  type KindSet,
  fieldAt,
  indexAt,
  kindAt,
  numberAt,
  objectAt,
  objectsAt,
  stringAt,
} from "./fields.js";

type OwnSignal = Exclude<Signal["kind"], FlowDirective>;

const ownSignalKinds: KindSet<OwnSignal> = {
  normal: true,
  exited: true,
  jump: true,
};

const retryWindowKinds: KindSet<RetryWindow["kind"]> = {
  unopened: true,
  unlimited: true,
  until: true,
};

const joinedKinds: KindSet<Joined["kind"]> = { pending: true, joined: true };

export function encodeSignal(signal: Signal): JsonObject {
  switch (signal.kind) {
    case "normal":
    case "exited":
    case "continue":
    case "exit":
    case "end":
      return { kind: signal.kind };
    case "jump":
      return { kind: signal.kind, index: signal.index };
  }
}

export function signalAt(encoded: JsonObject, key: string): Signal {
  const signal = objectAt(encoded, key);
  const kind = stringAt(signal, "kind");
  const isFlow = isMemberOf(flowDirectives, kind);

  if (isFlow) {
    return flowOf(kind);
  }

  return ownSignalOf(signal);
}

function flowOf(kind: FlowDirective): Flow {
  switch (kind) {
    case "continue":
      return continueDirective;
    case "exit":
      return exitDirective;
    case "end":
      return endDirective;
  }
}

function ownSignalOf(signal: JsonObject): Signal {
  const kind = kindAt(signal, ownSignalKinds);

  switch (kind) {
    case "normal":
      return normalSignal;
    case "exited":
      return exitedSignal;
    case "jump":
      return decodeJump(signal);
  }
}

function decodeJump(signal: JsonObject): Signal {
  const index = indexAt(signal, "index");

  return jumpSignalOf(index);
}

export function encodeCompletion(completion: Completion): JsonObject {
  const signal = encodeSignal(completion.signal);

  return { value: completion.value, signal };
}

export function completionAt(encoded: JsonObject, key: string): Completion {
  const completion = objectAt(encoded, key);
  const value = fieldAt(completion, "value");
  const signal = signalAt(completion, "signal");

  return completionOf(value, signal);
}

export function encodeAttempt(attempt: Attempt): JsonObject {
  const window = encodeRetryWindow(attempt.window);

  return {
    number: attempt.number,
    input: attempt.input,
    firstStarted: attempt.firstStarted,
    window,
  };
}

function encodeRetryWindow(window: RetryWindow): JsonObject {
  switch (window.kind) {
    case "unopened":
    case "unlimited":
      return { kind: window.kind };
    case "until":
      return { kind: window.kind, instant: window.instant };
  }
}

export function attemptAt(encoded: JsonObject, key: string): Attempt {
  const attempt = objectAt(encoded, key);
  const number = indexAt(attempt, "number");
  const input = fieldAt(attempt, "input");
  const firstStarted = numberAt(attempt, "firstStarted");
  const window = retryWindowAt(attempt, "window");

  return attemptOf({ number, input, firstStarted, window });
}

function retryWindowAt(encoded: JsonObject, key: string): RetryWindow {
  const window = objectAt(encoded, key);
  const kind = kindAt(window, retryWindowKinds);

  switch (kind) {
    case "unopened":
      return unopenedRetries;
    case "unlimited":
      return unlimitedRetries;
    case "until": {
      const instant = numberAt(window, "instant");
      return retriesUntil(instant);
    }
  }
}

export function encodeJoined(joined: Joined): JsonObject {
  switch (joined.kind) {
    case "pending":
      return { kind: joined.kind };
    case "joined":
      return { kind: joined.kind, output: joined.output };
  }
}

export function joinedAt(encoded: JsonObject, key: string): readonly Joined[] {
  const outputs = objectsAt(encoded, key);

  return outputs.map(decodeJoined);
}

function decodeJoined(encoded: JsonObject): Joined {
  const kind = kindAt(encoded, joinedKinds);

  switch (kind) {
    case "pending":
      return pendingBranch;
    case "joined": {
      const output = fieldAt(encoded, "output");
      return joinedOutput(output);
    }
  }
}
