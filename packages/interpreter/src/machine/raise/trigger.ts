import type { JsonObject } from "../../api/index.js";
import { placedAt, rootPointer } from "../../runtime/index.js";
import type { TriggerK } from "../frames/index.js";
import {
  type Transition,
  faultedWith,
  finishing,
  freed,
  transitionOf,
} from "../transitions/index.js";

export function raiseAtTrigger(frame: TriggerK, error: JsonObject): Transition {
  const placed = placedAt(error, rootPointer);
  const release = freed(frame.activation);
  const writes = [release];
  const result = faultedWith(placed);
  const next = finishing(result);

  return transitionOf(next, [], writes);
}
