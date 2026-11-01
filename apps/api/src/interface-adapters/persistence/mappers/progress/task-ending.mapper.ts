import { TaskEnding } from '../../../../domain/automation/language/task-ending.js';
import type { TaskEndingState } from '../../interfaces.js';
import { FlowDirectiveMapper } from './flow-directive.mapper.js';
import { OutcomeMapper } from './outcome.mapper.js';
import { WorkflowErrorMapper } from './workflow-error.mapper.js';

export class TaskEndingMapper {
  static toState(ending: TaskEnding): TaskEndingState {
    const failure = WorkflowErrorMapper.toState(ending.failure);
    const directive = FlowDirectiveMapper.toState(ending.directive);
    const body = OutcomeMapper.toState(ending.body);
    return {
      output: ending.output,
      failure,
      directive,
      skipped: ending.skipped,
      exported: ending.exported,
      context: ending.context,
      body,
    };
  }

  static toDomain(state: TaskEndingState): TaskEnding {
    const failure = WorkflowErrorMapper.toDomain(state.failure);
    const directive = FlowDirectiveMapper.toDomain(state.directive);
    const body = OutcomeMapper.toDomain(state.body);
    return new TaskEnding({
      output: state.output,
      failure,
      directive,
      skipped: state.skipped,
      exported: state.exported,
      context: state.context,
      body,
    });
  }
}
