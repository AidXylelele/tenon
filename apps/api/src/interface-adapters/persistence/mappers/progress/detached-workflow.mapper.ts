import type { DetachedWorkflow } from '../../../../domain/automation/language/interfaces.js';
import { WorkflowName } from '../../../../domain/automation/language/workflow-name.js';
import type { DetachedWorkflowState } from '../../schema/interfaces.js';

export class DetachedWorkflowMapper {
  static toState(
    detached: DetachedWorkflow | null,
  ): DetachedWorkflowState | null {
    if (detached === null) return null;

    return {
      namespace: detached.workflow.namespace,
      name: detached.workflow.name,
      versionId: detached.versionId,
      input: detached.input,
    };
  }

  static toDomain(
    state: DetachedWorkflowState | null,
  ): DetachedWorkflow | null {
    if (state === null) return null;

    const workflow = new WorkflowName(state.namespace, state.name);
    return { workflow, versionId: state.versionId, input: state.input };
  }
}
