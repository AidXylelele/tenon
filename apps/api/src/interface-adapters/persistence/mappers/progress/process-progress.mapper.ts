import { ProcessProgress } from '../../../../domain/automation/language/progress/process-progress.js';
import { ProgressKind } from '../../enums.js';
import type { ProcessProgressState } from '../../interfaces.js';
import { ProcessRunMapper } from './process-run.mapper.js';

export class ProcessProgressMapper {
  static toState(progress: ProcessProgress): ProcessProgressState {
    const run = ProcessRunMapper.toState(progress.run);
    return { kind: ProgressKind.Process, input: progress.input, run };
  }

  static toDomain(state: ProcessProgressState): ProcessProgress {
    const run = ProcessRunMapper.toDomain(state.run);
    return new ProcessProgress({ input: state.input, run });
  }
}
