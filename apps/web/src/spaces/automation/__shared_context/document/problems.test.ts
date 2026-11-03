import { describe, expect, it } from 'vitest';
import type { Problem } from '@/libs/data-access/problem';
import type { JsonObject } from '@/libs/data-access/types';
import { isFieldOf, locate } from './problems';

const draft: JsonObject = {
  document: { name: 'x' },
  do: [
    {
      each: {
        for: { each: 'x', in: '${ .x }' },
        do: [{ call1: { call: 'http', with: {} } }],
      },
    },
  ],
};

const problemAt = (pointer: string): Problem => ({
  type: 'urn:problem:definition.invalid',
  title: 'The workflow definition is invalid',
  status: 422,
  detail: 'endpoint is required',
  errors: [{ pointer, detail: 'endpoint is required' }],
});

describe('where a problem of the check lies', () => {
  it('belongs_to_the_deepest_task_that_holds_its_pointer', () => {
    const located = locate(
      draft,
      problemAt('/do/0/each/do/0/call1/with/endpoint'),
    );

    expect(located.taskPointer).toBe('/do/0/each/do/0/call1');
    expect(located.field).toBe('with/endpoint');
  });

  it('a_problem_outside_every_task_belongs_to_the_document', () => {
    const located = locate(draft, problemAt('/schedule/cron'));

    expect(located.taskPointer).toBeNull();
    expect(located.field).toBe('schedule/cron');
  });

  it('a_field_holds_the_problems_inside_it', () => {
    expect(isFieldOf('with/endpoint/uri', 'with/endpoint')).toBe(true);
    expect(isFieldOf('with/endpointer', 'with/endpoint')).toBe(false);
  });
});
