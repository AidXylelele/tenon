import { CatchProgress } from '../../../../domain/automation/language/progress/catch-progress.js';
import { ProgressKind } from '../../enums.js';
import type { CatchProgressState } from '../../interfaces.js';
import { AttemptMapper } from './attempt.mapper.js';
import { WorkflowErrorMapper } from './workflow-error.mapper.js';

export class CatchProgressMapper {
  static toState(progress: CatchProgress): CatchProgressState {
    const attempt = AttemptMapper.toState(progress.attempt);
    const error = WorkflowErrorMapper.toState(progress.error);
    return {
      kind: ProgressKind.Catch,
      input: progress.input,
      attempt,
      error,
    };
  }

  static toDomain(state: CatchProgressState): CatchProgress {
    const attempt = AttemptMapper.toDomain(state.attempt);
    const error = WorkflowErrorMapper.toDomain(state.error);
    return new CatchProgress({ input: state.input, attempt, error });
  }
}
