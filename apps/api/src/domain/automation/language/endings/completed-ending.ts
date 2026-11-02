import { InconsistentProgressError } from '../../../errors.js';
import type { FlowDirective } from '../flow-directive.js';
import type { JsonValue, TaskCompletion } from '../interfaces.js';
import { Outcome } from '../outcome.js';
import { Phase } from '../phase.js';
import { TaskEnding } from './task-ending.js';

export class CompletedEnding extends TaskEnding {
  readonly failure = null;
  readonly #output: JsonValue;
  readonly #directive: FlowDirective;
  readonly #exported: boolean;
  readonly #context: JsonValue;
  readonly #body: Outcome;

  constructor(completion: TaskCompletion) {
    super();
    const body = completion.outcome;

    if (body.failure !== null)
      throw new InconsistentProgressError(
        'a task completes only when its body did not fail',
      );

    this.#output = completion.output;
    this.#directive = body.directive ?? completion.then;
    this.#exported = completion.exported;
    this.#context = completion.context;
    this.#body = body;
  }

  get output(): JsonValue {
    return this.#output;
  }

  get directive(): FlowDirective {
    return this.#directive;
  }

  get body(): Outcome {
    return this.#body;
  }

  // For persistence: whether the task exported, and the context it left.
  get exported(): boolean {
    return this.#exported;
  }

  get context(): JsonValue {
    return this.#context;
  }

  override contextOr(current: JsonValue): JsonValue {
    if (!this.#exported) return current;

    return this.#context;
  }

  phase(): Phase {
    return Phase.Completed;
  }

  outcome(): Outcome {
    return Outcome.of(this.#output);
  }
}
