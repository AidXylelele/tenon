import { TaskKind } from '../enums.js';
import type {
  FunctionCallTaskProps,
  JsonValue,
  TaskStart,
} from '../interfaces.js';
import { FunctionProgress } from '../progress/function-progress.js';
import type { KindProgress } from '../progress/kind-progress.js';
import type { ReusableComponents } from '../reusable-components.js';
import type { RoundResults } from '../round-results.js';
import type { BodyScope } from '../scopes/body-scope.js';
import { Step } from '../step.js';
import type { Template } from '../template.js';
import { LeafTask } from './leaf-task.js';

// `call: <function>`: the declared function runs as a child with the evaluated arguments.
export class FunctionCallTask extends LeafTask {
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

  get templates(): readonly Template[] {
    if (this.#arguments === null) return [];

    return [this.#arguments];
  }

  defined(results: RoundResults, scope: BodyScope): Step<KindProgress> {
    const callAt = this.reference.at(TaskKind.Call);
    const declared = scope.definition.components.function(
      this.#function,
      callAt,
    );
    const input = this.#inputFrom(results, scope);
    const start: TaskStart = {
      reference: declared.reference,
      input,
      variables: scope.variables,
    };
    const running = new FunctionProgress();
    return new Step<KindProgress>(running, [start]);
  }

  override confirmCalls(components: ReusableComponents): void {
    const callAt = this.reference.at(TaskKind.Call);
    components.function(this.#function, callAt);
  }

  #inputFrom(results: RoundResults, scope: BodyScope): JsonValue {
    if (this.#arguments === null) return scope.input;

    return scope.filled(this.#arguments, results);
  }
}
