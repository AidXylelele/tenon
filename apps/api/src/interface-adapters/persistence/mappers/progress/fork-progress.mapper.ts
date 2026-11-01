import { ForkProgress } from '../../../../domain/automation/language/progress/fork-progress.js';
import { ProgressKind } from '../../enums.js';
import type { ForkProgressState } from '../../interfaces.js';

export class ForkProgressMapper {
  static toState(progress: ForkProgress): ForkProgressState {
    return {
      kind: ProgressKind.Fork,
      outputs: progress.outputs,
      pending: progress.pending,
    };
  }

  static toDomain(state: ForkProgressState): ForkProgress {
    return new ForkProgress({
      outputs: state.outputs,
      pending: state.pending,
    });
  }
}
