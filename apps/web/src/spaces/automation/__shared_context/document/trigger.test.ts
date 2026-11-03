import { describe, expect, it } from 'vitest';
import type { JsonObject } from '@/libs/document-text/json';
import { describeTrigger, triggerOf, withTrigger } from './trigger';

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
  });
});
