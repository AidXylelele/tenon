import { ForProgress } from '../../../../domain/automation/language/progress/for-progress.js';
import { ProgressKind } from '../../enums.js';
import type { ForProgressState } from '../../interfaces.js';
import { SequenceMapper } from './sequence.mapper.js';

export class ForProgressMapper {
  static toState(progress: ForProgress): ForProgressState {
    const sequence = SequenceMapper.toState(progress.sequence);
    return {
      kind: ProgressKind.For,
      input: progress.input,
      items: progress.items,
      index: progress.index,
      data: progress.data,
      sequence,
    };
  }

  static toDomain(state: ForProgressState): ForProgress {
    const sequence = SequenceMapper.toDomain(state.sequence);
    return new ForProgress({
      input: state.input,
      items: state.items,
      index: state.index,
      data: state.data,
      sequence,
    });
  }
}
