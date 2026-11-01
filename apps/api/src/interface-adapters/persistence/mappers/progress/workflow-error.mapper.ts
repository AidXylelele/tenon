import { WorkflowError } from '../../../../domain/automation/language/workflow-error.js';
import type { WorkflowErrorState } from '../../interfaces.js';

export class WorkflowErrorMapper {
  static toState(error: WorkflowError): WorkflowErrorState;
  static toState(error: WorkflowError | null): WorkflowErrorState | null;
  static toState(error: WorkflowError | null): WorkflowErrorState | null {
    if (error === null) return null;

    return {
      type: error.type,
      status: error.status,
      instance: error.instance,
      title: error.title,
      detail: error.detail,
    };
  }

  static toDomain(state: WorkflowErrorState): WorkflowError;
  static toDomain(state: WorkflowErrorState | null): WorkflowError | null;
  static toDomain(state: WorkflowErrorState | null): WorkflowError | null {
    if (state === null) return null;

    return new WorkflowError(state);
  }
}
