import { InconsistentProgressError } from '../../../errors.js';
import { DefaultVariable } from '../enums.js';
import type { Expression } from '../expression.js';
import type { ForIteration } from '../for-iteration.js';
import type { ForTaskProps, JsonObject, JsonValue } from '../interfaces.js';
import type { KindProgress } from '../progress/kind-progress.js';
import { ForCollectingProgress } from '../progress/for-collecting-progress.js';
import type { Step } from '../step.js';
import { Task } from './task.js';
import { VariableName } from '../variable-name.js';
import type { TaskList } from '../task-list.js';

export class ForTask extends Task {
  readonly #each: VariableName;
  readonly #at: VariableName;
  readonly #collection: Expression;
  readonly #whilst: Expression | null;
  readonly #body: TaskList;

  constructor(props: ForTaskProps) {
    super(props);
    const each = props.each ?? DefaultVariable.Item;
    const at = props.at ?? DefaultVariable.Index;
    const loopAt = props.reference.at('for');
    const eachAt = loopAt.at('each');
    const atAt = loopAt.at('at');
    this.#each = new VariableName(each, eachAt);
    this.#at = new VariableName(at, atAt);
    this.#collection = props.collection;
    this.#whilst = props.whilst;
    this.#body = props.body;
  }

  get each(): VariableName {
    return this.#each;
  }

  get at(): VariableName {
    return this.#at;
  }

  get collection(): Expression {
    return this.#collection;
  }

  isGuarded(): boolean {
    return this.#whilst !== null;
  }

  // The `while` condition, which only a guarded loop checks.
  get whilst(): Expression {
    if (this.#whilst === null)
      throw new InconsistentProgressError('a for without while checks nothing');

    return this.#whilst;
  }

  get body(): TaskList {
    return this.#body;
  }

  override get children(): readonly TaskList[] {
    return [this.#body];
  }

  enter(): Step<KindProgress> {
    return ForCollectingProgress.enter();
  }

  variablesFor(iteration: ForIteration): JsonObject {
    const variables: Record<string, JsonValue> = {};
    variables[this.#each.name] = iteration.item;
    variables[this.#at.name] = iteration.index;
    return variables;
  }

  protected override get ownExpressions(): readonly Expression[] {
    const collection = this.#collection.expressions;
    const whilst = this.#whilst?.expressions ?? [];
    const body = this.#body.expressions;
    return collection.concat(whilst, body);
  }
}
