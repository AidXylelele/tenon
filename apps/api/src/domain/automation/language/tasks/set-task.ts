import type { Expression } from '../expression.js';
import type { JsonValue, SetTaskProps, ValueTask } from '../interfaces.js';
import type { KindProgress } from '../progress/kind-progress.js';
import { Outcome } from '../outcome.js';
import type { Step } from '../step.js';
import type { TaskScope } from '../scopes/task-scope.js';
import { ValueProgress } from '../progress/value-progress.js';
import { Task } from './task.js';
import type { Template } from '../template.js';

export class SetTask extends Task implements ValueTask {
  readonly #value: Expression | Template;

  constructor(props: SetTaskProps) {
    super(props);
    this.#value = props.value;
  }

  get template(): Expression | Template {
    return this.#value;
  }

  enter(input: JsonValue, scope: TaskScope): Step<KindProgress> {
    return ValueProgress.enter(input, scope);
  }

  outcomeOf(value: JsonValue): Outcome {
    return Outcome.of(value);
  }

  protected override get ownExpressions(): readonly Expression[] {
    return this.#value.expressions;
  }
}
