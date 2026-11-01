import { DoProgress } from '../../../../domain/automation/language/progress/do-progress.js';
import { ProgressKind } from '../../enums.js';
import type { DoProgressState } from '../../interfaces.js';
import { SequenceMapper } from './sequence.mapper.js';

export class DoProgressMapper {
  static toState(progress: DoProgress): DoProgressState {
    const sequence = SequenceMapper.toState(progress.sequence);
    return { kind: ProgressKind.Do, sequence };
  }

  static toDomain(state: DoProgressState): DoProgress {
    const sequence = SequenceMapper.toDomain(state.sequence);
    return new DoProgress(sequence);
  }
}
