import { Attempt } from '../../../../../src/domain/automation/language/attempt.js';
import { InconsistentProgressError } from '../../../../../src/domain/errors.js';

describe('Attempt', () => {
  const start = new Date('2026-11-01T10:00:00.000Z');

  it('the_next_attempt_counts_on_from_the_same_first_start', () => {
    const next = Attempt.first(start).next();

    expect(next.count).toBe(1);
    expect(next.firstStartedAt).toBe(start);
  });

  it('an_attempt_below_zero_is_refused', () => {
    const build = () => new Attempt({ count: -1, firstStartedAt: start });

    expect(build).toThrow(InconsistentProgressError);
  });
});
