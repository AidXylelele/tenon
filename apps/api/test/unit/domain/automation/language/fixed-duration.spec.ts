import { FixedDuration } from '../../../../../src/domain/automation/language/fixed-duration.js';
import {
  CalendarDurationError,
  MalformedDurationError,
  NegativeDurationError,
  UncomputableDurationError,
} from '../../../../../src/domain/errors.js';

describe('FixedDuration', () => {
  it('an_inline_duration_keeps_its_units', () => {
    const duration = FixedDuration.inline({ days: 1, seconds: 30 });

    expect(duration.value.toString()).toBe('P1DT30S');
  });

  it('a_fraction_of_the_smallest_time_unit_is_kept', () => {
    const duration = FixedDuration.literal('PT1.5S');

    expect(duration.value.toString()).toBe('PT1.5S');
  });

  it('a_negative_inline_duration_is_refused', () => {
    const build = () => FixedDuration.inline({ seconds: -1 });

    expect(build).toThrow(NegativeDurationError);
  });

  it('a_negative_duration_from_text_is_refused', () => {
    const build = () => FixedDuration.fromValue('-PT1S');

    expect(build).toThrow(NegativeDurationError);
  });

  it.each(['P1Y', 'P1M', 'P1W'])(
    'a_duration_that_counts_calendar_units_is_refused_%s',
    (text) => {
      const build = () => FixedDuration.literal(text);

      expect(build).toThrow(CalendarDurationError);
    },
  );

  it.each(['P1.5D', 'PT1.5H30M'])(
    'a_fraction_that_is_not_in_the_smallest_time_unit_is_refused_%s',
    (text) => {
      const build = () => FixedDuration.literal(text);

      expect(build).toThrow(UncomputableDurationError);
    },
  );

  it.each([42, true, null, ['PT1S'], { seconds: '30' }])(
    'a_value_that_is_not_a_duration_is_named_so_%j',
    (value) => {
      const build = () => FixedDuration.fromValue(value);

      expect(build).toThrow(MalformedDurationError);
    },
  );
});
