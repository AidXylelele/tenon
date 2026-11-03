import { describe, expect, it } from 'vitest';
import type { TaskRecord } from '@/libs/data-access/types';
import { attemptsOf, isRetrying, progressOf } from './progress';

const record = (
  reference: string,
  status: TaskRecord['status'],
  attempt = 1,
  retryAt: string | null = null,
): TaskRecord => ({
  execution: attempt === 1 ? reference : `${reference}#${String(attempt)}`,
  reference,
  name: reference.split('/').at(-1) ?? '',
  status,
  input: null,
  output: null,
  error: null,
  startedAt: '2026-11-03T10:00:00Z',
  endedAt: null,
  attempt,
  retryAt,
});

describe('the progress of a run by task', () => {
  it('a_task_that_ran_again_shows_its_latest_status_and_its_count', () => {
    const progress = progressOf(
      [record('/do/0/fetch', 'faulted'), record('/do/0/fetch', 'completed')],
      ['/do/0/fetch'],
    );

    expect(progress.get('/do/0/fetch')).toEqual({
      status: 'completed',
      runs: 2,
      attempt: 1,
      retryAt: null,
    });
  });

  it('the_attempts_of_one_run_count_as_one_run_and_say_which_attempt_is_latest', () => {
    const progress = progressOf(
      [
        record('/do/0/fetch', 'faulted', 1, '2026-11-03T10:00:05Z'),
        record('/do/0/fetch', 'running', 2),
      ],
      ['/do/0/fetch'],
    );

    expect(progress.get('/do/0/fetch')).toEqual({
      status: 'running',
      runs: 1,
      attempt: 2,
      retryAt: null,
    });
  });

  it('a_task_whose_latest_attempt_faulted_and_is_retried_waits_only_while_the_run_goes_on', () => {
    const progress = progressOf(
      [record('/do/0/fetch', 'faulted', 1, '2026-11-03T10:00:05Z')],
      ['/do/0/fetch'],
    );
    const fetch = progress.get('/do/0/fetch');

    expect(isRetrying(fetch, true)).toBe(true);
    expect(isRetrying(fetch, false)).toBe(false);
  });

  it('a_task_retried_with_its_list_counts_its_passes_as_attempts', () => {
    const retried = {
      ...record('/do/0/a/try/0/b', 'faulted', 1, '2026-11-03T10:00:05Z'),
      execution: '/do/0/a/try/0/b',
    };
    const again = {
      ...record('/do/0/a/try/0/b', 'running'),
      execution: '/do/0/a#2/try/0/b',
    };
    const progress = progressOf([retried, again], ['/do/0/a/try/0/b']);
    const attempts = attemptsOf([retried, again]);

    expect(progress.get('/do/0/a/try/0/b')).toMatchObject({
      runs: 1,
      attempt: 2,
    });
    expect(attempts.get('/do/0/a/try/0/b')).toEqual({
      attempt: 1,
      retried: true,
    });
    expect(attempts.get('/do/0/a#2/try/0/b')).toEqual({
      attempt: 2,
      retried: false,
    });
  });

  it('a_record_that_ended_without_a_retry_is_followed_by_a_new_run_not_an_attempt', () => {
    const attempts = attemptsOf([
      record('/do/0/fetch', 'faulted'),
      { ...record('/do/0/fetch', 'completed'), execution: '/do/0/fetch@1' },
    ]);

    expect(attempts.get('/do/0/fetch')).toEqual({
      attempt: 1,
      retried: false,
    });
    expect(attempts.get('/do/0/fetch@1')?.attempt).toBe(1);
  });

  it('a_task_without_its_own_record_shows_its_latest_descendant', () => {
    const progress = progressOf(
      [record('/do/0/each/do/0/notify', 'running')],
      ['/do/0/each', '/do/0/each/do/0/notify'],
    );

    expect(progress.get('/do/0/each')?.status).toBe('running');
  });
});
