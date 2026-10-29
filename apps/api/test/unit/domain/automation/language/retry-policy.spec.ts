import { Findings } from '../../../../../src/domain/automation/language/findings.js';
import type { ParsedRetryPolicy } from '../../../../../src/domain/automation/language/interfaces.js';
import { RetryPolicy } from '../../../../../src/domain/automation/language/retry-policy.js';
import { Scope } from '../../../../../src/domain/automation/language/scope.js';

const now = new Date('2026-06-01T00:00:00Z');

function policy(parsed: ParsedRetryPolicy): RetryPolicy {
  const findings = new Findings();
  const scope = Scope.root(findings).at('retry');
  return RetryPolicy.read(parsed, scope);
}

describe('RetryPolicy', () => {
  it('the_attempt_count_bounds_the_retries', () => {
    const limited = policy({ limit: { attempt: { count: 3 } } });

    expect(limited.allows(3, 0, now)).toBe(true);
    expect(limited.allows(4, 0, now)).toBe(false);
  });

  it('the_total_duration_bounds_the_retries', () => {
    const limited = policy({ limit: { duration: 'PT10S' } });

    expect(limited.allows(50, 9_999, now)).toBe(true);
    expect(limited.allows(2, 10_000, now)).toBe(false);
  });

  it.each([
    [{ constant: {} }, [1_000, 1_000, 1_000]],
    [{ linear: {} }, [1_000, 2_000, 3_000]],
    [{ exponential: {} }, [1_000, 2_000, 4_000]],
  ])('the_backoff_%j_grows_the_delay_as_its_kind_says', (backoff, delays) => {
    const backedOff = policy({ delay: 'PT1S', backoff });
    const computed = [1, 2, 3].map((attempt) =>
      backedOff.delayFor(attempt, 0, now),
    );

    expect(computed).toEqual(delays);
  });

  it('jitter_adds_a_share_of_its_range_given_by_the_sample', () => {
    const jittered = policy({
      delay: 'PT1S',
      jitter: { from: 'PT0S', to: 'PT2S' },
    });

    expect(jittered.delayFor(1, 0.25, now)).toBe(1_500);
  });
});
