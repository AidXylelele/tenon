import { DurationFactory } from '../../../../../src/domain/automation/language/duration-factory.js';
import { ExpressionDuration } from '../../../../../src/domain/automation/language/expression-duration.js';
import { Findings } from '../../../../../src/domain/automation/language/findings.js';
import { FixedDuration } from '../../../../../src/domain/automation/language/fixed-duration.js';
import type { ParsedDuration } from '../../../../../src/domain/automation/language/interfaces.js';
import { Scope } from '../../../../../src/domain/automation/language/scope.js';

function read(parsed: ParsedDuration) {
  const findings = new Findings();
  const scope = Scope.root(findings).at('after');
  const duration = DurationFactory.read(parsed, scope);
  return { duration, problems: findings.problems };
}

function fixed(parsed: ParsedDuration): FixedDuration {
  const { duration } = read(parsed);

  if (!(duration instanceof FixedDuration))
    throw new TypeError('expected a fixed duration');

  return duration;
}

describe('Duration', () => {
  it('a_month_ends_on_the_calendar_day_it_reaches', () => {
    const month = fixed('P1M');
    const fromJanuary = new Date('2026-01-31T00:00:00Z');
    const fromMarch = new Date('2026-03-01T00:00:00Z');

    expect(month.endFrom(fromJanuary).toISOString()).toBe(
      '2026-02-28T00:00:00.000Z',
    );
    expect(month.endFrom(fromMarch).toISOString()).toBe(
      '2026-04-01T00:00:00.000Z',
    );
  });

  it('an_inline_duration_counts_its_units', () => {
    const duration = fixed({ days: 1, seconds: 30 });
    const start = new Date('2026-06-01T00:00:00Z');

    expect(duration.milliseconds(start)).toBe(86_430_000);
  });

  it('a_fraction_of_seconds_is_kept', () => {
    const duration = fixed('PT1.5S');
    const start = new Date('2026-06-01T00:00:00Z');

    expect(duration.milliseconds(start)).toBe(1_500);
  });

  it('a_runtime_expression_is_a_duration_to_evaluate', () => {
    const { duration } = read('${ .delay }');

    expect(duration).toBeInstanceOf(ExpressionDuration);
    expect((duration as ExpressionDuration).expression.program).toBe('.delay');
  });

  it.each([
    [
      'P1.5Y',
      'a fraction of years, months, weeks or days in a duration is outside the supported subset',
    ],
    [
      'P0.5D',
      'a fraction of years, months, weeks or days in a duration is outside the supported subset',
    ],
    ['soon', 'Not an ISO 8601 duration'],
  ])('%s_is_refused', (text, reason) => {
    const { duration, problems } = read(text);

    expect(duration).toBeNull();
    expect(
      problems.map((problem) => [problem.pointer, problem.reason]),
    ).toEqual([['/after', reason]]);
  });
});
