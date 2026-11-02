import type { ProcessRun } from '../../../../domain/automation/language/interfaces.js';
import type { ProcessRunState } from '../../schema/interfaces.js';
import { InstantMapper } from './instant.mapper.js';

export class ProcessRunMapper {
  static toState(run: ProcessRun): ProcessRunState;
  static toState(run: ProcessRun | null): ProcessRunState | null;
  static toState(run: ProcessRun | null): ProcessRunState | null {
    if (run === null) return null;

    const deadline = InstantMapper.toState(run.deadline);
    return {
      id: run.id,
      kind: run.kind,
      language: run.language,
      process: run.process,
      deadline,
    };
  }

  static toDomain(state: ProcessRunState): ProcessRun;
  static toDomain(state: ProcessRunState | null): ProcessRun | null;
  static toDomain(state: ProcessRunState | null): ProcessRun | null {
    if (state === null) return null;

    const stored = state.deadline ?? null;
    const deadline = InstantMapper.toDomain(stored);
    return {
      id: state.id,
      kind: state.kind,
      language: state.language,
      process: state.process,
      deadline,
    };
  }
}
