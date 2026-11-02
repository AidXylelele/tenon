import {
  InconsistentProgressError,
  ReservedVariableError,
} from '../../../errors.js';
import { DefaultVariable, RuntimeArgument } from '../enums.js';
import type { Expression } from '../expression.js';
import type { ForIteration } from '../for-iteration.js';
import type { ForTaskProps, JsonObject, JsonValue } from '../interfaces.js';
import type { JsonPointer } from '../json-pointer.js';
import type { KindProgress } from '../progress/kind-progress.js';
import { ForCollectingProgress } from '../progress/for-collecting-progress.js';
import type { Step } from '../step.js';
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
    const each = props.each ?? DefaultVariable.Item;
    const at = props.at ?? DefaultVariable.Index;
    const loopAt = props.reference.at('for');
    ForTask.#confirmVariable(each, loopAt.at('each'));
    ForTask.#confirmVariable(at, loopAt.at('at'));
    this.#each = each;
    this.#at = at;
    this.#collection = props.collection;
    this.#whilst = props.whilst;
    this.#body = props.body;
  }

  static #confirmVariable(name: string, at: JsonPointer): void {
    const reserved: readonly string[] = Object.values(RuntimeArgument);

    if (reserved.includes(name)) throw new ReservedVariableError(name, at);
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
    variables[this.#each] = iteration.item;
    variables[this.#at] = iteration.index;
    return variables;
  }

  protected override get ownExpressions(): readonly Expression[] {
    const collection = this.#collection.expressions;
    const whilst = this.#whilst?.expressions ?? [];
    const body = this.#body.expressions;
    return collection.concat(whilst, body);
  }
}
