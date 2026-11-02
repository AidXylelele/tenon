import { ErrorType } from '../error-type.js';
import type { JsonValue, RaiseTaskProps } from '../interfaces.js';
import { Outcome } from '../outcome.js';
import { ValueTask } from './value-task.js';
import type { Template } from '../template.js';
import { WorkflowError } from '../workflow-error.js';

export class RaiseTask extends ValueTask {
  static readonly #NOT_AN_ERROR = 'The raised error has no type or status';

  readonly #error: Template;

  constructor(props: RaiseTaskProps) {
    super(props);
    this.#error = props.error;
  }

  get template(): Template {
    return this.#error;
  }

  protected outcomeOf(value: JsonValue): Outcome {
    const error = this.#raised(value);
    return Outcome.failed(error);
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
