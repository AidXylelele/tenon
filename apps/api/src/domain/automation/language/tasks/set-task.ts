import type { Expression } from '../expression.js';
import type { JsonValue, SetTaskProps } from '../interfaces.js';
import { Outcome } from '../outcome.js';
import { ValueTask } from './value-task.js';
import type { Template } from '../template.js';

export class SetTask extends ValueTask {
  readonly #value: Expression | Template;

  constructor(props: SetTaskProps) {
    super(props);
    this.#value = props.value;
  }

  get template(): Expression | Template {
    return this.#value;
  }

  protected outcomeOf(value: JsonValue): Outcome {
    return Outcome.of(value);
  }
}
