import type { JsonValue } from "../../api/index.js";
import type { ActivationTarget, Let, SlotTarget } from "../../core/index.js";
import { inputTakenOf } from "../lifecycle/index.js";
import {
  type Activation,
  type Here,
  withEnvironment,
  withInput,
  withOutput,
} from "../registers/index.js";
import {
  type Transition,
  type Write,
  evaluating,
  transitionOf,
  updated,
} from "../transitions/index.js";
import type { View } from "../view.js";

export function evaluateLet(term: Let, here: Here, view: View): Transition {
  const target = term.target;

  switch (target.kind) {
    case "slot": {
      const bound = boundOf(here);
      const writes = slotReportsOf(target, here, view);
      const next = evaluating(term.body, bound);
      return transitionOf(next, [], writes);
    }
    case "activation": {
      const writes = cellWrittenOf(target, here, view);
      const next = evaluating(term.body, here);
      return transitionOf(next, [], writes);
    }
  }
}

function boundOf(here: Here): Here {
  const slots = [here.value];
  const environment = here.scope.environment.extended(slots);
  const scope = withEnvironment(here.scope, environment);

  return { scope, value: here.value };
}

function slotReportsOf(
  target: SlotTarget,
  here: Here,
  view: View,
): readonly Write[] {
  switch (target.argument) {
    case "input": {
      const input = inputTakenOf(here.scope.activation, here.value, view);
      return [input];
    }
    case "output":
      return [];
  }
}

function cellWrittenOf(
  target: ActivationTarget,
  here: Here,
  view: View,
): readonly Write[] {
  const address = here.scope.activation;
  const cell = view.store.cellAt(address);
  const written = fieldWrittenOf(cell, target, here.value);
  const update = updated(address, written);

  return [update];
}

function fieldWrittenOf(
  cell: Activation,
  target: ActivationTarget,
  value: JsonValue,
): Activation {
  switch (target.field) {
    case "input":
      return withInput(cell, value);
    case "output":
      return withOutput(cell, value);
  }
}
