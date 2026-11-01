import { DefaultVariable } from '../enums.js';
import type { Expression } from '../expression.js';
import type { ForTaskProps, JsonObject, JsonValue } from '../interfaces.js';
import type { KindProgress } from '../progress/kind-progress.js';
import { ForProgress } from '../progress/for-progress.js';
import type { Step } from '../step.js';
import type { TaskScope } from '../scopes/task-scope.js';
import { Task } from './task.js';
import type { TaskList } from '../task-list.js';

export class ForTask extends Task {
  readonly #each: string;
  readonly #at: string;
  readonly #collection: Expression;
  readonly #whilst: Expression | null;
  readonly #body: TaskList;

  constructor(props: ForTaskProps) {
    super(props);
    this.#each = props.each ?? DefaultVariable.Item;
    this.#at = props.at ?? DefaultVariable.Index;
    this.#collection = props.collection;
    this.#whilst = props.whilst;
    this.#body = props.body;
  }

  get each(): string {
    return this.#each;
  }

  get at(): string {
    return this.#at;
  }

  get collection(): Expression {
    return this.#collection;
  }

  get whilst(): Expression | null {
    return this.#whilst;
  }

  get body(): TaskList {
    return this.#body;
  }

  override get children(): readonly TaskList[] {
    return [this.#body];
  }

  enter(input: JsonValue, scope: TaskScope<ForTask>): Step<KindProgress> {
    return ForProgress.enter(input, scope);
  }

  variablesFor(item: JsonValue, index: number): JsonObject {
    const variables: Record<string, JsonValue> = {};
    variables[this.#each] = item;
    variables[this.#at] = index;
    return variables;
  }

  protected override get ownExpressions(): readonly Expression[] {
    const collection = this.#collection.expressions;
    const whilst = this.#whilst?.expressions ?? [];
    const body = this.#body.expressions;
    return collection.concat(whilst, body);
  }
}
