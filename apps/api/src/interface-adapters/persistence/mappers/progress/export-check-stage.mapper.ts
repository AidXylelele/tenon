import { ExportCheckStage } from '../../../../domain/automation/language/stages/export-check-stage.js';
import { TaskStage } from '../../enums.js';
import type { ExportCheckStageState } from '../../interfaces.js';
import { InstantMapper } from './instant.mapper.js';
import { OutcomeMapper } from './outcome.mapper.js';

export class ExportCheckStageMapper {
  static toState(stage: ExportCheckStage): ExportCheckStageState {
    const deadline = stage.deadline();
    const deadlineState = InstantMapper.toState(deadline);
    const outcome = OutcomeMapper.toState(stage.outcome);
    return {
      stage: TaskStage.ExportCheck,
      deadline: deadlineState,
      outcome,
      output: stage.output,
      context: stage.context,
      exported: stage.exported,
    };
  }

  static toDomain(state: ExportCheckStageState): ExportCheckStage {
    const deadline = InstantMapper.toDomain(state.deadline);
    const outcome = OutcomeMapper.toDomain(state.outcome);
    return new ExportCheckStage({
      deadline,
      outcome,
      output: state.output,
      context: state.context,
      exported: state.exported,
    });
  }
}
