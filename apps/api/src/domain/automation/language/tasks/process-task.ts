import type { JsonValue, ProcessRun } from '../interfaces.js';
import { Outcome } from '../outcome.js';
import type { ProcessReturn } from '../process-return.js';
import { ConcludedProgress } from '../progress/concluded-progress.js';
import type { KindProgress } from '../progress/kind-progress.js';
import { RunningProgress } from '../progress/running-progress.js';
import type { RoundResults } from '../round-results.js';
import type { BodyScope } from '../scopes/body-scope.js';
import { Step } from '../step.js';
import type { Template } from '../template.js';
import { LeafTask } from './leaf-task.js';

// `run: script` and `run: shell`: the evaluated definition becomes a process, awaited or not.
export abstract class ProcessTask extends LeafTask {
  static readonly #PROCESS = 'process';

  abstract get process(): Template;

  abstract get awaits(): boolean;

  abstract get returns(): ProcessReturn;

  get templates(): readonly Template[] {
    return [this.process];
  }

  defined(results: RoundResults, scope: BodyScope): Step<KindProgress> {
    const id = scope.key.idFor(ProcessTask.#PROCESS);
    const value = scope.filled(this.process, results);

    // A detached process outlives its task, so no deadline of the task applies to it.
    if (!this.awaits) {
      const detachedRun = this.runFrom(id, value, null);
      const detached = Outcome.detachingProcess(scope.input, detachedRun);
      return ConcludedProgress.step(detached);
    }

    const deadline = scope.deadline.time;
    const run = this.runFrom(id, value, deadline);
    const running = new RunningProgress(run);
    return Step.of<KindProgress>(running);
  }

  protected abstract runFrom(
    id: string,
    process: JsonValue,
    deadline: Date | null,
  ): ProcessRun;
}
