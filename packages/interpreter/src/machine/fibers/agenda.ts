import type { FiberId } from "../registers/index.js";
import type { Control } from "../transitions/index.js";

export interface ReadyFiber {
  readonly kind: "run";
  readonly fiber: FiberId;
  readonly control: Control;
}

interface Lapse {
  readonly kind: "lapse";
}

export type AgendaItem = ReadyFiber | Lapse;

export const lapsing: Lapse = { kind: "lapse" };

export function isAnswerTo(ready: ReadyFiber, fiber: FiberId): boolean {
  const isFor = ready.fiber === fiber;
  const isAnswer = ready.control.kind === "respond";
  const isAnswerFor = isFor && isAnswer;

  return isAnswerFor;
}
