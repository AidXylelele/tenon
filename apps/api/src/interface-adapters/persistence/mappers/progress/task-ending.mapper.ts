import { InconsistentProgressError } from '../../../../domain/errors.js';
import type { TaskEnding } from '../../../../domain/automation/language/endings/task-ending.js';
import { EndingKind } from '../../schema/enums.js';
import type { TaskEndingState } from '../../schema/interfaces.js';
import { FlowDirectiveMapper } from './flow-directive.mapper.js';
import { OutcomeMapper } from './outcome.mapper.js';
import { WorkflowErrorMapper } from './workflow-error.mapper.js';
import { CompletedEnding } from '../../../../domain/automation/language/endings/completed-ending.js';
import { FaultedEnding } from '../../../../domain/automation/language/endings/faulted-ending.js';
import { SkippedEnding } from '../../../../domain/automation/language/endings/skipped-ending.js';

export class TaskEndingMapper {
  static readonly #UNSTORED = 'a task ending the platform does not store';

  static toState(ending: TaskEnding): TaskEndingState {
    if (ending instanceof FaultedEnding) {
      const failure = WorkflowErrorMapper.toState(ending.failure);
      return { kind: EndingKind.Faulted, failure };
    }

    if (ending instanceof SkippedEnding) {
      const directive = FlowDirectiveMapper.toState(ending.directive);
      return { kind: EndingKind.Skipped, output: ending.output, directive };
    }

    if (ending instanceof CompletedEnding) {
      const directive = FlowDirectiveMapper.toState(ending.directive);
      const body = OutcomeMapper.toState(ending.body);
      return {
        kind: EndingKind.Completed,
        output: ending.output,
        directive,
        exported: ending.exported,
        context: ending.context,
        body,
      };
    }

    throw new InconsistentProgressError(TaskEndingMapper.#UNSTORED);
  }

  static toDomain(state: TaskEndingState): TaskEnding {
    switch (state.kind) {
      case EndingKind.Faulted: {
        const failure = WorkflowErrorMapper.toDomain(state.failure);
        return new FaultedEnding(failure);
      }
      case EndingKind.Skipped: {
        const directive = FlowDirectiveMapper.toDomain(state.directive);
        return new SkippedEnding(state.output, directive);
      }
      case EndingKind.Completed: {
        const then = FlowDirectiveMapper.toDomain(state.directive);
        const outcome = OutcomeMapper.toDomain(state.body);
        return new CompletedEnding({
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
