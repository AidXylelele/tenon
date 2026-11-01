import { IncompleteEventError } from '../../../errors.js';
import { ErrorType } from '../error-type.js';
import type { Expression } from '../expression.js';
import type {
  EmitTaskProps,
  JsonObject,
  JsonValue,
  ValueTask,
} from '../interfaces.js';
import type { KindProgress } from '../progress/kind-progress.js';
import { Outcome } from '../outcome.js';
import type { Step } from '../step.js';
import type { TaskScope } from '../scopes/task-scope.js';
import { ValueProgress } from '../progress/value-progress.js';
import { Task } from './task.js';
import type { Template } from '../template.js';

export class EmitTask extends Task implements ValueTask {
  static readonly #SPEC_VERSION = '1.0';
  static readonly #INCOMPLETE = 'The event to emit has no source or type';

  readonly #event: Template;

  constructor(props: EmitTaskProps) {
    super(props);
    const identified = EmitTask.#identified(props.event.value);

    if (!identified) throw new IncompleteEventError(props.event.pointer);

    this.#event = props.event;
  }

  get template(): Template {
    return this.#event;
  }

  enter(input: JsonValue, scope: TaskScope): Step<KindProgress> {
    return ValueProgress.enter(input, scope);
  }

  outcomeOf(value: JsonValue, scope: TaskScope): Outcome {
    const identified = EmitTask.#identified(value);

    if (!identified) {
      const incomplete = ErrorType.Runtime.errorAt(
        this.reference,
        EmitTask.#INCOMPLETE,
      );
      return Outcome.failed(incomplete);
    }

    const event: Record<string, JsonValue | undefined> = {};

    for (const name of Object.keys(value)) event[name] = value[name];

    event.id ??= scope.id;
    event.specversion ??= EmitTask.#SPEC_VERSION;
    event.time ??= scope.now.toISOString();
    return Outcome.emitting(event);
  }

  protected override get ownExpressions(): readonly Expression[] {
    return this.#event.expressions;
  }

  static #identified(event: JsonValue): event is JsonObject {
    const object = typeof event === 'object' && event !== null;

    if (!object || Array.isArray(event)) return false;

    return typeof event.source === 'string' && typeof event.type === 'string';
  }
}
