import { EndedStage } from '../../../../domain/automation/language/stages/ended-stage.js';
import { TaskStage } from '../../enums.js';
import type { EndedStageState } from '../../interfaces.js';
import { TaskEndingMapper } from './task-ending.mapper.js';

export class EndedStageMapper {
  static toState(stage: EndedStage): EndedStageState {
    const ending = TaskEndingMapper.toState(stage.ending());
    return { stage: TaskStage.Ended, ending };
  }

  static toDomain(state: EndedStageState): EndedStage {
    const ending = TaskEndingMapper.toDomain(state.ending);
    return new EndedStage(ending);
  }
}
