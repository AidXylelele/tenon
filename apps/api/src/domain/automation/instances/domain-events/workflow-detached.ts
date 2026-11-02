import type { DetachedWorkflow } from '../../language/interfaces.js';
import type { WorkflowDetachedProps } from '../interfaces.js';

export class WorkflowDetached {
  readonly #instanceId: string;
  readonly #taskInstanceId: string;
  readonly #subWorkflowId: string;
  readonly #detached: DetachedWorkflow;

  constructor(props: WorkflowDetachedProps) {
    this.#instanceId = props.instanceId;
    this.#taskInstanceId = props.taskInstanceId;
    this.#subWorkflowId = props.subWorkflowId;
    this.#detached = props.detached;
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

  get detached(): DetachedWorkflow {
    return this.#detached;
  }
}
