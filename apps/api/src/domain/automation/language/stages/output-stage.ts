import type { JsonValue, OutputStageProps } from '../interfaces.js';
import type { Outcome } from '../outcome.js';
import type { RoundResults } from '../round-results.js';
import { RoundWork } from '../round-work.js';
import type { TaskScope } from '../scopes/task-scope.js';
import { Step } from '../step.js';
import { EndedStage } from './ended-stage.js';
import { ExportStage } from './export-stage.js';
import { TaskProgress } from './task-progress.js';

export class OutputStage extends TaskProgress {
  readonly #input: JsonValue;
  readonly #deadline: Date | null;
  readonly #outcome: Outcome;

  constructor(props: OutputStageProps) {
    super();
    this.#input = props.input;
    this.#deadline = props.deadline;
    this.#outcome = props.outcome;
  }

  static enter(props: OutputStageProps, scope: TaskScope): Step<TaskProgress> {
    const stage = new OutputStage(props);
    return stage.settled(scope);
  }

  get input(): JsonValue {
    return this.#input;
  }

  get outcome(): Outcome {
    return this.#outcome;
  }

  override deadline(): Date | null {
    return this.#deadline;
  }

  work(scope: TaskScope): RoundWork {
    const rawOutput = this.#outcome.output;
    const args = scope.outputArguments(
      this.#input,
      rawOutput,
      this.#outcome.authorization,
    );
    const declared = scope.task.base.output;
    const evaluations = declared.evaluationsFor(scope.prefix, rawOutput, args);
    return RoundWork.evaluating(evaluations);
  }

  record(results: RoundResults, scope: TaskScope): Step<TaskProgress> {
    const work = this.work(scope);
    const answered = results.answers(work);

    if (!answered) return Step.of<TaskProgress>(this);

    const declared = scope.task.base.output;
    const at = scope.task.reference;
    const failure = declared.failureIn(scope.prefix, results, at);

    if (failure !== null) {
      const faulted = EndedStage.faulted(failure);
      return Step.of<TaskProgress>(faulted);
    }

    const rawOutput = this.#outcome.output;
    const output = declared.valueFrom(scope.prefix, results, rawOutput);
    return ExportStage.enter(
      {
        input: this.#input,
        deadline: this.#deadline,
        outcome: this.#outcome,
        output,
      },
      scope,
    );
  }

  childEnded(): Step<TaskProgress> {
    return Step.of<TaskProgress>(this);
  }

  timeOut(scope: TaskScope): TaskProgress {
    return EndedStage.timedOut(scope);
  }
}
