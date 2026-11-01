import { RetryProgress } from '../../../../domain/automation/language/progress/retry-progress.js';
import { ProgressKind } from '../../enums.js';
import type { RetryProgressState } from '../../interfaces.js';
import { AttemptMapper } from './attempt.mapper.js';
import { InstantMapper } from './instant.mapper.js';

export class RetryProgressMapper {
  static toState(progress: RetryProgress): RetryProgressState {
    const attempt = AttemptMapper.toState(progress.attempt);
    const due = progress.wakeAt();
    const wakeAt = InstantMapper.toState(due);
    return {
      kind: ProgressKind.Retry,
      input: progress.input,
      attempt,
      wakeAt,
    };
  }

  static toDomain(state: RetryProgressState): RetryProgress {
    const attempt = AttemptMapper.toDomain(state.attempt);
    const wakeAt = InstantMapper.toDomain(state.wakeAt);
    return new RetryProgress({ input: state.input, attempt, wakeAt });
  }
}
