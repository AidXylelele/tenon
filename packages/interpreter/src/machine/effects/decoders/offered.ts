import type {
  CloudEvent,
  EffectOutcome,
  JsonValue,
} from "../../../api/index.js";
import type { ListenSource } from "../../../core/index.js";
import { InterpreterError, isCloudEvent } from "../../../runtime/index.js";
import { checkTaken, listenKinds } from "./kinds.js";

export function offeredEventOf(
  listen: ListenSource,
  outcome: EffectOutcome,
): CloudEvent {
  checkTaken(listenKinds, outcome, listen);

  const offered: JsonValue = outcome.event;
  checkCloudEvent(offered);
  return offered;
}

export function checkCloudEvent(
  offered: JsonValue,
): asserts offered is CloudEvent {
  const isEvent = isCloudEvent(offered);

  if (!isEvent) {
    const shown = JSON.stringify(offered);
    throw new InterpreterError(`An offered event is no CloudEvent: ${shown}.`);
  }
}
