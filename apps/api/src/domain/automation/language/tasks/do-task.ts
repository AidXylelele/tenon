import type { Expression } from '../expression.js';
import type { DoTaskProps } from '../interfaces.js';
import { Task } from '../task.js';
import type { TaskList } from '../task-list.js';

export class DoTask extends Task {
  readonly #body: TaskList;

  constructor(props: DoTaskProps) {
    super(props);
    this.#body = props.body;
  }

  get body(): TaskList {
    return this.#body;
  }

  override get children(): readonly TaskList[] {
    return [this.#body];
  }

  protected override get ownExpressions(): readonly Expression[] {
    return this.#body.expressions;
  }
}
