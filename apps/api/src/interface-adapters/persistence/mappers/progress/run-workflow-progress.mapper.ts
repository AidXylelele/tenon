import { RunWorkflowProgress } from '../../../../domain/automation/language/progress/run-workflow-progress.js';
import { ProgressKind } from '../../enums.js';
import type { RunWorkflowProgressState } from '../../interfaces.js';
import { ChildRequestMapper } from './child-request.mapper.js';

export class RunWorkflowProgressMapper {
  static toState(progress: RunWorkflowProgress): RunWorkflowProgressState {
    const child = ChildRequestMapper.toState(progress.child());
    return { kind: ProgressKind.RunWorkflow, input: progress.input, child };
  }

  static toDomain(state: RunWorkflowProgressState): RunWorkflowProgress {
    const child = ChildRequestMapper.toDomain(state.child);
    return new RunWorkflowProgress({ input: state.input, child });
  }
}
