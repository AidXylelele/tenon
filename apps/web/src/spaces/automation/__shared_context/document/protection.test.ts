import { describe, expect, it } from 'vitest';
import type { JsonObject } from '@/libs/document-text/json';
import {
  failureChoiceOf,
  protectionOf,
  renamedStep,
  retryTextOf,
  withFailureChoice,
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
});
