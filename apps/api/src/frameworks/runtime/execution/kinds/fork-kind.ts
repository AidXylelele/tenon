import type { Specification } from '@openworkflowspec/sdk';
import type {
  JsonObject,
  JsonValue,
} from '../../../../domain/automation/json.js';
import {
  type CompositeKind,
  EndingKind,
  type ListEnding,
  type Runner,
  type TaskEnding,
  type TaskItem,
} from '../endings.js';
import type { Scope } from '../scope.js';

// `fork`: its branches run concurrently on the same input and its output is theirs, in branch
// order. Competing branches give the output of the first branch to complete; they are tried in
// branch order, so that the journal replays the same winner.
export class ForkKind implements CompositeKind {
  async run(
    task: Specification.Task,
    input: JsonValue,
    _args: JsonObject,
    scope: Scope,
    runner: Runner,
  ): Promise<ListEnding> {
    const fork = (task as Specification.ForkTask).fork;
    const branches = fork?.branches ?? [];
    const placed = scope.child('fork').child('branches');

    if (fork?.compete === true)
      return this.#compete(branches, input, placed, runner);

    const runs = branches.map((entry, index) => {
      const item = ForkKind.#itemOf(entry);
      const branch = placed.child(index).child(item.name);
      return runner.task(item, input, branch, null);
    });
    const endings = await Promise.all(runs);
    return ForkKind.#joined(endings);
  }

  async #compete(
    branches: Specification.TaskList,
    input: JsonValue,
    placed: Scope,
    runner: Runner,
  ): Promise<ListEnding> {
    let last: TaskEnding | null = null;

    for (const [index, entry] of branches.entries()) {
      const item = ForkKind.#itemOf(entry);
      const branch = placed.child(index).child(item.name);
      const ending = await runner.task(item, input, branch, null);

      if (ending.kind === EndingKind.Completed)
        return {
          kind: EndingKind.Completed,
          output: ending.output,
          ended: false,
        };

      if (ending.kind === EndingKind.Stopped) return ending;

      last = ending;
    }

    if (last === null)
      return { kind: EndingKind.Completed, output: input, ended: false };

    return last;
  }

  static #joined(endings: readonly TaskEnding[]): ListEnding {
    const outputs: JsonValue[] = [];

    for (const ending of endings) {
      if (ending.kind !== EndingKind.Completed) return ending;

      outputs.push(ending.output);
    }

    return { kind: EndingKind.Completed, output: outputs, ended: false };
  }

  static #itemOf(entry: Specification.TaskItem): TaskItem {
    const [found] = Object.entries(entry);

    if (found === undefined) throw new TypeError('A branch names no task');

    const [name, task] = found;
    return { name, task };
  }
}
