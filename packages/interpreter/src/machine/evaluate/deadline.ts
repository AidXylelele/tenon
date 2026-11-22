import type { Deadline } from "../../core/index.js";
import type { Here } from "../registers/index.js";
import { limitEntryOf } from "../time/index.js";
import {
  type Transition,
  evaluating,
  raising,
  transitionOf,
} from "../transitions/index.js";
import { instantOf } from "../values/index.js";
import type { View } from "../view.js";

export function evaluateDeadline(
  term: Deadline,
  here: Here,
  view: View,
): Transition {
  const instant = instantOf(term.duration, here, view);
  const entry = limitEntryOf(instant, view.context.now);

  switch (entry.kind) {
    case "passed": {
      const next = raising(entry.timeout);
      return transitionOf(next, [], []);
    }
    case "running": {
      const frames = [entry.frame];
      const next = evaluating(term.body, here);
      return transitionOf(next, frames, []);
    }
  }
}
