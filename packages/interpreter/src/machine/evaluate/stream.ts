import type { Stream } from "../../core/index.js";
import { itemEffectOf } from "../effects/index.js";
import { type StreamK, streamK } from "../frames/index.js";
import { awaitedPhaseOf } from "../lifecycle/index.js";
import type { Here } from "../registers/index.js";
import {
  awaitingNextOf,
  consumptionAtStartOf,
  correlationStartOf,
  finishedOf,
  isStopped,
  itemAwaitedOf,
  nextValuesOf,
  sourceValuesOf,
  taskPhaseOf,
  streamWindowOf,
} from "../streams/index.js";
import type { Transition, Write } from "../transitions/index.js";
import type { RequestValues } from "../values/index.js";
import type { View } from "../view.js";

interface Asking {
  readonly values: RequestValues;
  readonly before: readonly Write[];
}

export function evaluateStream(
  term: Stream,
  here: Here,
  view: View,
): Transition {
  const values = sourceValuesOf(term.source, here, view);
  const window = streamWindowOf(term.stop, here, view);
  const consumption = consumptionAtStartOf(term.source, here, view);
  const frame = streamK({
    stream: term,
    consumption,
    window,
    input: here.value,
    scope: here.scope,
  });
  const started = correlationStartOf(frame, view);
  const stopped = isStopped(frame, view);

  if (stopped) {
    return finishedOf(frame, started, view);
  }

  const asking: Asking = { values, before: started };
  return waitingFor(frame, asking, view);
}

export function afterItemOf(frame: StreamK, view: View): Transition {
  const stopped = isStopped(frame, view);

  if (stopped) {
    return finishedOf(frame, [], view);
  }

  const values = nextValuesOf(frame, view);
  const asking: Asking = { values, before: [] };
  return waitingFor(frame, asking, view);
}

function waitingFor(frame: StreamK, asking: Asking, view: View): Transition {
  const awaiting = awaitingNextOf(frame);
  const effect = itemEffectOf(awaiting, asking.values, view);
  const awaited = awaitedPhaseOf(awaiting);
  const waiting = taskPhaseOf(awaiting, awaited, view);
  const writes = [...asking.before, ...waiting];

  return itemAwaitedOf(awaiting, effect, writes);
}
