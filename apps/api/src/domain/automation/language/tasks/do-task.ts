import type { Expression } from '../expression.js';
import type { DoTaskProps, JsonValue } from '../interfaces.js';
import type { KindProgress } from '../progress/kind-progress.js';
import { DoProgress } from '../progress/do-progress.js';
import type { Step } from '../step.js';
import type { TaskScope } from '../scopes/task-scope.js';
import { Task } from './task.js';
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

  enter(input: JsonValue, scope: TaskScope<DoTask>): Step<KindProgress> {
    return DoProgress.enter(input, scope);
  }

  protected override get ownExpressions(): readonly Expression[] {
    return this.#body.expressions;
  }
}
