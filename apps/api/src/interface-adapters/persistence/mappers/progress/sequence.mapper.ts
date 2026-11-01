import { Sequence } from '../../../../domain/automation/language/sequence.js';
import type { SequenceState } from '../../interfaces.js';

export class SequenceMapper {
  static toState(sequence: Sequence): SequenceState;
  static toState(sequence: Sequence | null): SequenceState | null;
  static toState(sequence: Sequence | null): SequenceState | null {
    if (sequence === null) return null;

    return { position: sequence.position, variables: sequence.variables };
  }

  static toDomain(state: SequenceState): Sequence;
  static toDomain(state: SequenceState | null): Sequence | null;
  static toDomain(state: SequenceState | null): Sequence | null {
    if (state === null) return null;

    return new Sequence({
      position: state.position,
      variables: state.variables,
    });
  }
}
