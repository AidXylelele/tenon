import { describe, expect, it } from 'vitest';
import { codeOf, problemOf } from './problem';

describe('a refusal of the API', () => {
  it('reads_an_rfc_9457_problem_with_its_locations', () => {
    const problem = problemOf(422, {
      type: 'urn:problem:definition.invalid',
      title: 'The workflow definition is invalid',
      status: 422,
      detail: 'must have required property endpoint',
      errors: [
        {
          pointer: '/do/0/fetch/with',
          detail: 'must have required property endpoint',
        },
      ],
    });

    expect(codeOf(problem)).toBe('definition.invalid');
    expect(problem.errors).toEqual([
      {
        pointer: '/do/0/fetch/with',
        detail: 'must have required property endpoint',
      },
    ]);
  });

  it('reads_nests_own_error_shape_into_the_same_problem', () => {
    const problem = problemOf(400, {
      statusCode: 400,
      message: ['email must be an email', 'password is required'],
      error: 'Bad Request',
    });

    expect(problem).toMatchObject({
      type: 'about:blank',
      title: 'Bad Request',
      detail: 'email must be an email; password is required',
    });
    expect(codeOf(problem)).toBeNull();
  });

  it('a_body_that_is_not_json_still_becomes_a_problem', () => {
    expect(problemOf(502, 'Bad gateway')).toMatchObject({
      status: 502,
      title: 'HTTP 502',
      detail: 'HTTP 502',
    });
  });
});
