import type { JsonValue, OutputStageProps } from '../interfaces.js';
import type { RoundResults } from '../round-results.js';
import { RoundWork } from '../round-work.js';
import type { TaskScope } from '../scopes/task-scope.js';
import { Step } from '../step.js';
import { EndedStage } from './ended-stage.js';
import { ExportStage } from './export-stage.js';
import { ResultStage } from './result-stage.js';
import type { TaskProgress } from './task-progress.js';

export class OutputStage extends ResultStage {
  readonly #input: JsonValue;

  constructor(props: OutputStageProps) {
    super(props);
    this.#input = props.input;
  }

  static enter(props: OutputStageProps, scope: TaskScope): Step<TaskProgress> {
    const stage = new OutputStage(props);
    return stage.settled(scope);
  }

  get input(): JsonValue {
    return this.#input;
  }

  work(scope: TaskScope): RoundWork {
    const rawOutput = this.outcome.output;
    const args = scope.outputArguments(
      this.#input,
      rawOutput,
      this.outcome.authorization,
    );
    const declared = scope.task.base.output;
    const evaluations = declared.evaluationsFor(scope.key, rawOutput, args);
    return RoundWork.evaluating(evaluations);
  }

  record(results: RoundResults, scope: TaskScope): Step<TaskProgress> {
    const work = this.work(scope);
    const answered = results.answers(work);

    if (!answered) return Step.of<TaskProgress>(this);

    const declared = scope.task.base.output;
    const at = scope.task.reference;
    const failure = declared.failureIn(scope.key, results, at);

    if (failure !== null) {
      const faulted = EndedStage.faulted(failure);
      return Step.of<TaskProgress>(faulted);
    }

    const rawOutput = this.outcome.output;
    const output = declared.valueFrom(scope.key, results, rawOutput);
    const deadline = this.deadline();
    return ExportStage.enter(
      {
        input: this.#input,
        deadline,
        outcome: this.outcome,
        output,
      },
      scope,
    );
  }

  childEnded(): Step<TaskProgress> {
    return Step.of<TaskProgress>(this);
  }

  subWorkflowAnswered(): Step<TaskProgress> {
    return Step.of<TaskProgress>(this);
  }
}
