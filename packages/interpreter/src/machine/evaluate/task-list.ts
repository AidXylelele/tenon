import type { TaskList } from "../../core/index.js";
import { InterpreterError } from "../../runtime/index.js";
import { normalOf } from "../completions/index.js";
import { taskListK } from "../frames/index.js";
import { taskPathOf } from "../identity/index.js";
import { type Here, withPath } from "../registers/index.js";
import {
  type Transition,
  evaluating,
  returning,
  transitionOf,
} from "../transitions/index.js";

export interface ListPosition {
  readonly list: TaskList;
  readonly index: number;
  readonly visits: readonly number[];
}

export function evaluateTaskList(term: TaskList, here: Here): Transition {
  const count = term.tasks.length;
  const visits = new Array<number>(count).fill(0);
  const start: ListPosition = { list: term, index: 0, visits };

  return taskEnteredOf(start, here);
}

export function taskEnteredOf(position: ListPosition, here: Here): Transition {
  const index = position.index;
  const task = position.list.tasks[index];

  if (task === undefined) {
    const done = normalOf(here.value);
    const next = returning(done);
    return transitionOf(next, [], []);
  }

  const visit = visitsAt(position.visits, index) + 1;
  const visits = position.visits.with(index, visit);
  const path = taskPathOf(here.scope.path, task.descriptor.reference, visit);
  const scope = withPath(here.scope, path);
  const entered: Here = { scope, value: here.value };
  const frame = taskListK({
    list: position.list,
    index,
    visits,
    scope: here.scope,
  });
  const frames = [frame];
  const next = evaluating(task, entered);

  return transitionOf(next, frames, []);
}

function visitsAt(visits: readonly number[], index: number): number {
  const count = visits[index];

  if (count === undefined) {
    throw new InterpreterError(
      `A task list counts no visits of its task ${String(index)}.`,
    );
  }

  return count;
}
