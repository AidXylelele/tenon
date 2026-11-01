import { InconsistentProgressError } from '../../errors.js';
import type { FlowDirective } from './flow-directive.js';
import type {
  JsonValue,
  TaskCompletion,
  TaskEndingProps,
} from './interfaces.js';
import { Outcome } from './outcome.js';
import { Phase } from './phase.js';
import type { WorkflowError } from './workflow-error.js';

export class TaskEnding {
  readonly #output: JsonValue;
  readonly #failure: WorkflowError | null;
  readonly #directive: FlowDirective | null;
  readonly #skipped: boolean;
  readonly #exported: boolean;
  readonly #context: JsonValue;
  readonly #body: Outcome | null;

  private constructor(props: TaskEndingProps) {
    this.#output = props.output;
    this.#failure = props.failure;
    this.#directive = props.directive;
    this.#skipped = props.skipped;
    this.#exported = props.exported;
    this.#context = props.context;
    this.#body = props.body;
  }

  static completed(completion: TaskCompletion): TaskEnding {
    const body = completion.outcome;

    if (body.failure !== null)
      throw new InconsistentProgressError(
        'a task completes only when its body did not fail',
      );

    const directive = body.directive ?? completion.then;
    return new TaskEnding({
      output: completion.output,
      failure: null,
      directive,
      skipped: false,
      exported: completion.exported,
      context: completion.context,
      body,
    });
  }

  static faulted(failure: WorkflowError): TaskEnding {
    return new TaskEnding({
      output: null,
      failure,
      directive: null,
      skipped: false,
      exported: false,
      context: null,
      body: null,
    });
  }

  static skipped(output: JsonValue, then: FlowDirective): TaskEnding {
    return new TaskEnding({
      output,
      failure: null,
      directive: then,
      skipped: true,
      exported: false,
      context: null,
      body: null,
    });
  }

  get output(): JsonValue {
    return this.#output;
  }

  get failure(): WorkflowError | null {
    return this.#failure;
  }

  get directive(): FlowDirective | null {
    return this.#directive;
  }

  get skipped(): boolean {
    return this.#skipped;
  }

  get exported(): boolean {
    return this.#exported;
  }

  get context(): JsonValue {
    return this.#context;
  }

  get body(): Outcome | null {
    return this.#body;
  }

  phase(): Phase | null {
    if (this.#skipped) return null;

    if (this.#failure !== null) return Phase.Faulted;

    return Phase.Completed;
  }

  outcome(): Outcome {
    if (this.#failure !== null) return Outcome.failed(this.#failure);

    return Outcome.of(this.#output);
  }

  workflowEnd(): Outcome | null {
    const directive = this.#directive;

    if (!directive?.endsWorkflow()) return null;

    return Outcome.directed(this.#output, directive);
  }
}
