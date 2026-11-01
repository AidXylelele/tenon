import { SwitchProgress } from '../../../../domain/automation/language/progress/switch-progress.js';
import { ProgressKind } from '../../enums.js';
import type { SwitchProgressState } from '../../interfaces.js';

export class SwitchProgressMapper {
  static toState(progress: SwitchProgress): SwitchProgressState {
    return { kind: ProgressKind.Switch, input: progress.input };
  }

  static toDomain(state: SwitchProgressState): SwitchProgress {
    return new SwitchProgress(state.input);
  }
}
