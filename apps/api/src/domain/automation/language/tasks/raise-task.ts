import type { Expression } from '../expression.js';
import type { RaiseTaskProps } from '../interfaces.js';
import { Task } from '../task.js';
import type { Template } from '../template.js';

export class RaiseTask extends Task {
  readonly #error: Template;

  constructor(props: RaiseTaskProps) {
    super(props);
    this.#error = props.error;
  }

  get error(): Template {
    return this.#error;
  }

  protected override get ownExpressions(): readonly Expression[] {
    return this.#error.expressions;
  }
}
