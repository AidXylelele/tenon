import { BodyStage } from '../../../../domain/automation/language/stages/body-stage.js';
import { TaskStage } from '../../enums.js';
import type { BodyStageState } from '../../interfaces.js';
import { InstantMapper } from './instant.mapper.js';
import { KindProgressMapper } from './kind-progress.mapper.js';

export class BodyStageMapper {
  static toState(stage: BodyStage): BodyStageState {
    const deadline = stage.deadline();
    const deadlineState = InstantMapper.toState(deadline);
    const body = KindProgressMapper.toState(stage.body);
    return {
      stage: TaskStage.Body,
      input: stage.input,
      deadline: deadlineState,
      body,
    };
  }

  static toDomain(state: BodyStageState): BodyStage {
    const deadline = InstantMapper.toDomain(state.deadline);
    const body = KindProgressMapper.toDomain(state.body);
    return new BodyStage({ input: state.input, deadline, body });
  }
}
