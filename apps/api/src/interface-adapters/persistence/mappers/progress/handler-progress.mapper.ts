import { HandlerProgress } from '../../../../domain/automation/language/progress/handler-progress.js';
import { ProgressKind } from '../../enums.js';
import type { HandlerProgressState } from '../../interfaces.js';
import { SequenceMapper } from './sequence.mapper.js';

export class HandlerProgressMapper {
  static toState(progress: HandlerProgress): HandlerProgressState {
    const sequence = SequenceMapper.toState(progress.sequence);
    return { kind: ProgressKind.Handler, sequence };
  }

  static toDomain(state: HandlerProgressState): HandlerProgress {
    const sequence = SequenceMapper.toDomain(state.sequence);
    return new HandlerProgress(sequence);
  }
}
