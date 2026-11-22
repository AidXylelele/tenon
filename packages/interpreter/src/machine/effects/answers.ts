import type { EffectId, EffectResponse } from "../../api/index.js";
import { InterpreterError } from "../../runtime/index.js";
import { type Fiber, type ReadyFiber, topFrameOf } from "../fibers/index.js";
import type { Frame } from "../frames/index.js";
import { type EffectKey, effectIdOf } from "../identity/index.js";
import type { FiberId } from "../registers/index.js";
import { responding } from "../transitions/index.js";
import {
  type Taker,
  awaitedDecodingOf,
  checkAnswer,
} from "./decoders/index.js";

interface NothingAwaited {
  readonly kind: "nothing";
}

interface EffectAwaited {
  readonly kind: "effect";
  readonly key: EffectKey;
  readonly taker: Taker;
}

type AwaitedAtTop = NothingAwaited | EffectAwaited;

interface Awaiting {
  readonly fiber: FiberId;
  readonly id: EffectId;
  readonly taker: Taker;
}

const nothingAwaited: AwaitedAtTop = { kind: "nothing" };

export function checkAdmitted(
  fibers: readonly Fiber[],
  response: EffectResponse,
): void {
  admittedOf(fibers, response);
}

export function admittedAnswerOf(
  fibers: readonly Fiber[],
  response: EffectResponse,
): ReadyFiber {
  const awaiting = admittedOf(fibers, response);
  return readiedOf(awaiting, response);
}

export function answerOf(
  fibers: readonly Fiber[],
  response: EffectResponse,
): ReadyFiber {
  const awaiting = awaitingOf(fibers, response.id);
  return readiedOf(awaiting, response);
}

export function checkAwaiting(fiber: Fiber): void {
  const top = topFrameOf(fiber);
  const awaited = awaitedBy(top);

  if (awaited.kind === "effect") {
    return;
  }

  throw new InterpreterError(
    `The fiber ${String(fiber.id)} suspends on its top frame '${top.kind}', which awaits no answer.`,
  );
}

export function checkUnqueued(
  queued: readonly EffectResponse[],
  id: EffectId,
): void {
  const isQueued = queued.some((response) => response.id === id);

  if (isQueued) {
    throw new InterpreterError(
      `The effect '${id}' is answered already: its response is queued, and the host holds a further one until the step that resumes the run.`,
    );
  }
}

function admittedOf(
  fibers: readonly Fiber[],
  response: EffectResponse,
): Awaiting {
  const awaiting = awaitingOf(fibers, response.id);

  checkAnswer(awaiting.taker, response.outcome);
  return awaiting;
}

function readiedOf(awaiting: Awaiting, response: EffectResponse): ReadyFiber {
  const control = responding(response.outcome);
  return { kind: "run", fiber: awaiting.fiber, control };
}

function awaitingOf(fibers: readonly Fiber[], id: EffectId): Awaiting {
  const awaitings = fibers.flatMap(awaitingsOf);
  const awaiting = awaitings.find((candidate) => candidate.id === id);

  if (awaiting === undefined) {
    throw new InterpreterError(`No fiber awaits the effect '${id}'.`);
  }

  return awaiting;
}

function awaitingsOf(fiber: Fiber): readonly Awaiting[] {
  const frame = fiber.continuation.peek();
  const awaited = awaitedBy(frame);

  switch (awaited.kind) {
    case "nothing":
      return [];
    case "effect": {
      const id = effectIdOf(awaited.key);
      return [{ fiber: fiber.id, id, taker: awaited.taker }];
    }
  }
}

function awaitedBy(frame: Frame | undefined): AwaitedAtTop {
  if (frame?.kind === "await") {
    const awaited = awaitedDecodingOf(frame.effect);
    return { kind: "effect", key: frame.effect, taker: awaited.decoding };
  }

  if (frame?.kind === "receive") {
    const taker = frame.stream.source;
    return { kind: "effect", key: frame.effect, taker };
  }

  return nothingAwaited;
}
