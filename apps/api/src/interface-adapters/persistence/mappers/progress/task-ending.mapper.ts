import { InconsistentProgressError } from '../../../../domain/errors.js';
import { TaskEnding } from '../../../../domain/automation/language/task-ending.js';
import { EndingKind } from '../../enums.js';
import type { TaskEndingState } from '../../interfaces.js';
import { FlowDirectiveMapper } from './flow-directive.mapper.js';
import { OutcomeMapper } from './outcome.mapper.js';
import { WorkflowErrorMapper } from './workflow-error.mapper.js';

export class TaskEndingMapper {
  static readonly #UNSTORED = 'a task ending the platform does not store';

  static toState(ending: TaskEnding): TaskEndingState {
    const failure = WorkflowErrorMapper.toState(ending.failure);
    const directive = FlowDirectiveMapper.toState(ending.directive);
    const body = OutcomeMapper.toState(ending.body);

    if (failure !== null) return { kind: EndingKind.Faulted, failure };

    if (directive === null)
      throw new InconsistentProgressError(TaskEndingMapper.#UNSTORED);

    if (ending.skipped)
      return { kind: EndingKind.Skipped, output: ending.output, directive };

    if (body === null)
      throw new InconsistentProgressError(TaskEndingMapper.#UNSTORED);

    return {
      kind: EndingKind.Completed,
      output: ending.output,
      directive,
      exported: ending.exported,
      context: ending.context,
      body,
    };
  }

  static toDomain(state: TaskEndingState): TaskEnding {
    switch (state.kind) {
      case EndingKind.Faulted: {
        const failure = WorkflowErrorMapper.toDomain(state.failure);
        return TaskEnding.faulted(failure);
      }
      case EndingKind.Skipped: {
        const directive = FlowDirectiveMapper.toDomain(state.directive);
        return TaskEnding.skipped(state.output, directive);
      }
      case EndingKind.Completed: {
        const then = FlowDirectiveMapper.toDomain(state.directive);
        const outcome = OutcomeMapper.toDomain(state.body);
        return TaskEnding.completed({
          output: state.output,
          then,
          exported: state.exported,
          context: state.context,
          outcome,
        });
      }
      default:
        throw new InconsistentProgressError(TaskEndingMapper.#UNSTORED);
    }
  }
}
