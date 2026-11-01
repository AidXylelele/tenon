import type { SubWorkflowRequest } from '../../language/interfaces.js';
import type { WorkflowDetachedProps } from '../interfaces.js';

export class WorkflowDetached {
  readonly #instanceId: string;
  readonly #taskInstanceId: string;
  readonly #subWorkflowId: string;
  readonly #request: SubWorkflowRequest;

  constructor(props: WorkflowDetachedProps) {
    this.#instanceId = props.instanceId;
    this.#taskInstanceId = props.taskInstanceId;
    this.#subWorkflowId = props.subWorkflowId;
    this.#request = props.request;
  }

  get instanceId(): string {
    return this.#instanceId;
  }

  get taskInstanceId(): string {
    return this.#taskInstanceId;
  }

  get subWorkflowId(): string {
    return this.#subWorkflowId;
  }

  get request(): SubWorkflowRequest {
    return this.#request;
  }
}
