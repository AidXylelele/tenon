import type { Expression } from '../expression.js';
import type { SetTaskProps } from '../interfaces.js';
import { Task } from '../task.js';
import type { Template } from '../template.js';

export class SetTask extends Task {
  readonly #value: Expression | Template;

  constructor(props: SetTaskProps) {
    super(props);
    this.#value = props.value;
  }

  get value(): Expression | Template {
    return this.#value;
  }

  protected override get ownExpressions(): readonly Expression[] {
    return this.#value.expressions;
  }
}
