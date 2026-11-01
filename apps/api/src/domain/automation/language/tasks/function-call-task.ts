import { TaskKind } from '../enums.js';
import type { Expression } from '../expression.js';
import type { FunctionCallTaskProps } from '../interfaces.js';
import type { ReusableComponents } from '../reusable-components.js';
import type { KindProgress } from '../progress/kind-progress.js';
import { FunctionCallProgress } from '../progress/function-call-progress.js';
import type { Step } from '../step.js';
import type { BodyScope } from '../scopes/body-scope.js';
import { Task } from './task.js';
import type { Template } from '../template.js';

export class FunctionCallTask extends Task {
  readonly #function: string;
  readonly #arguments: Template | null;

  constructor(props: FunctionCallTaskProps) {
    super(props);
    this.#function = props.function;
    this.#arguments = props.arguments;
  }

  get function(): string {
    return this.#function;
  }

  get arguments(): Template | null {
    return this.#arguments;
  }

  enter(scope: BodyScope<FunctionCallTask>): Step<KindProgress> {
    return FunctionCallProgress.enter(scope);
  }

  override confirmCalls(components: ReusableComponents): void {
    const callAt = this.reference.at(TaskKind.Call);
    components.function(this.#function, callAt);
  }

  protected override get ownExpressions(): readonly Expression[] {
    return this.#arguments?.expressions ?? [];
  }
}
