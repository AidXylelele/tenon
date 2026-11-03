import { describe, expect, it } from 'vitest';
import type { JsonObject } from '@/libs/document-text/json';
import {
  describeTrigger,
  durationOf,
  durationValue,
  startsAutomatically,
  triggerOf,
  withTrigger,
} from './trigger';

const base: JsonObject = { document: { name: 'x' }, do: [] };

describe('what starts a workflow', () => {
  it('a_document_without_a_schedule_is_started_by_hand', () => {
    expect(triggerOf(base)).toEqual({ kind: 'manual' });
  });

  it('reads_cron_every_after_and_one_event_type', () => {
    expect(triggerOf({ ...base, schedule: { cron: '0 9 * * 1' } })).toEqual({
      kind: 'cron',
      expression: '0 9 * * 1',
    });
    expect(triggerOf({ ...base, schedule: { every: { minutes: 5 } } })).toEqual(
      {
        kind: 'every',
        duration: { amount: 5, unit: 'minutes' },
      },
    );
    expect(
      triggerOf({
        ...base,
        schedule: { on: { one: { with: { type: 'order.paid' } } } },
      }),
    ).toEqual({
      kind: 'event',
      type: 'order.paid',
    });
  });

  it('a_schedule_the_forms_do_not_cover_is_kept_as_it_is', () => {
    const schedule = { every: { hours: 1, minutes: 30 } };
    const trigger = triggerOf({ ...base, schedule });

    expect(trigger).toEqual({ kind: 'custom', schedule });
    expect(withTrigger(base, trigger).schedule).toEqual(schedule);
  });

  it('writing_manual_removes_the_schedule', () => {
    const scheduled = withTrigger(base, {
      kind: 'cron',
      expression: '* * * * *',
    });

    expect(withTrigger(scheduled, { kind: 'manual' })).toEqual(base);
  });

  it('says_in_words_when_it_starts', () => {
    expect(
      describeTrigger({
        kind: 'every',
        duration: { amount: 1, unit: 'hours' },
      }),
    ).toBe('Every 1 hour');
    expect(
      describeTrigger({
        kind: 'after',
        duration: { amount: 5, unit: 'minutes' },
      }),
    ).toBe('5 minutes after the previous run completes');
    expect(describeTrigger({ kind: 'manual' })).toBe(
      'Started by hand or by an application',
    );
    expect(describeTrigger({ kind: 'cron', expression: '0 9 * * 1' })).toBe(
      'On the schedule 0 9 * * 1 (UTC)',
    );
    expect(describeTrigger({ kind: 'event', type: 'order.paid' })).toBe(
      'When an event of type order.paid arrives',
    );
    expect(describeTrigger({ kind: 'custom', schedule: 'x' })).toBe(
      'On a schedule written as code',
    );
  });

  it('only_a_workflow_started_by_hand_waits_for_someone', () => {
    expect(startsAutomatically({ kind: 'manual' })).toBe(false);
    expect(startsAutomatically({ kind: 'cron', expression: '* * * * *' })).toBe(
      true,
    );
  });

  it('writes_each_trigger_back_as_its_schedule', () => {
    const duration = { amount: 10, unit: 'seconds' } as const;

    expect(withTrigger(base, { kind: 'after', duration }).schedule).toEqual({
      after: { seconds: 10 },
    });
    expect(withTrigger(base, { kind: 'every', duration }).schedule).toEqual({
      every: { seconds: 10 },
    });
    expect(
      withTrigger(base, { kind: 'event', type: 'order.paid' }).schedule,
    ).toEqual({ on: { one: { with: { type: 'order.paid' } } } });
    expect(durationValue(duration)).toEqual({ seconds: 10 });
  });

  it('a_schedule_that_is_not_one_known_form_is_kept_as_code', () => {
    expect(triggerOf({ ...base, schedule: 'daily' })).toEqual({
      kind: 'custom',
      schedule: 'daily',
    });
    expect(
      triggerOf({ ...base, schedule: { cron: '* * * * *', every: {} } }),
    ).toMatchObject({ kind: 'custom' });
    expect(triggerOf({ ...base, schedule: { on: { all: [] } } })).toMatchObject(
      { kind: 'custom' },
    );
    expect(
      triggerOf({
        ...base,
        schedule: { on: { one: { with: { a: 1, b: 2 } } } },
      }),
    ).toMatchObject({ kind: 'custom' });
  });

  it('a_duration_is_one_known_unit_with_a_number', () => {
    expect(durationOf({ minutes: 5 })).toEqual({ amount: 5, unit: 'minutes' });
    expect(durationOf({ weeks: 1 })).toBeNull();
    expect(durationOf({ minutes: '5' })).toBeNull();
    expect(durationOf({})).toBeNull();
    expect(durationOf('PT5M')).toBeNull();
  });
});
