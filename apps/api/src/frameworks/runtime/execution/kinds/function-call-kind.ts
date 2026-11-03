import type { Specification } from '@openworkflowspec/sdk';
import type {
  JsonObject,
  JsonValue,
} from '../../../../domain/automation/json.js';
import { JsonPointer } from '../../document/json-pointer.js';
import {
  type CompositeKind,
  EndingKind,
  type ListEnding,
  type Runner,
} from '../endings.js';
import type { Evaluator } from '../evaluator.js';
import { Journal } from '../journal.js';
import type { Scope } from '../scope.js';

// A call of a function declared in `use.functions`: the function's task runs with the call's
// arguments (`with`) as its input, and its output is the call's.
export class FunctionCallKind implements CompositeKind {
  constructor(private readonly evaluator: Evaluator) {}

  async run(
    task: Specification.Task,
    input: JsonValue,
    args: JsonObject,
    scope: Scope,
    runner: Runner,
  ): Promise<ListEnding> {
    const call = task as Specification.CallFunction;
    const name = String(call.call);
    const functions = (scope.run.workflow.use?.functions ?? {}) as Record<
      string,
      Specification.Task
    >;
    const declared = functions[name] ?? {};
    const arguments_ = (call.with ?? null) as JsonValue;
    const filled = await Journal.value(scope, 'with', () =>
      this.evaluator.template(arguments_, input, args, scope.pointer),
    );

    if (!filled.ok)
      return {
        kind: EndingKind.Faulted,
        error: filled.error,
        retryAt: filled.retryAt,
      };

    const pointer = JsonPointer.ROOT.child('use')
      .child('functions')
      .child(name);
    const body = scope.elsewhere(pointer, name);
    const item = { name, task: declared };
    const ending = await runner.task(item, filled.value, body, null);

    if (ending.kind !== EndingKind.Completed) return ending;

    const ended = ending.then === 'end';
    return { kind: EndingKind.Completed, output: ending.output, ended };
  }
}
