import type { Raise } from "../../core/index.js";
import { Raised } from "../../runtime/index.js";
import type { Here } from "../registers/index.js";
import {
  type Transition,
  raising,
  transitionOf,
} from "../transitions/index.js";
import { directReader, templateValueOf } from "../values/index.js";
import type { View } from "../view.js";

export function evaluateRaise(term: Raise, here: Here, view: View): Transition {
  const reader = directReader(here, view);
  const error = templateValueOf(term.error, here.value, reader);
  const written = Raised.written(error);
  const next = raising(written.error);

  return transitionOf(next, [], []);
}
