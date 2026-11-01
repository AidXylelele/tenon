import { ConcludedProgress } from '../../../../domain/automation/language/progress/concluded-progress.js';
import { ProgressKind } from '../../enums.js';
import type { ConcludedProgressState } from '../../interfaces.js';
import { OutcomeMapper } from './outcome.mapper.js';

export class ConcludedProgressMapper {
  static toState(progress: ConcludedProgress): ConcludedProgressState {
    const outcome = OutcomeMapper.toState(progress.outcome());
    return { kind: ProgressKind.Concluded, outcome };
  }

  static toDomain(state: ConcludedProgressState): ConcludedProgress {
    const outcome = OutcomeMapper.toDomain(state.outcome);
    return new ConcludedProgress(outcome);
  }
}
