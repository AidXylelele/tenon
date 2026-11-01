import { Attempt } from '../../../../domain/automation/language/attempt.js';
import type { AttemptState } from '../../interfaces.js';
import { InstantMapper } from './instant.mapper.js';

export class AttemptMapper {
  static toState(attempt: Attempt): AttemptState {
    const firstStartedAt = InstantMapper.toState(attempt.firstStartedAt);
    return { count: attempt.count, firstStartedAt };
  }

  static toDomain(state: AttemptState): Attempt {
    const firstStartedAt = InstantMapper.toDomain(state.firstStartedAt);
    return new Attempt({ count: state.count, firstStartedAt });
  }
}
