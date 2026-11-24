import type { JsonObject } from "../../api/index.js";
import {
  type Transition,
  raising,
  transitionOf,
} from "../transitions/index.js";

export function passedOn(error: JsonObject): Transition {
  const next = raising(error);

  return transitionOf(next, [], []);
}
