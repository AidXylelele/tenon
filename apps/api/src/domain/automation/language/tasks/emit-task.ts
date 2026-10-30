import type { Expression } from '../expression.js';
import type { EmitTaskProps } from '../interfaces.js';
import { Task } from '../task.js';
import type { Template } from '../template.js';

export class EmitTask extends Task {
  readonly #event: Template;

  constructor(props: EmitTaskProps) {
    super(props);
    this.#event = props.event;
  }

  get event(): Template {
    return this.#event;
  }

  protected override get ownExpressions(): readonly Expression[] {
    return this.#event.expressions;
  }
}
