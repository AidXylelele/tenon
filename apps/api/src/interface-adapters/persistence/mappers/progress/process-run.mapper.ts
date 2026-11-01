import type { ProcessRun } from '../../../../domain/automation/language/interfaces.js';
import type { ProcessRunState } from '../../interfaces.js';

export class ProcessRunMapper {
  static toState(run: ProcessRun | null): ProcessRunState | null {
    if (run === null) return null;

    return {
      id: run.id,
      kind: run.kind,
      language: run.language,
      process: run.process,
    };
  }

  static toDomain(state: ProcessRunState | null): ProcessRun | null {
    if (state === null) return null;

    return {
      id: state.id,
      kind: state.kind,
      language: state.language,
      process: state.process,
    };
  }
}
