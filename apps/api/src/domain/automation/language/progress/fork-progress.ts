import { InconsistentProgressError } from '../../../errors.js';
import type { ForkProgressProps, JsonValue, TaskStart } from '../interfaces.js';
import type { JsonPointer } from '../json-pointer.js';
import { Outcome } from '../outcome.js';
import { RoundWork } from '../round-work.js';
import type { BodyScope } from '../scopes/body-scope.js';
import { Step } from '../step.js';
import type { TaskEnding } from '../task-ending.js';
import type { ForkTask } from '../tasks/fork-task.js';
import { ConcludedProgress } from './concluded-progress.js';
import { KindProgress } from './kind-progress.js';

export class ForkProgress extends KindProgress {
  readonly #outputs: readonly JsonValue[];
  readonly #pending: readonly number[];

  constructor(props: ForkProgressProps) {
    super();
    const branches = props.outputs.length;
    const known = props.pending.every(
      (position) =>
        Number.isInteger(position) && position >= 0 && position < branches,
    );
    const distinct = new Set(props.pending).size === props.pending.length;
    const waiting = props.pending.length > 0;

    if (!waiting || !distinct || !known)
      throw new InconsistentProgressError(
        'a fork waits for distinct branches it has',
      );

    this.#outputs = props.outputs;
    this.#pending = props.pending;
  }

  static enter(scope: BodyScope<ForkTask>): Step<KindProgress> {
    const branches = scope.task.branches.tasks;
    const outputs = branches.map(() => null);

    if (branches.length === 0) {
      const joined = Outcome.of(outputs);
      return ConcludedProgress.step(joined);
    }

    const starts = branches.map((branch): TaskStart => {
      return {
        reference: branch.reference,
        input: scope.input,
        variables: scope.variables,
      };
    });
    const positions = branches.keys();
    const pending = Array.from(positions);
    const progress = new ForkProgress({ outputs, pending });
    return new Step<KindProgress>(progress, starts);
  }

  get outputs(): readonly JsonValue[] {
    return this.#outputs;
  }

  get pending(): readonly number[] {
    return this.#pending;
  }

  work(): RoundWork {
    return RoundWork.none();
  }

  record(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }

  childEnded(
    child: JsonPointer,
    ending: TaskEnding,
    scope: BodyScope<ForkTask>,
  ): Step<KindProgress> {
    const branch = scope.task.branches.positionOfReference(child);
    const awaited = branch !== null && this.#pending.includes(branch);

    if (!awaited) return Step.of<KindProgress>(this);

    const outcome = ending.outcome();

    if (outcome.failure !== null) return ConcludedProgress.step(outcome);

    const workflowEnd = ending.workflowEnd();

    if (workflowEnd !== null) return ConcludedProgress.step(workflowEnd);

    const pending = this.#pending.filter((position) => position !== branch);

    if (scope.task.compete) return this.#competed(ending, pending, scope);

    const outputs = this.#outputs.map((output, position) => {
      if (position === branch) return outcome.output;

      return output;
    });

    if (pending.length === 0) {
      const joined = Outcome.of(outputs);
      return ConcludedProgress.step(joined);
    }

    const joining = new ForkProgress({ outputs, pending });
    return Step.of<KindProgress>(joining);
  }

  #competed(
    ending: TaskEnding,
    pending: readonly number[],
    scope: BodyScope<ForkTask>,
  ): Step<KindProgress> {
    if (!ending.skipped) {
      const won = ending.outcome();
      return ConcludedProgress.step(won);
    }

    if (pending.length > 0) {
      const racing = new ForkProgress({ outputs: this.#outputs, pending });
      return Step.of<KindProgress>(racing);
    }

    const unchanged = Outcome.of(scope.input);
    return ConcludedProgress.step(unchanged);
  }

  subWorkflowAnswered(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }
}
