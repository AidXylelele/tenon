import { NodeUserError } from '../../../src/interface-adapters/node-types/node-user-error.js';
import { DateTimeNode } from '../../../src/interface-adapters/node-types/types/date-time.node.js';
import { field, fixed, runNode } from '../../support/node-runs.js';

const items = [
  { order: 'A-1', created: '2026-01-31T12:00:00Z' },
  { order: 'A-2', created: '2026-10-16T22:30:15Z' },
];

const dateTime = (
  parameters: Record<string, unknown>,
  input: { items?: Record<string, unknown>[]; timezone?: string } = {},
) =>
  runNode(new DateTimeNode(), {
    items: input.items ?? items,
    timezone: input.timezone,
    parameters,
  });

const single = (date: unknown, parameters: Record<string, unknown>) =>
  dateTime({ date: fixed(date), ...parameters }, { items: [{}] });

describe('Date & Time', () => {
  it('writes_the_current_moment_in_the_workflow_time_zone_by_default', async () => {
    const result = await dateTime({}, { timezone: 'Europe/Kyiv' });
    expect(result.main).toEqual([
      {
        order: 'A-1',
        created: '2026-01-31T12:00:00Z',
        date: '2026-10-16T13:00:00.000+03:00',
      },
      {
        order: 'A-2',
        created: '2026-10-16T22:30:15Z',
        date: '2026-10-16T13:00:00.000+03:00',
      },
    ]);
  });

  it('writes_the_current_moment_in_the_chosen_time_zone_into_the_output_field', async () => {
    const result = await dateTime({
      operation: fixed('currentDate'),
      timezone: fixed('America/New_York'),
      outputField: fixed('stamps.now'),
    });
    expect(result.main?.[0]).toEqual({
      order: 'A-1',
      created: '2026-01-31T12:00:00Z',
      stamps: { now: '2026-10-16T06:00:00.000-04:00' },
    });
  });

  it('adds_an_amount_of_a_unit_to_the_date_of_each_item', async () => {
    const result = await dateTime({
      operation: fixed('addToDate'),
      date: field('created'),
      amount: fixed(1),
      unit: fixed('months'),
    });
    expect(result.main?.map((item) => item.date)).toEqual([
      '2026-02-28T12:00:00.000Z',
      '2026-11-16T22:30:15.000Z',
    ]);
  });

  it('adds_one_day_by_default', async () => {
    const result = await single('2026-10-16T10:00:00Z', {
      operation: fixed('addToDate'),
    });
    expect(result.main).toEqual([{ date: '2026-10-17T10:00:00.000Z' }]);
  });

  it('subtracts_an_amount_of_a_unit_from_epoch_milliseconds', async () => {
    const result = await single(1792144800000, {
      operation: fixed('subtractFromDate'),
      amount: fixed(2),
      unit: fixed('hours'),
    });
    expect(result.main).toEqual([{ date: '2026-10-16T08:00:00.000Z' }]);
  });

  it('formats_a_date_with_a_luxon_format_in_the_time_zone', async () => {
    const result = await single('2026-10-16T22:30:15Z', {
      operation: fixed('formatDate'),
      format: fixed('yyyy-MM-dd HH:mm'),
      timezone: fixed('Europe/Kyiv'),
    });
    expect(result.main).toEqual([{ date: '2026-10-17 01:30' }]);
  });

  it('formats_as_iso_when_no_format_is_given', async () => {
    const result = await single('2026-10-16T22:30:15Z', {
      operation: fixed('formatDate'),
      timezone: fixed('Europe/Kyiv'),
    });
    expect(result.main).toEqual([{ date: '2026-10-17T01:30:15.000+03:00' }]);
  });

  it('reads_a_date_without_an_offset_in_the_time_zone', async () => {
    const result = await single('2026-10-16', {
      operation: fixed('formatDate'),
      timezone: fixed('Europe/Kyiv'),
    });
    expect(result.main).toEqual([{ date: '2026-10-16T00:00:00.000+03:00' }]);
  });

  it('rounds_a_date_down_to_the_start_of_the_unit', async () => {
    const result = await single('2026-10-16T13:45:10Z', {
      operation: fixed('roundDate'),
      unit: fixed('hours'),
    });
    expect(result.main).toEqual([{ date: '2026-10-16T13:00:00.000Z' }]);
  });

  it('rounds_a_date_in_the_time_zone', async () => {
    const result = await single('2026-10-16T22:30:15Z', {
      operation: fixed('roundDate'),
      unit: fixed('days'),
      timezone: fixed('Europe/Kyiv'),
    });
    expect(result.main).toEqual([{ date: '2026-10-17T00:00:00.000+03:00' }]);
  });

  it('rounds_a_date_up_to_the_start_of_the_next_unit', async () => {
    const result = await single('2026-10-16T13:45:10Z', {
      operation: fixed('roundDate'),
      unit: fixed('days'),
      rounding: fixed('up'),
    });
    expect(result.main).toEqual([{ date: '2026-10-17T00:00:00.000Z' }]);
  });

  it('rounding_up_keeps_a_date_already_at_the_start_of_the_unit', async () => {
    const result = await single('2026-10-01T00:00:00Z', {
      operation: fixed('roundDate'),
      unit: fixed('months'),
      rounding: fixed('up'),
    });
    expect(result.main).toEqual([{ date: '2026-10-01T00:00:00.000Z' }]);
  });

  it('measures_the_time_between_two_dates_in_the_unit', async () => {
    const between = (unit: string) =>
      single('2026-10-16T10:00:00Z', {
        operation: fixed('getTimeBetweenDates'),
        endDate: fixed('2026-10-17T22:00:00Z'),
        unit: fixed(unit),
      });
    expect((await between('days')).main).toEqual([{ date: 1.5 }]);
    expect((await between('hours')).main).toEqual([{ date: 36 }]);
  });

  it('the_time_between_is_negative_when_the_end_date_is_earlier', async () => {
    const result = await single('2026-10-16T10:00:00Z', {
      operation: fixed('getTimeBetweenDates'),
      endDate: fixed('2026-10-16T08:00:00Z'),
      unit: fixed('minutes'),
    });
    expect(result.main).toEqual([{ date: -120 }]);
  });

  it('extracts_the_year_by_default', async () => {
    const result = await single('2026-10-16T22:30:15Z', {
      operation: fixed('extractDate'),
    });
    expect(result.main).toEqual([{ date: 2026 }]);
  });

  it('extracts_the_month_iso_week_day_hour_minute_or_second_in_the_time_zone', async () => {
    const extract = async (part: string) => {
      const result = await single('2026-10-16T22:30:15Z', {
        operation: fixed('extractDate'),
        part: fixed(part),
        timezone: fixed('Europe/Kyiv'),
      });
      return result.main?.[0]?.date;
    };
    expect(await extract('month')).toBe(10);
    expect(await extract('week')).toBe(42);
    expect(await extract('day')).toBe(17);
    expect(await extract('hour')).toBe(1);
    expect(await extract('minute')).toBe(30);
    expect(await extract('second')).toBe(15);
  });

  it('does_not_change_the_input_items', async () => {
    const original = structuredClone(items);
    await dateTime({ operation: fixed('addToDate'), date: field('created') });
    expect(items).toEqual(original);
  });

  it('an_unreadable_date_fails_the_node_with_the_parameter_and_the_item', async () => {
    const run = dateTime(
      { operation: fixed('formatDate'), date: field('created') },
      { items: [{ created: '2026-10-16' }, { created: 'next tuesday' }] },
    );
    await expect(run).rejects.toBeInstanceOf(NodeUserError);
    await expect(run).rejects.toMatchObject({ parameter: 'date', item: 1 });
  });

  it('a_missing_end_date_fails_the_node_with_the_end_date_parameter', async () => {
    await expect(
      single('2026-10-16T10:00:00Z', {
        operation: fixed('getTimeBetweenDates'),
      }),
    ).rejects.toMatchObject({ parameter: 'endDate', item: 0 });
  });

  it('an_unknown_time_zone_fails_the_node_with_the_time_zone_parameter', async () => {
    await expect(
      dateTime({ timezone: fixed('Mars/Olympus') }),
    ).rejects.toMatchObject({ parameter: 'timezone', item: 0 });
  });

  it('a_result_outside_the_supported_date_range_fails_the_node_with_the_amount_parameter', async () => {
    await expect(
      single('2026-10-16T10:00:00Z', {
        operation: fixed('addToDate'),
        amount: fixed(1e9),
        unit: fixed('years'),
      }),
    ).rejects.toMatchObject({ parameter: 'amount', item: 0 });
  });

  it('accepts_only_a_fixed_operation', () => {
    expect(new DateTimeNode().fixedParameters).toEqual(['operation']);
  });
});
