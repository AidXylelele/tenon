import type {
  CallProgressProps,
  CallTask,
  Evaluation,
  JsonValue,
  ServiceCall,
} from '../interfaces.js';
import { Outcome } from '../outcome.js';
import type { RoundResults } from '../round-results.js';
import { RoundWork } from '../round-work.js';
import type { TaskScope } from '../scopes/task-scope.js';
import { Step } from '../step.js';
import type { WorkflowError } from '../workflow-error.js';
import { ConcludedProgress } from './concluded-progress.js';
import { KindProgress } from './kind-progress.js';

export class CallProgress extends KindProgress {
  static readonly #CALL = 'call';

  readonly #input: JsonValue;
  readonly #call: ServiceCall | null;

  constructor(props: CallProgressProps) {
    super();
    this.#input = props.input;
    this.#call = props.call;
  }

  static enter(input: JsonValue, scope: TaskScope): Step<KindProgress> {
    const progress = new CallProgress({ input, call: null });
    return progress.settled(scope);
  }

  get input(): JsonValue {
    return this.#input;
  }

  get call(): ServiceCall | null {
    return this.#call;
  }

  work(scope: TaskScope<CallTask>): RoundWork {
    if (this.#call !== null) return RoundWork.calling(this.#call);

    const args = scope.definitionArguments(this.#input);
    const evaluations: Evaluation[] = [];

    for (const template of scope.task.templates) {
      const found = template.evaluationsFor(scope.prefix, this.#input, args);

      for (const evaluation of found) evaluations.push(evaluation);
    }

    return RoundWork.evaluating(evaluations);
  }

  record(
    results: RoundResults,
    scope: TaskScope<CallTask>,
  ): Step<KindProgress> {
    if (this.#call !== null) return this.#responded(this.#call, results, scope);

    return this.#defined(results, scope);
  }

  childEnded(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }

  #defined(
    results: RoundResults,
    scope: TaskScope<CallTask>,
  ): Step<KindProgress> {
    const work = this.work(scope);
    const answered = results.answers(work);

    if (!answered) return Step.of<KindProgress>(this);

    const failure = this.#failureIn(results, scope);

    if (failure !== null) {
      const failed = Outcome.failed(failure);
      return ConcludedProgress.step(failed);
    }

    const id = scope.workId(CallProgress.#CALL);
    const call = scope.task.callFrom(id, scope.prefix, results, this.#input);
    const calling = new CallProgress({ input: this.#input, call });
    return Step.of<KindProgress>(calling);
  }

  #failureIn(
    results: RoundResults,
    scope: TaskScope<CallTask>,
  ): WorkflowError | null {
    const at = scope.task.reference;

    for (const template of scope.task.templates) {
      const failure = template.failureIn(scope.prefix, results, at);

      if (failure !== null) return failure;
    }

    return null;
  }

  #responded(
    call: ServiceCall,
    results: RoundResults,
    scope: TaskScope<CallTask>,
  ): Step<KindProgress> {
    const result = results.response(call.id);

    if (result === null) return Step.of<KindProgress>(this);

    const at = scope.task.reference;
    const outcome = result.outcome(scope.task.output, at);
    return ConcludedProgress.step(outcome);
  }
}
