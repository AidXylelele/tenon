import { describe, expect, it } from 'vitest';
import type { JsonObject } from '@/libs/document-text/json';
import {
  failureChoiceOf,
  protectionOf,
  protectorOf,
  renamedStep,
  retryTextOf,
  withFailureChoice,
  withProtectedStep,
} from './protection';
import { entriesAt, replaceTask } from './tasks';

const draft: JsonObject = {
  document: { dsl: '1.0.3', namespace: 'n', name: 'w', version: '1.0.0' },
  do: [
    {
      fetchLead: {
        call: 'http',
        with: { method: 'get', endpoint: 'https://crm.example.com' },
        then: 'end',
        metadata: { note: 'From the CRM' },
      },
    },
  ],
};

const first = (document: JsonObject) => {
  const [entry] = entriesAt(document, '/do');
  if (entry === undefined) throw new Error('no step');
  return entry;
};

describe('what a step does when it fails', () => {
  it('a_plain_step_stops_the_run', () => {
    const entry = first(draft);

    expect(protectionOf(draft, entry)).toBeNull();
    expect(failureChoiceOf(null, entry)).toEqual({ kind: 'stop' });
  });

  it('a_retry_wraps_the_step_in_a_try_that_takes_over_its_flow_and_note', () => {
    const entry = first(draft);
    const choice = {
      kind: 'retry',
      attempts: 4,
      seconds: 2,
      growing: true,
    } as const;
    const task = withFailureChoice(entry, null, choice);
    const next = replaceTask(draft, entry, task);
    const wrapper = first(next);
    const protection = protectionOf(next, wrapper);

    expect(task).toEqual({
      then: 'end',
      metadata: { note: 'From the CRM' },
      try: [
        {
          fetchLead: {
            call: 'http',
            with: { method: 'get', endpoint: 'https://crm.example.com' },
          },
        },
      ],
      catch: {
        retry: {
          delay: { seconds: 2 },
          backoff: { exponential: {} },
          limit: { attempt: { count: 4 } },
        },
      },
    });
    expect(protection?.step.name).toBe('fetchLead');
    expect(protection?.retry).toBe(
      'Retries up to 4 times, 2 seconds apart, waiting longer each time',
    );
    expect(failureChoiceOf(protection, wrapper)).toEqual(choice);
  });

  it('going_on_catches_every_failure_and_stopping_again_unwraps_the_step', () => {
    const entry = first(draft);
    const wrapped = replaceTask(
      draft,
      entry,
      withFailureChoice(entry, null, { kind: 'continue' }),
    );
    const wrapper = first(wrapped);
    const protection = protectionOf(wrapped, wrapper);
    const restored = withFailureChoice(wrapper, protection, { kind: 'stop' });

    expect(wrapper.task.catch).toEqual({});
    expect(protection?.continues).toBe(true);
    expect(restored).toEqual(entry.task);
  });

  it('running_other_steps_keeps_the_retries_and_makes_a_block_with_a_handler', () => {
    const entry = first(draft);
    const retried = replaceTask(
      draft,
      entry,
      withFailureChoice(entry, null, {
        kind: 'retry',
        attempts: 3,
        seconds: 5,
        growing: false,
      }),
    );
    const wrapper = first(retried);
    const task = withFailureChoice(wrapper, protectionOf(retried, wrapper), {
      kind: 'handle',
    });
    const handled = replaceTask(retried, wrapper, task);

    expect(task.catch).toMatchObject({
      retry: { limit: { attempt: { count: 3 } } },
      as: 'error',
      do: [{ recover: { set: { recovered: true } } }],
    });
    expect(protectionOf(handled, first(handled))).toBeNull();
  });

  it('renaming_a_protected_step_renames_its_try_too', () => {
    const entry = first(draft);
    const wrapped = replaceTask(
      draft,
      entry,
      withFailureChoice(entry, null, { kind: 'continue' }),
    );
    const wrapper = first(wrapped);
    const renamed = renamedStep(
      wrapped,
      wrapper,
      protectionOf(wrapped, wrapper),
      'loadLead',
    );
    const after = first(renamed);

    expect(after.name).toBe('loadLead');
    expect(protectionOf(renamed, after)?.step.name).toBe('loadLead');
  });

  it('a_named_retry_policy_reads_as_its_name', () => {
    expect(retryTextOf('crm-policy')).toBe('Retries as crm-policy');
    expect(retryTextOf(undefined)).toBeNull();
  });

  it('a_retry_policy_reads_as_its_count_delay_and_backoff', () => {
    expect(
      retryTextOf({
        delay: { seconds: 1 },
        backoff: { linear: {} },
        limit: { attempt: { count: 3 } },
      }),
    ).toBe('Retries up to 3 times, 1 second apart, waiting longer each time');
    expect(retryTextOf({})).toBe('Retries');
  });

  it('a_retry_in_minutes_hours_or_days_is_read_back_in_seconds', () => {
    const retried = (delay: JsonObject) => {
      const document: JsonObject = {
        do: [
          {
            fetchLead: {
              try: [{ fetchLead: { call: 'http', with: {} } }],
              catch: { retry: { delay, limit: { attempt: { count: 2 } } } },
            },
          },
        ],
      };
      const entry = first(document);
      const protection = protectionOf(document, entry);
      return failureChoiceOf(protection, entry);
    };

    expect(retried({ minutes: 2 })).toMatchObject({ seconds: 120 });
    expect(retried({ hours: 1 })).toMatchObject({ seconds: 3600 });
    expect(retried({ days: 1 })).toMatchObject({ seconds: 86_400 });
  });

  it('a_protected_step_is_drawn_as_its_try_and_any_other_as_itself', () => {
    const entry = first(draft);
    const wrapped = replaceTask(
      draft,
      entry,
      withFailureChoice(entry, null, { kind: 'continue' }),
    );

    expect(protectorOf(wrapped, '/do/0/fetchLead/try/0/fetchLead')).toBe(
      '/do/0/fetchLead',
    );
    expect(protectorOf(wrapped, '/do/0/fetchLead')).toBe('/do/0/fetchLead');
    expect(protectorOf(draft, '/do/0/missing/try/0/step')).toBe(
      '/do/0/missing/try/0/step',
    );
  });

  it('a_try_with_steps_to_run_on_failure_is_a_block_not_a_protection', () => {
    const block: JsonObject = {
      do: [
        {
          guarded: {
            try: [{ a: { set: {} } }],
            catch: { do: [{ recover: { set: {} } }] },
          },
        },
      ],
    };
    const entry = first(block);

    expect(protectionOf(block, entry)).toBeNull();
    expect(failureChoiceOf(null, entry)).toEqual({ kind: 'handle' });
    expect(withFailureChoice(entry, null, { kind: 'stop' })).toBe(entry.task);
    expect(protectorOf(block, '/do/0/guarded/try/0/a')).toBe(
      '/do/0/guarded/try/0/a',
    );
  });

  it('the_protected_step_is_replaced_inside_its_try', () => {
    const entry = first(draft);
    const wrapped = replaceTask(
      draft,
      entry,
      withFailureChoice(entry, null, { kind: 'continue' }),
    );
    const wrapper = first(wrapped);
    const protection = protectionOf(wrapped, wrapper);
    const task = { set: { lead: true } };

    expect(
      protection && withProtectedStep(wrapper, protection, task).try,
    ).toEqual([{ fetchLead: task }]);
  });
});
