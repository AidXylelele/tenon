import type { JsonValue } from "../../api/index.js";
import type { Directive, Flow } from "../../core/index.js";
import { InterpreterError } from "../../runtime/index.js";

interface Normal {
  readonly kind: "normal";
}

interface Exited {
  readonly kind: "exited";
}

interface JumpTo {
  readonly kind: "jump";
  readonly index: number;
}

export type Signal = Normal | Exited | Flow | JumpTo;

export interface Completion {
  readonly value: JsonValue;
  readonly signal: Signal;
}

interface NextTask {
  readonly kind: "next";
  readonly index: number;
}

interface OutOfList {
  readonly kind: "out";
  readonly completion: Completion;
}

type ListStep = NextTask | OutOfList;

interface NoBypass {
  readonly kind: "none";
}

interface Bypassing {
  readonly kind: "bypass";
  readonly completion: Completion;
}

type Bypass = NoBypass | Bypassing;

export const normalSignal: Normal = { kind: "normal" };

export const exitedSignal: Exited = { kind: "exited" };

const noBypass: NoBypass = { kind: "none" };

export function jumpSignalOf(index: number): JumpTo {
  return { kind: "jump", index };
}

export function signalOf(directive: Directive): Signal {
  switch (directive.kind) {
    case "continue":
    case "exit":
    case "end":
      return directive;
    case "jump":
      return jumpSignalOf(directive.index);
  }
}

export function normalOf(value: JsonValue): Completion {
  return completionOf(value, normalSignal);
}

export function completionOf(value: JsonValue, signal: Signal): Completion {
  return { value, signal };
}

export function directedOf(then: Directive, body: Completion): Completion {
  switch (body.signal.kind) {
    case "normal":
    case "exited": {
      const signal = signalOf(then);
      return completionOf(body.value, signal);
    }
    case "continue":
    case "exit":
    case "jump":
    case "end":
      return body;
  }
}

export function listStepOf(task: Completion, index: number): ListStep {
  const signal = task.signal;

  switch (signal.kind) {
    case "continue":
      return { kind: "next", index: index + 1 };
    case "jump":
      return { kind: "next", index: signal.index };
    case "exit": {
      const completion = completionOf(task.value, exitedSignal);
      return { kind: "out", completion };
    }
    case "end":
      return { kind: "out", completion: task };
    case "normal":
    case "exited":
      throw new InterpreterError("A task completes with a directive.");
  }
}

export function isEnded(completion: Completion): boolean {
  return completion.signal.kind === "end";
}

export function returnedOf(procedure: Completion): Completion {
  const ended = isEnded(procedure);

  if (ended) {
    return procedure;
  }

  return normalOf(procedure.value);
}

export function bypassOf(list: Completion): Bypass {
  switch (list.signal.kind) {
    case "normal":
      return noBypass;
    case "exited": {
      const completion = normalOf(list.value);
      return { kind: "bypass", completion };
    }
    case "end":
      return { kind: "bypass", completion: list };
    case "continue":
    case "exit":
    case "jump":
      throw new InterpreterError(
        "A task list completes normal, exited or end.",
      );
  }
}

export function closedOf(extended: Completion, list: Completion): Completion {
  const ended = isEnded(list);

  if (!ended) {
    return extended;
  }

  const signal = sequencedSignalOf(extended.signal, list.signal);
  return completionOf(extended.value, signal);
}

export function sequencedSignalOf(earlier: Signal, later: Signal): Signal {
  const isKept = earlier.kind === "end" || later.kind === "normal";

  if (isKept) {
    return earlier;
  }

  return later;
}
