import type { CatchClause } from '../catch-clause.js';
import type { Expression } from '../expression.js';
import type { JsonValue, TryTaskProps } from '../interfaces.js';
import type { KindProgress } from '../progress/kind-progress.js';
import { TryProgress } from '../progress/try-progress.js';
import type { Step } from '../step.js';
import type { TaskScope } from '../scopes/task-scope.js';
import { Task } from './task.js';
import type { TaskList } from '../task-list.js';

export class TryTask extends Task {
  readonly #body: TaskList;
  readonly #catchClause: CatchClause;

  constructor(props: TryTaskProps) {
    super(props);
    this.#body = props.body;
    this.#catchClause = props.catchClause;
  }

  get body(): TaskList {
    return this.#body;
  }

  get catchClause(): CatchClause {
    return this.#catchClause;
  }

  override get children(): readonly TaskList[] {
    const handler = this.#catchClause.handler;

    if (handler === null) return [this.#body];

    return [this.#body, handler];
  }

  enter(input: JsonValue, scope: TaskScope<TryTask>): Step<KindProgress> {
    return TryProgress.enter(input, scope);
  }

  protected override get ownExpressions(): readonly Expression[] {
    const body = this.#body.expressions;
    const caught = this.#catchClause.expressions;
    return body.concat(caught);
  }
}
