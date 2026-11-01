import { InconsistentProgressError } from '../../errors.js';
import type { FlowDirective } from './flow-directive.js';
import type {
  SubWorkflowRequest,
  JsonObject,
  JsonValue,
  OutcomeProps,
  ProcessRun,
} from './interfaces.js';
import type { WorkflowError } from './workflow-error.js';

export class Outcome {
  readonly #output: JsonValue;
  readonly #failure: WorkflowError | null;
  readonly #directive: FlowDirective | null;
  readonly #authorization: JsonObject | null;
  readonly #emitted: JsonObject | null;
  readonly #detachedProcess: ProcessRun | null;
  readonly #detachedWorkflow: SubWorkflowRequest | null;

  constructor(props: OutcomeProps) {
    const effects = [
      props.directive,
      props.authorization,
      props.emitted,
      props.detachedProcess,
      props.detachedWorkflow,
    ];
    const carried = effects.filter((effect) => effect !== null).length;

    if (carried > 1)
      throw new InconsistentProgressError(
        'an outcome carries one effect at most',
      );

    const failed = props.failure !== null;
    const failedWithMore = failed && (props.output !== null || carried > 0);

    if (failedWithMore)
      throw new InconsistentProgressError(
        'a failed outcome carries no output and no effect',
      );

    this.#output = props.output;
    this.#failure = props.failure;
    this.#directive = props.directive;
    this.#authorization = props.authorization;
    this.#emitted = props.emitted;
    this.#detachedProcess = props.detachedProcess;
    this.#detachedWorkflow = props.detachedWorkflow;
  }

  static of(output: JsonValue): Outcome {
    return new Outcome({
      output,
      failure: null,
      directive: null,
      authorization: null,
      emitted: null,
      detachedProcess: null,
      detachedWorkflow: null,
    });
  }

  static failed(failure: WorkflowError): Outcome {
    return new Outcome({
      output: null,
      failure,
      directive: null,
      authorization: null,
      emitted: null,
      detachedProcess: null,
      detachedWorkflow: null,
    });
  }

  static directed(output: JsonValue, directive: FlowDirective): Outcome {
    return new Outcome({
      output,
      failure: null,
      directive,
      authorization: null,
      emitted: null,
      detachedProcess: null,
      detachedWorkflow: null,
    });
  }

  static responded(
    output: JsonValue,
    authorization: JsonObject | null,
  ): Outcome {
    return new Outcome({
      output,
      failure: null,
      directive: null,
      authorization,
      emitted: null,
      detachedProcess: null,
      detachedWorkflow: null,
    });
  }

  static emitting(event: JsonObject): Outcome {
    return new Outcome({
      output: event,
      failure: null,
      directive: null,
      authorization: null,
      emitted: event,
      detachedProcess: null,
      detachedWorkflow: null,
    });
  }

  static detachingProcess(output: JsonValue, run: ProcessRun): Outcome {
    return new Outcome({
      output,
      failure: null,
      directive: null,
      authorization: null,
      emitted: null,
      detachedProcess: run,
      detachedWorkflow: null,
    });
  }

  static detachingWorkflow(
    output: JsonValue,
    child: SubWorkflowRequest,
  ): Outcome {
    return new Outcome({
      output,
      failure: null,
      directive: null,
      authorization: null,
      emitted: null,
      detachedProcess: null,
      detachedWorkflow: child,
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

  endsWorkflow(): boolean {
    return this.#directive?.endsWorkflow() ?? false;
  }

  get authorization(): JsonObject | null {
    return this.#authorization;
  }

  get emitted(): JsonObject | null {
    return this.#emitted;
  }

  get detachedProcess(): ProcessRun | null {
    return this.#detachedProcess;
  }

  get detachedWorkflow(): SubWorkflowRequest | null {
    return this.#detachedWorkflow;
  }
}
