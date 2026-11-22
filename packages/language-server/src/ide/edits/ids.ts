import { childPointerOf } from "../pointers/index.js";
import { type StepNode, type StepNodeList, stepIdOf } from "../steps/index.js";
import type { IdChange, Placed } from "./interfaces.js";

export function placedStepOf(
  list: Placed,
  name: string,
  earlier: readonly string[],
): Placed {
  const index = String(earlier.length);
  const item = childPointerOf(list.pointer, index);
  const pointer = childPointerOf(item, name);
  const named = { pointer, name };
  const id = stepIdOf(list.id, named, earlier);

  return { id, pointer };
}

export function idChangesOf(
  step: StepNode,
  placed: Placed,
): readonly IdChange[] {
  const changes = subtreeIdsOf(step, placed);

  return changes.filter((change) => change.from !== change.to);
}

function subtreeIdsOf(step: StepNode, placed: Placed): readonly IdChange[] {
  const own = { from: step.id, to: placed.id };
  const below = step.lists.flatMap((list) => {
    const relative = list.pointer.slice(step.pointer.length);
    const placedList = {
      id: placed.id + relative,
      pointer: placed.pointer + relative,
    };
    return listIdsOf(list, placedList);
  });

  return [own, ...below];
}

function listIdsOf(list: StepNodeList, placed: Placed): readonly IdChange[] {
  const own = { from: list.id, to: placed.id };
  const names = list.steps.map((step) => step.name);
  const below = list.steps.flatMap((step) => {
    const earlier = names.slice(0, step.index);
    const placedStep = placedStepOf(placed, step.name, earlier);
    return subtreeIdsOf(step, placedStep);
  });

  return [own, ...below];
}
