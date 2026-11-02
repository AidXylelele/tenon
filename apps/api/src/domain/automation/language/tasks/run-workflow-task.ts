import type {
  JsonValue,
  RunWorkflowTaskProps,
  SubWorkflowRequest,
} from '../interfaces.js';
import type { KindProgress } from '../progress/kind-progress.js';
import { SubWorkflowProgress } from '../progress/sub-workflow-progress.js';
import type { RoundResults } from '../round-results.js';
import type { BodyScope } from '../scopes/body-scope.js';
import { Step } from '../step.js';
import type { Template } from '../template.js';
import type { WorkflowTarget } from '../workflow-target.js';
import { LeafTask } from './leaf-task.js';

export class RunWorkflowTask extends LeafTask {
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

  get templates(): readonly Template[] {
    if (this.#input === null) return [];

    return [this.#input];
  }

  defined(results: RoundResults, scope: BodyScope): Step<KindProgress> {
    const input = this.#inputFrom(results, scope);
    const request: SubWorkflowRequest = {
      target: this.#target,
      input,
      awaited: this.#awaits,
    };
    const requesting = new SubWorkflowProgress(request);
    return Step.of<KindProgress>(requesting);
  }

  #inputFrom(results: RoundResults, scope: BodyScope): JsonValue {
    if (this.#input === null) return scope.input;

    return scope.filled(this.#input, results);
  }
}
