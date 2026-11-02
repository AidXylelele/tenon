import { InconsistentProgressError } from '../../../../domain/errors.js';
import { BodyStage } from '../../../../domain/automation/language/stages/body-stage.js';
import { EndedStage } from '../../../../domain/automation/language/stages/ended-stage.js';
import { EntryStage } from '../../../../domain/automation/language/stages/entry-stage.js';
import { ExportCheckStage } from '../../../../domain/automation/language/stages/export-check-stage.js';
import { ExportStage } from '../../../../domain/automation/language/stages/export-stage.js';
import { OutputStage } from '../../../../domain/automation/language/stages/output-stage.js';
import type { TaskProgress } from '../../../../domain/automation/language/stages/task-progress.js';
import { TaskStage } from '../../enums.js';
import type { TaskProgressState } from '../../interfaces.js';
import { InstantMapper } from './instant.mapper.js';
import { KindProgressMapper } from './kind-progress.mapper.js';
import { OutcomeMapper } from './outcome.mapper.js';
import { TaskEndingMapper } from './task-ending.mapper.js';
import { DueTime } from '../../../../domain/automation/language/due-time.js';

export class TaskProgressMapper {
  static readonly #UNSTORED = 'a task stage the platform does not store';

  static toState(progress: TaskProgress): TaskProgressState {
    const deadline = progress.deadline();
    const deadlineState = InstantMapper.toState(deadline.time);

    if (progress instanceof EntryStage) return { stage: TaskStage.Entry };

    if (progress instanceof BodyStage) {
      const body = KindProgressMapper.toState(progress.body);
      return {
        stage: TaskStage.Body,
        input: progress.input,
        deadline: deadlineState,
        body,
      };
    }

    if (progress instanceof OutputStage) {
      const outcome = OutcomeMapper.toState(progress.outcome);
      return {
        stage: TaskStage.Output,
        input: progress.input,
        deadline: deadlineState,
        outcome,
      };
    }

    if (progress instanceof ExportStage) {
      const outcome = OutcomeMapper.toState(progress.outcome);
      return {
        stage: TaskStage.Export,
        input: progress.input,
        deadline: deadlineState,
        outcome,
        output: progress.output,
      };
    }

    if (progress instanceof ExportCheckStage) {
      const outcome = OutcomeMapper.toState(progress.outcome);
      return {
        stage: TaskStage.ExportCheck,
        deadline: deadlineState,
        outcome,
        output: progress.output,
        context: progress.context,
        exported: progress.exported,
      };
    }

    if (progress instanceof EndedStage) {
      const ending = TaskEndingMapper.toState(progress.ending());
      return { stage: TaskStage.Ended, ending };
    }

    throw new InconsistentProgressError(TaskProgressMapper.#UNSTORED);
  }

  static toDomain(state: TaskProgressState): TaskProgress {
    switch (state.stage) {
      case TaskStage.Entry:
        return new EntryStage();
      case TaskStage.Body: {
        const due = InstantMapper.toDomain(state.deadline);
        const deadline = DueTime.of(due);
        const body = KindProgressMapper.toDomain(state.body);
        return new BodyStage({ input: state.input, deadline, body });
      }
      case TaskStage.Output: {
        const due = InstantMapper.toDomain(state.deadline);
        const deadline = DueTime.of(due);
        const outcome = OutcomeMapper.toDomain(state.outcome);
        return new OutputStage({ input: state.input, deadline, outcome });
      }
      case TaskStage.Export: {
        const due = InstantMapper.toDomain(state.deadline);
        const deadline = DueTime.of(due);
        const outcome = OutcomeMapper.toDomain(state.outcome);
        return new ExportStage({
          input: state.input,
          deadline,
          outcome,
          output: state.output,
        });
      }
      case TaskStage.ExportCheck: {
        const due = InstantMapper.toDomain(state.deadline);
        const deadline = DueTime.of(due);
        const outcome = OutcomeMapper.toDomain(state.outcome);
        return new ExportCheckStage({
          deadline,
          outcome,
          output: state.output,
          context: state.context,
          exported: state.exported,
        });
      }
      case TaskStage.Ended: {
        const ending = TaskEndingMapper.toDomain(state.ending);
        return new EndedStage(ending);
      }
      default:
        throw new InconsistentProgressError(TaskProgressMapper.#UNSTORED);
    }
  }
}
