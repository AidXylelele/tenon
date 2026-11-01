import { BodyStage } from '../../../../domain/automation/language/stages/body-stage.js';
import { EndedStage } from '../../../../domain/automation/language/stages/ended-stage.js';
import { EntryStage } from '../../../../domain/automation/language/stages/entry-stage.js';
import { ExportCheckStage } from '../../../../domain/automation/language/stages/export-check-stage.js';
import { ExportStage } from '../../../../domain/automation/language/stages/export-stage.js';
import { OutputStage } from '../../../../domain/automation/language/stages/output-stage.js';
import type { TaskProgress } from '../../../../domain/automation/language/stages/task-progress.js';
import { TaskStage } from '../../enums.js';
import type { TaskProgressState } from '../../interfaces.js';
import { BodyStageMapper } from './body-stage.mapper.js';
import { EndedStageMapper } from './ended-stage.mapper.js';
import { EntryStageMapper } from './entry-stage.mapper.js';
import { ExportCheckStageMapper } from './export-check-stage.mapper.js';
import { ExportStageMapper } from './export-stage.mapper.js';
import { OutputStageMapper } from './output-stage.mapper.js';

export class TaskProgressMapper {
  static toState(progress: TaskProgress): TaskProgressState {
    if (progress instanceof EntryStage) return EntryStageMapper.toState();

    if (progress instanceof BodyStage) return BodyStageMapper.toState(progress);

    if (progress instanceof OutputStage)
      return OutputStageMapper.toState(progress);

    if (progress instanceof ExportStage)
      return ExportStageMapper.toState(progress);

    if (progress instanceof ExportCheckStage)
      return ExportCheckStageMapper.toState(progress);

    if (progress instanceof EndedStage)
      return EndedStageMapper.toState(progress);

    throw new Error('A task stage the progress mapper does not know');
  }

  static toDomain(state: TaskProgressState): TaskProgress {
    if (state.stage === TaskStage.Entry) return EntryStageMapper.toDomain();

    if (state.stage === TaskStage.Body) return BodyStageMapper.toDomain(state);

    if (state.stage === TaskStage.Output)
      return OutputStageMapper.toDomain(state);

    if (state.stage === TaskStage.Export)
      return ExportStageMapper.toDomain(state);

    if (state.stage === TaskStage.ExportCheck)
      return ExportCheckStageMapper.toDomain(state);

    return EndedStageMapper.toDomain(state);
  }
}
