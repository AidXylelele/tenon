import type { JsonArray, JsonValue } from "../../api/index.js";
import type { Loop } from "../../core/index.js";
import { normalOf } from "../completions/index.js";
import { loopK } from "../frames/index.js";
import { iterationPathOf } from "../identity/index.js";
import { type BoundValues, type Here, scopeOf } from "../registers/index.js";
import {
  type Transition,
  evaluating,
  returning,
  transitionOf,
} from "../transitions/index.js";
import {
  directReader,
  holds,
  itemsOf,
  templateValueOf,
} from "../values/index.js";
import type { View } from "../view.js";

export interface LoopPosition {
  readonly loop: Loop;
  readonly items: JsonArray;
  readonly index: number;
}

export function evaluateLoop(term: Loop, here: Here, view: View): Transition {
  const reader = directReader(here, view);
  const collection = templateValueOf(term.items, here.value, reader);
  const items = itemsOf(collection);
  const start: LoopPosition = { loop: term, items, index: 0 };

  return iterationOf(start, here, view);
}

export function iterationOf(
  position: LoopPosition,
  here: Here,
  view: View,
): Transition {
  const index = position.index;
  const item = position.items[index];

  if (item === undefined) {
    return loopCompletedOf(here);
  }

  const iterating = iterationHereOf(position, item, here);
  const isIterated = holds(position.loop.conditions, iterating, view);

  if (!isIterated) {
    return loopCompletedOf(here);
  }

  const loop = position.loop;
  const items = position.items;
  const frame = loopK({ loop, items, index, scope: here.scope });
  const frames = [frame];
  const next = evaluating(loop.body, iterating);
  return transitionOf(next, frames, []);
}

function iterationHereOf(
  position: LoopPosition,
  item: JsonValue,
  here: Here,
): Here {
  const index = position.index;
  const bound: BoundValues = { item, index };
  const binders = position.loop.binders;
  const environment = here.scope.environment.bound(binders, bound);
  const path = iterationPathOf(here.scope.path, index);
  const scope = scopeOf(environment, here.scope.activation, path);

  return { scope, value: here.value };
}

function loopCompletedOf(here: Here): Transition {
  const done = normalOf(here.value);
  const next = returning(done);

  return transitionOf(next, [], []);
}
