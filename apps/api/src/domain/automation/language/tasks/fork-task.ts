import { EmptyCompetingForkError } from '../../../errors.js';
import type { Expression } from '../expression.js';
import type { ForkTaskProps, JsonValue } from '../interfaces.js';
import type { KindProgress } from '../progress/kind-progress.js';
import { ForkProgress } from '../progress/fork-progress.js';
import type { Step } from '../step.js';
import type { TaskScope } from '../scopes/task-scope.js';
import { Task } from './task.js';
import type { TaskList } from '../task-list.js';

export class ForkTask extends Task {
  readonly #branches: TaskList;
  readonly #compete: boolean;

  constructor(props: ForkTaskProps) {
    super(props);
    const compete = props.compete ?? false;
    const empty = props.branches.isEmpty();

    if (compete && empty)
      throw new EmptyCompetingForkError(props.branches.reference);

    for (const branch of props.branches.tasks)
      for (const directive of branch.directives) directive.confirmInBranch();

    this.#branches = props.branches;
    this.#compete = compete;
  }

  get branches(): TaskList {
    return this.#branches;
  }

  get compete(): boolean {
    return this.#compete;
  }

  override get children(): readonly TaskList[] {
    return [this.#branches];
  }

  enter(input: JsonValue, scope: TaskScope<ForkTask>): Step<KindProgress> {
    return ForkProgress.enter(input, scope);
  }

  protected override get ownExpressions(): readonly Expression[] {
    return this.#branches.expressions;
  }
}
