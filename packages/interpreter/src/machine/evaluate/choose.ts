import type { Choose } from "../../core/index.js";
import { completionOf, normalOf, signalOf } from "../completions/index.js";
import type { Here } from "../registers/index.js";
import {
  type Transition,
  returning,
  transitionOf,
} from "../transitions/index.js";
import { holds } from "../values/index.js";
import type { View } from "../view.js";

export function evaluateChoose(
  term: Choose,
  here: Here,
  view: View,
): Transition {
  const chosen = term.cases.find((each) => holds(each.conditions, here, view));

  if (chosen === undefined) {
    const passed = normalOf(here.value);
    const next = returning(passed);
    return transitionOf(next, [], []);
  }

  const signal = signalOf(chosen.then);
  const directed = completionOf(here.value, signal);
  const next = returning(directed);
  return transitionOf(next, [], []);
}
