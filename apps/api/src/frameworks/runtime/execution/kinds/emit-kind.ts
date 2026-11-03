import { randomUUID } from 'node:crypto';
import type { Specification } from '@openworkflowspec/sdk';
import type {
  JsonObject,
  JsonValue,
} from '../../../../domain/automation/json.js';
import type { LeafKind, LeafResult } from '../endings.js';
import type { Evaluator } from '../evaluator.js';
import { ErrorKind, TaskFault } from '../faults.js';
import type { Scope } from '../scope.js';

// `emit`: the task's output is the CloudEvent it emits (CloudEvents 1.0); an id and a time the
// author leaves out are given. A source or type that is not text faults the task (FR-028).
export class EmitKind implements LeafKind {
  static readonly #SPEC_VERSION = '1.0';
  static readonly #LIFECYCLE = '/workflows/';

  constructor(private readonly evaluator: Evaluator) {}

  async run(
    task: Specification.Task,
    input: JsonValue,
    args: JsonObject,
    scope: Scope,
  ): Promise<LeafResult> {
    const emit = (task as Specification.EmitTask).emit;
    const declared = (emit?.event.with ?? {}) as JsonValue;
    const filled = (await this.evaluator.template(
      declared,
      input,
      args,
      scope.pointer,
    )) as JsonObject;
    const source = filled.source;
    const type = filled.type;

    if (typeof source !== 'string' || typeof type !== 'string')
      throw TaskFault.of(
        ErrorKind.Runtime,
        scope.pointer,
        'An event needs a source and a type that are text',
      );

    const event: Record<string, JsonValue> = {};
    Object.assign(event, filled);
    if (source.startsWith(EmitKind.#LIFECYCLE))
      throw TaskFault.of(
        ErrorKind.Runtime,
        scope.pointer,
        "The /workflows/ source is the platform's lifecycle events'",
      );

    event.specversion = EmitKind.#SPEC_VERSION;
    event.id ??= randomUUID();
    event.time ??= new Date().toISOString();
    const run = scope.run;
    await run.observer.emitted(run.plan.instanceId, event);
    return { output: event, then: null };
  }
}
