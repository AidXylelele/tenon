import type { SubWorkflowRequest } from '../../../../domain/automation/language/interfaces.js';
import { WorkflowName } from '../../../../domain/automation/language/workflow-name.js';
import { WorkflowTarget } from '../../../../domain/automation/language/workflow-target.js';
import type { SubWorkflowRequestState } from '../../interfaces.js';

export class SubWorkflowRequestMapper {
  static toState(
    request: SubWorkflowRequest | null,
  ): SubWorkflowRequestState | null {
    if (request === null) return null;

    const target = request.target;
    return {
      namespace: target.workflow.namespace,
      name: target.workflow.name,
      version: target.version,
      input: request.input,
      awaited: request.awaited,
    };
  }

  static toDomain(
    state: SubWorkflowRequestState | null,
  ): SubWorkflowRequest | null {
    if (state === null) return null;

    const workflow = new WorkflowName(state.namespace, state.name);
    const target = new WorkflowTarget(workflow, state.version);
    return { target, input: state.input, awaited: state.awaited };
  }
}
