import type { StatusPhase } from "../../standard/index.js";
import type { StreamFrame } from "../frames/index.js";
import { phaseChangedOf } from "../lifecycle/index.js";
import type { Write } from "../transitions/index.js";
import type { View } from "../view.js";

export function taskPhaseOf(
  frame: StreamFrame,
  phase: StatusPhase,
  view: View,
): readonly Write[] {
  const isTrigger = view.statics.triggers.has(frame.stream);

  if (isTrigger) {
    return [];
  }

  return phaseChangedOf(frame.scope.activation, phase, view);
}
