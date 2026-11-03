import type { Specification } from '@openworkflowspec/sdk';
import { TaskKind } from '../enums.js';

// The kind of a task is the one property only that kind has; `for` and `try` also hold a task
// list, so they are recognised before `do`.
export class TaskKinds {
  static readonly #ORDER: readonly TaskKind[] = [
    TaskKind.For,
    TaskKind.Try,
    TaskKind.Call,
    TaskKind.Fork,
    TaskKind.Emit,
    TaskKind.Listen,
    TaskKind.Raise,
    TaskKind.Run,
    TaskKind.Set,
    TaskKind.Switch,
    TaskKind.Wait,
    TaskKind.Do,
  ];

  static of(task: Specification.Task): TaskKind | null {
    for (const kind of TaskKinds.#ORDER) {
      const declared = Object.hasOwn(task, kind);

      if (declared) return kind;
    }

    return null;
  }
}
