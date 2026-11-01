import type {
  JsonValue,
  ProcessProgressProps,
  ProcessRun,
  ProcessTask,
} from '../interfaces.js';
import { Outcome } from '../outcome.js';
import type { RoundResults } from '../round-results.js';
import { RoundWork } from '../round-work.js';
import type { TaskScope } from '../scopes/task-scope.js';
import { Step } from '../step.js';
import { ConcludedProgress } from './concluded-progress.js';
import { KindProgress } from './kind-progress.js';

export class ProcessProgress extends KindProgress {
  static readonly #PROCESS = 'process';

  readonly #input: JsonValue;
  readonly #run: ProcessRun | null;

  constructor(props: ProcessProgressProps) {
    super();
    this.#input = props.input;
    this.#run = props.run;
  }

  static enter(input: JsonValue, scope: TaskScope): Step<KindProgress> {
    const progress = new ProcessProgress({ input, run: null });
    return progress.settled(scope);
  }

  get input(): JsonValue {
    return this.#input;
  }

  get run(): ProcessRun | null {
    return this.#run;
  }

  work(scope: TaskScope<ProcessTask>): RoundWork {
    if (this.#run !== null) return RoundWork.running(this.#run);

    const args = scope.definitionArguments(this.#input);
    const process = scope.task.process;
    const evaluations = process.evaluationsFor(scope.prefix, this.#input, args);
    return RoundWork.evaluating(evaluations);
  }

  record(
    results: RoundResults,
    scope: TaskScope<ProcessTask>,
  ): Step<KindProgress> {
    if (this.#run !== null) return this.#exited(this.#run, results, scope);

    return this.#defined(results, scope);
  }

  childEnded(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }

  #defined(
    results: RoundResults,
    scope: TaskScope<ProcessTask>,
  ): Step<KindProgress> {
    const work = this.work(scope);
    const answered = results.answers(work);

    if (!answered) return Step.of<KindProgress>(this);

    const process = scope.task.process;
    const at = scope.task.reference;
    const failure = process.failureIn(scope.prefix, results, at);

    if (failure !== null) {
      const failed = Outcome.failed(failure);
      return ConcludedProgress.step(failed);
    }

    const id = scope.workId(ProcessProgress.#PROCESS);
    const value = process.fill(scope.prefix, results);
    const run = scope.task.runFrom(id, value);

    if (!scope.task.awaits) {
      const detached = Outcome.detachingProcess(this.#input, run);
      return ConcludedProgress.step(detached);
    }

    const running = new ProcessProgress({ input: this.#input, run });
    return Step.of<KindProgress>(running);
  }

  #exited(
    run: ProcessRun,
    results: RoundResults,
    scope: TaskScope<ProcessTask>,
  ): Step<KindProgress> {
    const result = results.process(run.id);

    if (result === null) return Step.of<KindProgress>(this);

    const at = scope.task.reference;
    const outcome = result.outcome(scope.task.returns, at);
    return ConcludedProgress.step(outcome);
  }
}
