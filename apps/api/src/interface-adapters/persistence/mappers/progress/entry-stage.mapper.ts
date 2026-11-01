import { EntryStage } from '../../../../domain/automation/language/stages/entry-stage.js';
import { TaskStage } from '../../enums.js';
import type { EntryStageState } from '../../interfaces.js';

export class EntryStageMapper {
  static toState(): EntryStageState {
    return { stage: TaskStage.Entry };
  }

  static toDomain(): EntryStage {
    return new EntryStage();
  }
}
