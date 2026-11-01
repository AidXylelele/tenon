import { TryProgress } from '../../../../domain/automation/language/progress/try-progress.js';
import { ProgressKind } from '../../enums.js';
import type { TryProgressState } from '../../interfaces.js';
import { AttemptMapper } from './attempt.mapper.js';
import { SequenceMapper } from './sequence.mapper.js';

export class TryProgressMapper {
  static toState(progress: TryProgress): TryProgressState {
    const attempt = AttemptMapper.toState(progress.attempt);
    const sequence = SequenceMapper.toState(progress.sequence);
    return {
      kind: ProgressKind.Try,
      input: progress.input,
      attempt,
      sequence,
    };
  }

  static toDomain(state: TryProgressState): TryProgress {
    const attempt = AttemptMapper.toDomain(state.attempt);
    const sequence = SequenceMapper.toDomain(state.sequence);
    return new TryProgress({ input: state.input, attempt, sequence });
  }
}
