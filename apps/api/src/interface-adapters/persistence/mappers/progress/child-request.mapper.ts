import type { ChildRequest } from '../../../../domain/automation/language/interfaces.js';
import { WorkflowName } from '../../../../domain/automation/language/workflow-name.js';
import { WorkflowTarget } from '../../../../domain/automation/language/workflow-target.js';
import type { ChildRequestState } from '../../interfaces.js';

export class ChildRequestMapper {
  static toState(child: ChildRequest | null): ChildRequestState | null {
    if (child === null) return null;

    const target = child.target;
    return {
      namespace: target.workflow.namespace,
      name: target.workflow.name,
      version: target.version,
      input: child.input,
    };
  }

  static toDomain(state: ChildRequestState | null): ChildRequest | null {
    if (state === null) return null;

    const workflow = new WorkflowName(state.namespace, state.name);
    const target = new WorkflowTarget(workflow, state.version);
    return { target, input: state.input };
  }
}
