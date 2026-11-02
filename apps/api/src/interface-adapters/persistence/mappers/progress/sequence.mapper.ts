import { Sequence } from '../../../../domain/automation/language/sequence.js';
import type { SequenceState } from '../../schema/interfaces.js';

export class SequenceMapper {
  static toState(sequence: Sequence): SequenceState {
    return { position: sequence.position, variables: sequence.variables };
  }

  static toDomain(state: SequenceState): Sequence {
    return new Sequence({
      position: state.position,
      variables: state.variables,
    });
  }
}
