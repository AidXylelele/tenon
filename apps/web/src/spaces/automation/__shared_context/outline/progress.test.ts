import { describe, expect, it } from 'vitest';
import type { TaskRecord } from '@/libs/data-access/types';
import { progressOf } from './progress';

const record = (
  reference: string,
  status: TaskRecord['status'],
): TaskRecord => ({
  execution: reference,
  reference,
  name: reference.split('/').at(-1) ?? '',
  status,
  input: null,
  output: null,
  error: null,
  startedAt: '2026-11-03T10:00:00Z',
  endedAt: null,
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
    });
  });

  it('a_task_without_its_own_record_shows_its_latest_descendant', () => {
    const progress = progressOf(
      [record('/do/0/each/do/0/notify', 'running')],
      ['/do/0/each', '/do/0/each/do/0/notify'],
    );

    expect(progress.get('/do/0/each')?.status).toBe('running');
  });
});
