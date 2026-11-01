import type { Expression } from '../expression.js';
import type { JsonValue, RunWorkflowTaskProps } from '../interfaces.js';
import type { KindProgress } from '../progress/kind-progress.js';
import { RunWorkflowProgress } from '../progress/run-workflow-progress.js';
import type { Step } from '../step.js';
import type { TaskScope } from '../scopes/task-scope.js';
import { Task } from './task.js';
import type { Template } from '../template.js';
import type { WorkflowTarget } from '../workflow-target.js';

export class RunWorkflowTask extends Task {
  readonly #target: WorkflowTarget;
  readonly #input: Template | null;
  readonly #awaits: boolean;

  constructor(props: RunWorkflowTaskProps) {
    super(props);
    this.#target = props.target;
    this.#input = props.input;
    this.#awaits = props.awaits ?? true;
  }

  get target(): WorkflowTarget {
    return this.#target;
  }

  get input(): Template | null {
    return this.#input;
  }

  get awaits(): boolean {
    return this.#awaits;
  }

  enter(
    input: JsonValue,
    scope: TaskScope<RunWorkflowTask>,
  ): Step<KindProgress> {
    return RunWorkflowProgress.enter(input, scope);
  }

  protected override get ownExpressions(): readonly Expression[] {
    return this.#input?.expressions ?? [];
  }
}
