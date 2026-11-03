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
import { Race } from '../race.js';
import type { ContextHolder, Scope } from '../scope.js';

// `fork`: its branches run concurrently on the same input and its output is theirs, in branch
// order. Each branch keeps its own context until the fork ends; their contexts then apply in
// branch order, so that a replay, whose steps end in another order, ends with the same one.
// Competing branches race: the first to complete wins, the others stop at their next task,
// and the winner's output and context alone are kept.
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

    if (fork?.compete === true)
      return this.#compete(branches, input, scope, runner);

    const holders: ContextHolder[] = [];
    const placed = scope.child('fork').child('branches');
    const runs = branches.map((entry, index) => {
      const item = ForkKind.#itemOf(entry);
      const holder = { context: scope.context };
      holders.push(holder);
      const branch = placed.child(index).child(item.name).holding(holder);
      return runner.task(item, input, branch, null);
    });
    const endings = await Promise.all(runs);
    ForkKind.#keep(scope, holders);

    if (scope.run.stopped) return { kind: EndingKind.Stopped };

    return ForkKind.#joined(endings);
  }

  async #compete(
    branches: Specification.TaskList,
    input: JsonValue,
    scope: Scope,
    runner: Runner,
  ): Promise<ListEnding> {
    const race = new Race();
    const holders: ContextHolder[] = [];
    const placed = scope.child('fork').child('branches');
    const runs = branches.map(async (entry, index) => {
      const item = ForkKind.#itemOf(entry);
      const holder = { context: scope.context };
      holders.push(holder);
      const branch = placed
        .child(index)
        .child(item.name)
        .holding(holder)
        .racing(race);
      const ending = await runner.task(item, input, branch, null);

      if (ending.kind === EndingKind.Completed) race.completed(scope, index);

      return ending;
    });
    const endings = await Promise.all(runs);

    if (scope.run.stopped) return { kind: EndingKind.Stopped };

    const winner = race.winner;

    if (winner !== null) {
      const index = await winner;
      const ending = endings[index];
      const holder = holders[index];

      if (ending?.kind === EndingKind.Completed && holder !== undefined) {
        ForkKind.#keep(scope, [holder]);
        return {
          kind: EndingKind.Completed,
          output: ending.output,
          ended: false,
        };
      }
    }

    return ForkKind.#lost(endings, input);
  }

  // No branch completed: the fork faults with the last fault in branch order.
  static #lost(endings: readonly TaskEnding[], input: JsonValue): ListEnding {
    const last = endings.at(-1);

    if (last === undefined)
      return { kind: EndingKind.Completed, output: input, ended: false };

    if (last.kind === EndingKind.Completed)
      return { kind: EndingKind.Completed, output: last.output, ended: false };

    return last;
  }

  // The branches' contexts, applied in branch order: the last one that exported is kept.
  static #keep(scope: Scope, holders: readonly ContextHolder[]): void {
    const initial = scope.context;

    for (const holder of holders) {
      if (holder.context !== initial) scope.replaceContext(holder.context);
    }
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
