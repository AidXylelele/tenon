import { FunctionCallProgress } from '../../../../domain/automation/language/progress/function-call-progress.js';
import { ProgressKind } from '../../enums.js';
import type { FunctionCallProgressState } from '../../interfaces.js';

export class FunctionCallProgressMapper {
  static toState(progress: FunctionCallProgress): FunctionCallProgressState {
    return {
      kind: ProgressKind.FunctionCall,
      input: progress.input,
      started: progress.started,
    };
  }

  static toDomain(state: FunctionCallProgressState): FunctionCallProgress {
    return new FunctionCallProgress({
      input: state.input,
      started: state.started,
    });
  }
}
