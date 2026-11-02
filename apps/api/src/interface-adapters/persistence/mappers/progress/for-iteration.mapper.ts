import { ForIteration } from '../../../../domain/automation/language/for-iteration.js';
import type { ForIterationState } from '../../schema/interfaces.js';

export class ForIterationMapper {
  static toState(iteration: ForIteration): ForIterationState {
    return {
      items: iteration.items,
      index: iteration.index,
      data: iteration.data,
    };
  }

  static toDomain(state: ForIterationState): ForIteration {
    return new ForIteration({
      items: state.items,
      index: state.index,
      data: state.data,
    });
  }
}
