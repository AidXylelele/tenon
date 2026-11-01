import { InconsistentProgressError } from '../../../errors.js';
import { ErrorType } from '../error-type.js';
import type { ForProgressProps, JsonObject, JsonValue } from '../interfaces.js';
import type { JsonPointer } from '../json-pointer.js';
import { Outcome } from '../outcome.js';
import type { RoundResults } from '../round-results.js';
import { RoundWork } from '../round-work.js';
import type { BodyScope } from '../scopes/body-scope.js';
import { Sequence } from '../sequence.js';
import { Step } from '../step.js';
import type { TaskEnding } from '../task-ending.js';
import type { ForTask } from '../tasks/for-task.js';
import { ConcludedProgress } from './concluded-progress.js';
import { KindProgress } from './kind-progress.js';

export class ForProgress extends KindProgress {
  static readonly #WHILE = 'while';
  static readonly #NOT_A_COLLECTION = 'The for collection is not an array';

  readonly #items: readonly JsonValue[] | null;
  readonly #index: number;
  readonly #data: JsonValue;
  readonly #sequence: Sequence | null;

  constructor(props: ForProgressProps) {
    super();
    const counted = Number.isInteger(props.index) && props.index >= 0;
    const collecting = props.items === null;
    const started = props.index > 0 || props.sequence !== null;
    const beyond = props.items !== null && props.index >= props.items.length;

    if (!counted || (collecting && started) || beyond)
      throw new InconsistentProgressError(
        'a for iterates over the items it collected, from the first',
      );

    this.#items = props.items;
    this.#index = props.index;
    this.#data = props.data;
    this.#sequence = props.sequence;
  }

  static enter(scope: BodyScope<ForTask>): Step<KindProgress> {
    const progress = new ForProgress({
      items: null,
      index: 0,
      data: scope.input,
      sequence: null,
    });
    return progress.settled(scope);
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

  work(scope: BodyScope<ForTask>): RoundWork {
    if (this.#sequence !== null) return RoundWork.none();

    const task = scope.task;

    if (this.#items === null) {
      const args = scope.definitionArguments();
      const evaluations = task.collection.evaluationsFor(
        scope.prefix,
        scope.input,
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

  record(results: RoundResults, scope: BodyScope<ForTask>): Step<KindProgress> {
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
    scope: BodyScope<ForTask>,
  ): Step<KindProgress> {
    const sequence = this.#sequence;
    const items = this.#items;

    if (sequence === null || items === null) return Step.of<KindProgress>(this);

    const step = sequence.childEnded(child, ending, scope.task.body);
    return ForProgress.#following(items, this.#index, this.#data, step, scope);
  }

  #collected(
    results: RoundResults,
    scope: BodyScope<ForTask>,
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

    if (value === null) return ForProgress.#iterate(none, 0, this.#data, scope);

    if (!Array.isArray(value)) {
      const error = ErrorType.Expression.errorAt(
        at,
        ForProgress.#NOT_A_COLLECTION,
      );
      const failed = Outcome.failed(error);
      return ConcludedProgress.step(failed);
    }

    return ForProgress.#iterate(value, 0, this.#data, scope);
  }

  #checked(
    items: readonly JsonValue[],
    results: RoundResults,
    scope: BodyScope<ForTask>,
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

    return ForProgress.#started(items, this.#index, this.#data, scope);
  }

  static #iterate(
    items: readonly JsonValue[],
    index: number,
    data: JsonValue,
    scope: BodyScope<ForTask>,
  ): Step<KindProgress> {
    const unguarded = scope.task.whilst === null;
    const unchanged = unguarded && scope.task.body.isEmpty();

    if (index >= items.length || unchanged) {
      const completed = Outcome.of(data);
      return ConcludedProgress.step(completed);
    }

    if (unguarded) return ForProgress.#started(items, index, data, scope);

    const checking = new ForProgress({
      items,
      index,
      data,
      sequence: null,
    });
    return Step.of<KindProgress>(checking);
  }

  static #started(
    items: readonly JsonValue[],
    index: number,
    data: JsonValue,
    scope: BodyScope<ForTask>,
  ): Step<KindProgress> {
    const item = items[index] ?? null;
    const additions = scope.task.variablesFor(item, index);
    const variables = scope.variablesWith(additions);
    const step = Sequence.start(scope.task.body, data, variables);
    return ForProgress.#following(items, index, data, step, scope);
  }

  static #following(
    items: readonly JsonValue[],
    index: number,
    data: JsonValue,
    step: Step<Sequence | Outcome>,
    scope: BodyScope<ForTask>,
  ): Step<KindProgress> {
    const next = step.progress;

    if (!(next instanceof Outcome)) {
      const iterating = new ForProgress({ items, index, data, sequence: next });
      return new Step<KindProgress>(iterating, step.starts);
    }

    if (next.failure !== null || next.endsWorkflow())
      return ConcludedProgress.step(next);

    const following = index + 1;
    return ForProgress.#iterate(items, following, next.output, scope);
  }

  #iterationArguments(
    items: readonly JsonValue[],
    scope: BodyScope<ForTask>,
  ): JsonObject {
    const item = items[this.#index] ?? null;
    const additions = scope.task.variablesFor(item, this.#index);
    return scope.definitionArgumentsWith(additions);
  }

  #whilePrefix(scope: BodyScope): string {
    const part = `${ForProgress.#WHILE}-${this.#index}`;
    return scope.prefixFor(part);
  }

  subWorkflowEnded(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }
}
