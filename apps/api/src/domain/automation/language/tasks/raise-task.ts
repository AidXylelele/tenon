import { ErrorType } from '../error-type.js';
import type { Expression } from '../expression.js';
import type { JsonValue, RaiseTaskProps, ValueTask } from '../interfaces.js';
import type { KindProgress } from '../progress/kind-progress.js';
import { Outcome } from '../outcome.js';
import type { Step } from '../step.js';
import type { TaskScope } from '../scopes/task-scope.js';
import { ValueProgress } from '../progress/value-progress.js';
import { Task } from './task.js';
import type { Template } from '../template.js';
import { WorkflowError } from '../workflow-error.js';

export class RaiseTask extends Task implements ValueTask {
  static readonly #NOT_AN_ERROR = 'The raised error has no type or status';

  readonly #error: Template;

  constructor(props: RaiseTaskProps) {
    super(props);
    this.#error = props.error;
  }

  get template(): Template {
    return this.#error;
  }

  enter(input: JsonValue, scope: TaskScope): Step<KindProgress> {
    return ValueProgress.enter(input, scope);
  }

  outcomeOf(value: JsonValue): Outcome {
    const error = this.#raised(value);
    return Outcome.failed(error);
  }

  protected override get ownExpressions(): readonly Expression[] {
    return this.#error.expressions;
  }

  #raised(value: JsonValue): WorkflowError {
    const object = typeof value === 'object' && value !== null;

    if (!object || Array.isArray(value))
      return ErrorType.Runtime.errorAt(this.reference, RaiseTask.#NOT_AN_ERROR);

    const type = value.type;
    const status = value.status;

    if (typeof type !== 'string' || typeof status !== 'number')
      return ErrorType.Runtime.errorAt(this.reference, RaiseTask.#NOT_AN_ERROR);

    const reference = this.reference.toString();
    const instance = this.#textOf(value.instance) ?? reference;
    const title = this.#textOf(value.title);
    const detail = this.#textOf(value.detail);
    return new WorkflowError({ type, status, instance, title, detail });
  }

  #textOf(value: JsonValue | undefined): string | null {
    if (typeof value !== 'string') return null;

    return value;
  }
}
