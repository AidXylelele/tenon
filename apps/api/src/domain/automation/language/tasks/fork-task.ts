import { EmptyCompetingForkError } from '../../../errors.js';
import type { Expression } from '../expression.js';
import type { ForkTaskProps } from '../interfaces.js';
import { Task } from '../task.js';
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

  protected override get ownExpressions(): readonly Expression[] {
    return this.#branches.expressions;
  }
}
