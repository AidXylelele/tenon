import { type Completion, listStepOf } from "../completions/index.js";
import { type ListPosition, taskEnteredOf } from "../evaluate/index.js";
import type { TaskListK } from "../frames/index.js";
import type { Here } from "../registers/index.js";
import {
  type Transition,
  returning,
  transitionOf,
} from "../transitions/index.js";

export function returnToTaskList(
  frame: TaskListK,
  completion: Completion,
): Transition {
  const step = listStepOf(completion, frame.index);

  switch (step.kind) {
    case "next": {
      const position: ListPosition = {
        list: frame.list,
        index: step.index,
        visits: frame.visits,
      };
      const here: Here = { scope: frame.scope, value: completion.value };
      return taskEnteredOf(position, here);
    }
    case "out": {
      const next = returning(step.completion);
      return transitionOf(next, [], []);
    }
  }
}
