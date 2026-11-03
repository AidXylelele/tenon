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
} from '../endings.js';
import type { Evaluator } from '../evaluator.js';
import { ErrorKind, TaskFault } from '../faults.js';
import { Journal } from '../journal.js';
import type { Scope } from '../scope.js';

// `for`: the body once per item of `in`, with the item and its index bound (`each`, `at`);
// each iteration takes the previous one's output, and `while` must hold for it to begin.
export class ForKind implements CompositeKind {
  constructor(private readonly evaluator: Evaluator) {}

  async run(
    task: Specification.Task,
    input: JsonValue,
    args: JsonObject,
    scope: Scope,
    runner: Runner,
  ): Promise<ListEnding> {
    const loop = task as Specification.ForTask;
    const each = loop.for?.each ?? 'item';
    const at = loop.for?.at ?? 'index';
    const collection = loop.for?.in ?? '';
    const items = await Journal.value(scope, 'in', async () => {
      const value = await this.evaluator.expression(
        collection,
        input,
        args,
        scope.pointer,
      );

      if (!Array.isArray(value))
        throw TaskFault.of(
          ErrorKind.Expression,
          scope.pointer,
          'for.in must give an array',
        );

      return value;
    });

    if (!items.ok) return { kind: EndingKind.Faulted, error: items.error };

    const body = loop.do ?? [];
    let data = input;

    for (const [index, item] of items.value.entries()) {
      const variables = { [each]: item, [at]: index };
      const iteration = scope.again(`[${String(index)}]`).binding(variables);
      const proceeds = await this.#proceeds(
        loop,
        data,
        args,
        variables,
        iteration,
      );

      if (!proceeds.ok)
        return { kind: EndingKind.Faulted, error: proceeds.error };

      if (!proceeds.value) break;

      const ending = await runner.list(body, data, iteration.child('do'));

      if (ending.kind !== EndingKind.Completed || ending.ended) return ending;

      data = ending.output;
    }

    return { kind: EndingKind.Completed, output: data, ended: false };
  }

  async #proceeds(
    loop: Specification.ForTask,
    data: JsonValue,
    args: JsonObject,
    variables: JsonObject,
    iteration: Scope,
  ) {
    const condition = loop.while;

    if (condition === undefined) return { ok: true as const, value: true };

    const bound: Record<string, JsonValue> = {};
    Object.assign(bound, args, variables);
    return Journal.value(iteration, 'while', () =>
      this.evaluator.condition(condition, data, bound, iteration.pointer),
    );
  }
}
