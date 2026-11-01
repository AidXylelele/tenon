import { ExportStage } from '../../../../domain/automation/language/stages/export-stage.js';
import { TaskStage } from '../../enums.js';
import type { ExportStageState } from '../../interfaces.js';
import { InstantMapper } from './instant.mapper.js';
import { OutcomeMapper } from './outcome.mapper.js';

export class ExportStageMapper {
  static toState(stage: ExportStage): ExportStageState {
    const deadline = stage.deadline();
    const deadlineState = InstantMapper.toState(deadline);
    const outcome = OutcomeMapper.toState(stage.outcome);
    return {
      stage: TaskStage.Export,
      input: stage.input,
      deadline: deadlineState,
      outcome,
      output: stage.output,
    };
  }

  static toDomain(state: ExportStageState): ExportStage {
    const deadline = InstantMapper.toDomain(state.deadline);
    const outcome = OutcomeMapper.toDomain(state.outcome);
    return new ExportStage({
      input: state.input,
      deadline,
      outcome,
      output: state.output,
    });
  }
}
