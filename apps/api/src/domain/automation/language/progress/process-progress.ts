import type { ProcessRun, ProcessTask } from '../interfaces.js';
import { Outcome } from '../outcome.js';
import type { RoundResults } from '../round-results.js';
import { RoundWork } from '../round-work.js';
import type { BodyScope } from '../scopes/body-scope.js';
import { Step } from '../step.js';
import { ConcludedProgress } from './concluded-progress.js';
import { KindProgress } from './kind-progress.js';

export class ProcessProgress extends KindProgress {
  static readonly #PROCESS = 'process';

  readonly #run: ProcessRun | null;

  constructor(run: ProcessRun | null) {
    super();
    this.#run = run;
  }

  static enter(scope: BodyScope): Step<KindProgress> {
    const progress = new ProcessProgress(null);
    return progress.settled(scope);
  }

  get run(): ProcessRun | null {
    return this.#run;
  }

  work(scope: BodyScope<ProcessTask>): RoundWork {
    if (this.#run !== null) return RoundWork.running(this.#run);

    const args = scope.definitionArguments();
    const process = scope.task.process;
    const evaluations = process.evaluationsFor(scope.prefix, scope.input, args);
    return RoundWork.evaluating(evaluations);
  }

  record(
    results: RoundResults,
    scope: BodyScope<ProcessTask>,
  ): Step<KindProgress> {
    if (this.#run !== null) return this.#exited(this.#run, results, scope);

    return this.#defined(results, scope);
  }

  childEnded(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }

  #defined(
    results: RoundResults,
    scope: BodyScope<ProcessTask>,
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

    // A detached process outlives its task, so no deadline of the task applies to it.
    if (!scope.task.awaits) {
      const detachedRun = scope.task.runFrom(id, value, null);
      const detached = Outcome.detachingProcess(scope.input, detachedRun);
      return ConcludedProgress.step(detached);
    }

    const run = scope.task.runFrom(id, value, scope.deadline);
    const running = new ProcessProgress(run);
    return Step.of<KindProgress>(running);
  }

  #exited(
    run: ProcessRun,
    results: RoundResults,
    scope: BodyScope<ProcessTask>,
  ): Step<KindProgress> {
    const result = results.process(run.id);

    if (result === null) return Step.of<KindProgress>(this);

    const at = scope.task.reference;
    const outcome = result.outcome(scope.task.returns, at);
    return ConcludedProgress.step(outcome);
  }

  subWorkflowAnswered(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }
}
