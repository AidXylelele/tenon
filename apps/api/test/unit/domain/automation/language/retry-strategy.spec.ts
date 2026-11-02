import { Attempt } from '../../../../../src/domain/automation/language/attempt.js';
import { ConstantBackoff } from '../../../../../src/domain/automation/language/backoffs/constant-backoff.js';
import { ExponentialBackoff } from '../../../../../src/domain/automation/language/backoffs/exponential-backoff.js';
import { LinearBackoff } from '../../../../../src/domain/automation/language/backoffs/linear-backoff.js';
import { FixedDuration } from '../../../../../src/domain/automation/language/fixed-duration.js';
import type { RetryStrategyProps } from '../../../../../src/domain/automation/language/interfaces.js';
import { ErrorCondition } from '../../../../../src/domain/automation/language/error-condition.js';
import { RetryStrategy } from '../../../../../src/domain/automation/language/retry-strategy.js';
import { NegativeAttemptCountError } from '../../../../../src/domain/errors.js';

const second = FixedDuration.inline({ seconds: 1 });

function strategy(changes: Partial<RetryStrategyProps> = {}): RetryStrategy {
  return new RetryStrategy({
    condition: ErrorCondition.none(),
    delay: changes.delay ?? second,
    backoff: changes.backoff ?? new ConstantBackoff(),
    attemptCount: changes.attemptCount ?? null,
    totalDuration: changes.totalDuration ?? null,
    jitterFrom: changes.jitterFrom ?? null,
    jitterTo: changes.jitterTo ?? null,
  });
}

const start = new Date('2026-10-31T10:00:00.000Z');

describe('RetryStrategy', () => {
  it('an_attempt_count_of_zero_is_kept_and_a_negative_one_is_refused', () => {
    const zero = () => strategy({ attemptCount: 0 });
    const negative = () => strategy({ attemptCount: -1 });

    expect(zero).not.toThrow();
    expect(negative).toThrow(NegativeAttemptCountError);
  });

  it.each([
    { backoff: new ConstantBackoff(), delays: [1000, 1000, 1000] },
    { backoff: new LinearBackoff(), delays: [1000, 2000, 3000] },
    { backoff: new ExponentialBackoff(), delays: [1000, 2000, 4000] },
  ])('the_backoff_scales_the_delay_by_attempt', ({ backoff, delays }) => {
    const retry = strategy({ backoff });

    const computed = [1, 2, 3].map((count) => {
      const attempt = new Attempt({ count, firstStartedAt: start });
      const resumes = retry.resumesAt(attempt, 'w', start).time;
      return (resumes?.getTime() ?? 0) - start.getTime();
    });

    expect(computed).toEqual(delays);
  });

  it('jitter_adds_a_share_of_its_range_that_is_stable_for_a_work_id', () => {
    const retry = strategy({
      jitterFrom: FixedDuration.inline({ milliseconds: 100 }),
      jitterTo: FixedDuration.inline({ milliseconds: 300 }),
    });

    const attempt = new Attempt({ count: 1, firstStartedAt: start });
    const first = retry.resumesAt(attempt, 'task-1:retry-1', start).time;
    const again = retry.resumesAt(attempt, 'task-1:retry-1', start).time;
    const delay = (first?.getTime() ?? 0) - start.getTime();

    expect(first).toEqual(again);
    expect(delay).toBeGreaterThanOrEqual(1100);
    expect(delay).toBeLessThan(1300);
  });

  it('the_limits_bound_the_attempts_and_the_whole_window', () => {
    const counted = strategy({ attemptCount: 2 });
    const window = strategy({
      totalDuration: FixedDuration.inline({ seconds: 10 }),
    });
    const shorter = strategy({
      delay: FixedDuration.inline({ milliseconds: 500 }),
      totalDuration: FixedDuration.inline({ seconds: 10 }),
    });
    const now = new Date(start.getTime() + 9500);
    const first = new Attempt({ count: 1, firstStartedAt: start });
    const second = first.next();
    const third = second.next();

    expect(counted.resumesAt(second, 'w', now).isNone()).toBe(false);
    expect(counted.resumesAt(third, 'w', now).isNone()).toBe(true);
    expect(window.resumesAt(first, 'w', now).isNone()).toBe(true);
    expect(shorter.resumesAt(first, 'w', now).isNone()).toBe(false);
  });
});
