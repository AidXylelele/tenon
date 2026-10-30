import { BackoffKind } from '../../../../../src/domain/automation/language/enums.js';
import { RetryStrategy } from '../../../../../src/domain/automation/language/retry-strategy.js';
import { NegativeAttemptCountError } from '../../../../../src/domain/errors.js';

function strategy(attemptCount: number): RetryStrategy {
  return new RetryStrategy({
    when: null,
    exceptWhen: null,
    delay: null,
    backoff: BackoffKind.Constant,
    attemptCount,
    attemptDuration: null,
    totalDuration: null,
    jitterFrom: null,
    jitterTo: null,
  });
}

describe('RetryStrategy', () => {
  it('an_attempt_count_of_zero_or_more_is_kept', () => {
    expect(strategy(0).attemptCount).toBe(0);
  });

  it('a_negative_attempt_count_is_refused', () => {
    const build = () => strategy(-1);

    expect(build).toThrow(NegativeAttemptCountError);
  });
});
