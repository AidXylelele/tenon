import type { ProcessRun } from '../interfaces.js';
import type { RoundResults } from '../round-results.js';
import { RoundWork } from '../round-work.js';
import type { BodyScope } from '../scopes/body-scope.js';
import { Step } from '../step.js';
import type { ProcessTask } from '../tasks/process-task.js';
import { ConcludedProgress } from './concluded-progress.js';
import { KindProgress } from './kind-progress.js';

// Stage 3 of an awaited script or shell command: the process runs, and its exit decides.
export class RunningProgress extends KindProgress {
  readonly #run: ProcessRun;

  constructor(run: ProcessRun) {
    super();
    this.#run = run;
  }

  get run(): ProcessRun {
    return this.#run;
  }

  work(): RoundWork {
    return RoundWork.running(this.#run);
  }

  record(
    results: RoundResults,
    scope: BodyScope<ProcessTask>,
  ): Step<KindProgress> {
    const result = results.process(this.#run.id);

    if (result === null) return Step.of<KindProgress>(this);

    const at = scope.task.reference;
    const outcome = result.outcome(scope.task.returns, at);
    return ConcludedProgress.step(outcome);
  }

  childEnded(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }

  subWorkflowAnswered(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }
}
