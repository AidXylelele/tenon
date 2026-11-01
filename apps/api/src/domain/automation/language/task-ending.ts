import { InconsistentProgressError } from '../../errors.js';
import type { FlowDirective } from './flow-directive.js';
import type {
  JsonValue,
  TaskCompletion,
  TaskEndingProps,
} from './interfaces.js';
import { Outcome } from './outcome.js';
import type { WorkflowError } from './workflow-error.js';

export class TaskEnding {
  readonly #output: JsonValue;
  readonly #failure: WorkflowError | null;
  readonly #directive: FlowDirective | null;
  readonly #skipped: boolean;
  readonly #exported: boolean;
  readonly #context: JsonValue;
  readonly #body: Outcome | null;

  constructor(props: TaskEndingProps) {
    const failed = props.failure !== null;
    const kept =
      props.output !== null ||
      props.directive !== null ||
      props.context !== null ||
      props.skipped ||
      props.exported ||
      props.body !== null;

    if (failed && kept)
      throw new InconsistentProgressError(
        'a faulted task carries nothing but its error',
      );

    const undirected = !failed && props.directive === null;

    if (undirected)
      throw new InconsistentProgressError(
        'a task that did not fault has a flow directive',
      );

    const skippedWithMore =
      props.skipped && (props.exported || props.body !== null);

    if (skippedWithMore)
      throw new InconsistentProgressError(
        'a skipped task runs no body and exports nothing',
      );

    this.#output = props.output;
    this.#failure = props.failure;
    this.#directive = props.directive;
    this.#skipped = props.skipped;
    this.#exported = props.exported;
    this.#context = props.context;
    this.#body = props.body;
  }

  static completed(completion: TaskCompletion): TaskEnding {
    return new TaskEnding({
      output: completion.output,
      failure: null,
      directive: completion.directive,
      skipped: false,
      exported: completion.exported,
      context: completion.context,
      body: completion.outcome,
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

  static skipped(output: JsonValue, directive: FlowDirective): TaskEnding {
    return new TaskEnding({
      output,
      failure: null,
      directive,
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
