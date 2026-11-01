import { InconsistentProgressError } from '../../../errors.js';
import { ErrorType } from '../error-type.js';
import type { ForProgressProps, JsonObject, JsonValue } from '../interfaces.js';
import type { JsonPointer } from '../json-pointer.js';
import { Outcome } from '../outcome.js';
import type { RoundResults } from '../round-results.js';
import { RoundWork } from '../round-work.js';
import type { TaskScope } from '../scopes/task-scope.js';
import { Sequence } from '../sequence.js';
import { Step } from '../step.js';
import type { TaskEnding } from '../task-ending.js';
import type { ForTask } from '../tasks/for-task.js';
import { ConcludedProgress } from './concluded-progress.js';
import { KindProgress } from './kind-progress.js';

export class ForProgress extends KindProgress {
  static readonly #WHILE = 'while';
  static readonly #NOT_A_COLLECTION = 'The for collection is not an array';

  readonly #input: JsonValue;
  readonly #items: readonly JsonValue[] | null;
  readonly #index: number;
  readonly #data: JsonValue;
  readonly #sequence: Sequence | null;

  constructor(props: ForProgressProps) {
    super();
    const iteratingBlind = props.sequence !== null && props.items === null;

    if (iteratingBlind)
      throw new InconsistentProgressError(
        'a for iterates only over collected items',
      );

    this.#input = props.input;
    this.#items = props.items;
    this.#index = props.index;
    this.#data = props.data;
    this.#sequence = props.sequence;
  }

  static enter(input: JsonValue, scope: TaskScope): Step<KindProgress> {
    const progress = new ForProgress({
      input,
      items: null,
      index: 0,
      data: input,
      sequence: null,
    });
    return progress.settled(scope);
  }

  get input(): JsonValue {
    return this.#input;
  }

  get items(): readonly JsonValue[] | null {
    return this.#items;
  }

  get index(): number {
    return this.#index;
  }

  get data(): JsonValue {
    return this.#data;
  }

  get sequence(): Sequence | null {
    return this.#sequence;
  }

  work(scope: TaskScope<ForTask>): RoundWork {
    if (this.#sequence !== null) return RoundWork.none();

    const task = scope.task;

    if (this.#items === null) {
      const args = scope.definitionArguments(this.#input);
      const evaluations = task.collection.evaluationsFor(
        scope.prefix,
        this.#input,
        args,
      );
      return RoundWork.evaluating(evaluations);
    }

    const whilst = task.whilst;

    if (whilst === null) return RoundWork.none();

    const args = this.#iterationArguments(this.#items, scope);
    const prefix = this.#whilePrefix(scope);
    const evaluations = whilst.evaluationsFor(prefix, this.#data, args);
    return RoundWork.evaluating(evaluations);
  }

  record(results: RoundResults, scope: TaskScope<ForTask>): Step<KindProgress> {
    const work = this.work(scope);
    const answered = results.answers(work);
    const waiting = this.#sequence !== null || work.isEmpty();

    if (waiting || !answered) return Step.of<KindProgress>(this);

    if (this.#items === null) return this.#collected(results, scope);

    return this.#checked(this.#items, results, scope);
  }

  childEnded(
    child: JsonPointer,
    ending: TaskEnding,
    scope: TaskScope<ForTask>,
  ): Step<KindProgress> {
    const sequence = this.#sequence;
    const items = this.#items;

    if (sequence === null || items === null) return Step.of<KindProgress>(this);

    const step = sequence.childEnded(child, ending, scope.task.body);
    return this.#following(items, step, scope);
  }

  #collected(
    results: RoundResults,
    scope: TaskScope<ForTask>,
  ): Step<KindProgress> {
    const collection = scope.task.collection;
    const at = scope.task.reference;
    const failure = collection.failureIn(scope.prefix, results, at);

    if (failure !== null) {
      const failed = Outcome.failed(failure);
      return ConcludedProgress.step(failed);
    }

    const value = collection.fill(scope.prefix, results);
    const none: readonly JsonValue[] = [];

    if (value === null) return this.#iterate(none, 0, this.#data, scope);

    if (!Array.isArray(value)) {
      const error = ErrorType.Expression.errorAt(
        at,
        ForProgress.#NOT_A_COLLECTION,
      );
      const failed = Outcome.failed(error);
      return ConcludedProgress.step(failed);
    }

    return this.#iterate(value, 0, this.#data, scope);
  }

  #checked(
    items: readonly JsonValue[],
    results: RoundResults,
    scope: TaskScope<ForTask>,
  ): Step<KindProgress> {
    const whilst = scope.task.whilst;

    if (whilst === null) return Step.of<KindProgress>(this);

    const prefix = this.#whilePrefix(scope);
    const at = scope.task.reference;
    const failure = whilst.failureIn(prefix, results, at);

    if (failure !== null) {
      const failed = Outcome.failed(failure);
      return ConcludedProgress.step(failed);
    }

    const continues = whilst.holds(prefix, results);

    if (!continues) {
      const completed = Outcome.of(this.#data);
      return ConcludedProgress.step(completed);
    }

    return this.#started(items, this.#index, this.#data, scope);
  }

  #iterate(
    items: readonly JsonValue[],
    index: number,
    data: JsonValue,
    scope: TaskScope<ForTask>,
  ): Step<KindProgress> {
    const unguarded = scope.task.whilst === null;
    const unchanged = unguarded && scope.task.body.isEmpty();

    if (index >= items.length || unchanged) {
      const completed = Outcome.of(data);
      return ConcludedProgress.step(completed);
    }

    if (unguarded) return this.#started(items, index, data, scope);

    const checking = new ForProgress({
      input: this.#input,
      items,
      index,
      data,
      sequence: null,
    });
    return Step.of<KindProgress>(checking);
  }

  #started(
    items: readonly JsonValue[],
    index: number,
    data: JsonValue,
    scope: TaskScope<ForTask>,
  ): Step<KindProgress> {
    const item = items[index] ?? null;
    const additions = scope.task.variablesFor(item, index);
    const variables = scope.variablesWith(additions);
    const step = Sequence.start(scope.task.body, data, variables);
    const iterating = new ForProgress({
      input: this.#input,
      items,
      index,
      data,
      sequence: step.progress,
    });
    return iterating.#following(items, step, scope);
  }

  #following(
    items: readonly JsonValue[],
    step: Step<Sequence>,
    scope: TaskScope<ForTask>,
  ): Step<KindProgress> {
    const sequence = step.progress;
    const outcome = sequence.outcome;

    if (outcome === null) {
      const iterating = new ForProgress({
        input: this.#input,
        items,
        index: this.#index,
        data: this.#data,
        sequence,
      });
      return new Step<KindProgress>(iterating, step.starts);
    }

    if (outcome.failure !== null || outcome.endsWorkflow())
      return ConcludedProgress.step(outcome);

    const next = this.#index + 1;
    return this.#iterate(items, next, outcome.output, scope);
  }

  #iterationArguments(
    items: readonly JsonValue[],
    scope: TaskScope<ForTask>,
  ): JsonObject {
    const item = items[this.#index] ?? null;
    const additions = scope.task.variablesFor(item, this.#index);
    return scope.definitionArgumentsWith(this.#input, additions);
  }

  #whilePrefix(scope: TaskScope): string {
    const part = `${ForProgress.#WHILE}-${this.#index}`;
    return scope.prefixFor(part);
  }
}
