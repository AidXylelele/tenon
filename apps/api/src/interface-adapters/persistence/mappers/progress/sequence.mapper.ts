import { Sequence } from '../../../../domain/automation/language/sequence.js';
import type { SequenceState } from '../../interfaces.js';
import { OutcomeMapper } from './outcome.mapper.js';

export class SequenceMapper {
  static toState(sequence: Sequence): SequenceState;
  static toState(sequence: Sequence | null): SequenceState | null;
  static toState(sequence: Sequence | null): SequenceState | null {
    if (sequence === null) return null;

    const outcome = OutcomeMapper.toState(sequence.outcome);
    return {
      position: sequence.position,
      variables: sequence.variables,
      outcome,
    };
  }

  static toDomain(state: SequenceState): Sequence;
  static toDomain(state: SequenceState | null): Sequence | null;
  static toDomain(state: SequenceState | null): Sequence | null {
    if (state === null) return null;

    const outcome = OutcomeMapper.toDomain(state.outcome);
    return new Sequence({
      position: state.position,
      variables: state.variables,
      outcome,
    });
  }
}
