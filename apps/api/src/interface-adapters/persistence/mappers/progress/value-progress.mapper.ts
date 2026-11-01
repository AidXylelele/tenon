import { ValueProgress } from '../../../../domain/automation/language/progress/value-progress.js';
import { ProgressKind } from '../../enums.js';
import type { ValueProgressState } from '../../interfaces.js';

export class ValueProgressMapper {
  static toState(progress: ValueProgress): ValueProgressState {
    return { kind: ProgressKind.Value, input: progress.input };
  }

  static toDomain(state: ValueProgressState): ValueProgress {
    return new ValueProgress(state.input);
  }
}
