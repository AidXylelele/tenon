import { MalformedEventError } from '../../../errors.js';
import { CloudEvent } from '../cloud-event.js';
import { ErrorType } from '../error-type.js';
import type { Expression } from '../expression.js';
import type { EmitTaskProps, JsonValue, ValueTask } from '../interfaces.js';
import type { KindProgress } from '../progress/kind-progress.js';
import { Outcome } from '../outcome.js';
import type { Step } from '../step.js';
import type { BodyScope } from '../scopes/body-scope.js';
import type { TaskScope } from '../scopes/task-scope.js';
import { ValueProgress } from '../progress/value-progress.js';
import { Task } from './task.js';
import type { Template } from '../template.js';

export class EmitTask extends Task implements ValueTask {
  static readonly #SPEC_VERSION = '1.0';
  static readonly #MALFORMED =
    'The event to emit is not a well-formed CloudEvent';

  readonly #event: Template;

  constructor(props: EmitTaskProps) {
    super(props);
    const declared = props.event.value;

    if (!CloudEvent.declares(declared))
      throw new MalformedEventError(props.event.pointer);

    this.#event = props.event;
  }

  get template(): Template {
    return this.#event;
  }

  enter(scope: BodyScope): Step<KindProgress> {
    return ValueProgress.enter(scope);
  }

  outcomeOf(value: JsonValue, scope: TaskScope): Outcome {
    const malformed = ErrorType.Runtime.errorAt(
      this.reference,
      EmitTask.#MALFORMED,
    );

    if (!CloudEvent.declares(value)) return Outcome.failed(malformed);

    const completed: Record<string, JsonValue | undefined> = {};

    for (const name of Object.keys(value)) completed[name] = value[name];

    completed.id ??= scope.id;
    completed.specversion ??= EmitTask.#SPEC_VERSION;
    completed.time ??= scope.now.toISOString();
    const event = CloudEvent.of(completed);

    if (event === null) return Outcome.failed(malformed);

    const json = event.toJson();
    return Outcome.emitting(json);
  }

  protected override get ownExpressions(): readonly Expression[] {
    return this.#event.expressions;
  }
}
