import { OutputStage } from '../../../../domain/automation/language/stages/output-stage.js';
import { TaskStage } from '../../enums.js';
import type { OutputStageState } from '../../interfaces.js';
import { InstantMapper } from './instant.mapper.js';
import { OutcomeMapper } from './outcome.mapper.js';

export class OutputStageMapper {
  static toState(stage: OutputStage): OutputStageState {
    const deadline = stage.deadline();
    const deadlineState = InstantMapper.toState(deadline);
    const outcome = OutcomeMapper.toState(stage.outcome);
    return {
      stage: TaskStage.Output,
      input: stage.input,
      deadline: deadlineState,
      outcome,
    };
  }

  static toDomain(state: OutputStageState): OutputStage {
    const deadline = InstantMapper.toDomain(state.deadline);
    const outcome = OutcomeMapper.toDomain(state.outcome);
    return new OutputStage({ input: state.input, deadline, outcome });
  }
}
