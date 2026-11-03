import { TaskStatus } from '../../../src/application/automation/instances/enums.js';
import { RunDirective } from '../../../src/domain/automation/instances/enums.js';
import type { JsonObject } from '../../../src/domain/automation/json.js';
import { SandboxOutcomeKind } from '../../../src/frameworks/runtime/enums.js';
import { RunOutcomeKind } from '../../../src/interface-adapters/workflows/enums.js';
import type { RunOutcome } from '../../../src/interface-adapters/workflows/interfaces.js';
import {
  ERRORS,
  JSON_HEADERS,
  RecordingObserver,
  RuntimeHarness,
  STARTED_AT,
  ScriptedSandbox,
  aWorkflow,
} from '../../support/runtime-harness.js';

let h: RuntimeHarness;

beforeAll(async () => {
  h = await RuntimeHarness.start();
});

afterAll(async () => {
  await h.close();
});

function outputOf(outcome: RunOutcome): unknown {
  if (outcome.kind !== RunOutcomeKind.Completed)
    throw new Error(`the run did not complete: ${JSON.stringify(outcome)}`);

  return outcome.output;
}

function errorOf(outcome: RunOutcome): JsonObject {
  if (outcome.kind !== RunOutcomeKind.Faulted)
    throw new Error(`the run did not fault: ${JSON.stringify(outcome)}`);

  return outcome.error;
}

const CONFLICT = {
  type: 'https://example.com/errors/conflict',
  status: 409,
  title: 'Conflict',
  detail: 'Already taken',
};

function raising(error: JsonObject = CONFLICT): JsonObject {
  return { raise: { error } };
}

function trying(body: JsonObject[], clause: JsonObject): JsonObject {
  return { attempt: { try: body, catch: clause } };
}

const HANDLED = [{ handle: { set: { handled: '${ $error }' } } }];

describe('raise', () => {
  it('an_inline_error_faults_the_workflow_and_its_instance_defaults_to_the_task', async () => {
    const document = aWorkflow([{ fail: raising() }]);

    const { outcome, observer } = await h.run(document, {});

    expect(errorOf(outcome)).toEqual({ ...CONFLICT, instance: '/do/0/fail' });
    expect(observer.endedNamed('fail')[0]).toMatchObject({
      status: TaskStatus.Faulted,
      error: { ...CONFLICT, instance: '/do/0/fail' },
    });
  });

  it('expressions_in_the_title_and_detail_are_evaluated_on_the_task_input', async () => {
    const document = aWorkflow([
      {
        fail: raising({
          type: 'https://example.com/errors/order',
          status: 422,
          title: '${ "Order " + (.id | tostring) }',
          detail: '${ "Missing " + .field }',
        }),
      },
    ]);

    const { outcome } = await h.run(document, { id: 7, field: 'sku' });

    expect(errorOf(outcome)).toMatchObject({
      title: 'Order 7',
      detail: 'Missing sku',
      status: 422,
    });
  });

  it('an_error_declared_in_use_errors_is_raised_by_name_with_its_expressions', async () => {
    const document = aWorkflow([{ fail: { raise: { error: 'notFound' } } }], {
      use: {
        errors: {
          notFound: {
            type: 'https://example.com/errors/not-found',
            status: 404,
            detail: '${ "No pet " + .pet }',
          },
        },
      },
    });

    const { outcome } = await h.run(document, { pet: 'Milou' });

    expect(errorOf(outcome)).toEqual({
      type: 'https://example.com/errors/not-found',
      status: 404,
      detail: 'No pet Milou',
      instance: '/do/0/fail',
    });
  });

  it('an_explicit_instance_is_kept', async () => {
    const document = aWorkflow([
      { fail: raising({ ...CONFLICT, instance: '/custom/place' }) },
    ]);

    const { outcome } = await h.run(document, {});

    expect(errorOf(outcome).instance).toBe('/custom/place');
  });

  it('an_error_raised_in_a_nested_task_points_at_that_task', async () => {
    const document = aWorkflow([
      { outer: { do: [{ ok: { set: { a: 1 } } }, { fail: raising() }] } },
    ]);

    const { outcome } = await h.run(document, {});

    expect(errorOf(outcome).instance).toBe('/do/0/outer/do/1/fail');
  });
});

describe('try and catch', () => {
  it('a_body_that_completes_gives_its_output_and_the_catch_stays_idle', async () => {
    const document = aWorkflow([
      trying([{ ok: { set: { fine: true } } }], { do: HANDLED }),
    ]);

    const { outcome, observer } = await h.run(document, {});

    expect(outputOf(outcome)).toEqual({ fine: true });
    expect(observer.startedNamed('handle')).toHaveLength(0);
  });

  it.each([
    ['type', { type: CONFLICT.type }],
    ['status', { status: 409 }],
    ['instance', { instance: '/do/0/attempt/try/0/fail' }],
    ['title', { title: 'Conflict' }],
    ['details', { details: 'Already taken' }],
    [
      'every_property',
      {
        type: CONFLICT.type,
        status: 409,
        instance: '/do/0/attempt/try/0/fail',
        title: 'Conflict',
        details: 'Already taken',
      },
    ],
  ])('errors_with_filters_on_%s', async (_name, filter) => {
    const document = aWorkflow([
      trying([{ fail: raising() }], { errors: { with: filter }, do: HANDLED }),
    ]);

    const { outcome } = await h.run(document, {});

    expect(outputOf(outcome)).toEqual({
      handled: { ...CONFLICT, instance: '/do/0/attempt/try/0/fail' },
    });
  });

  it.each([
    ['type', { type: 'https://example.com/errors/other' }],
    ['status', { status: 503 }],
    ['instance', { instance: '/do/0/elsewhere' }],
    ['title', { title: 'Other' }],
    ['details', { details: 'Other detail' }],
    ['one_of_several', { type: CONFLICT.type, status: 410 }],
  ])(
    'an_error_that_misses_the_%s_filter_is_not_caught',
    async (_name, filter) => {
      const document = aWorkflow([
        trying([{ fail: raising() }], {
          errors: { with: filter },
          do: HANDLED,
        }),
        { after: { set: { reached: true } } },
      ]);

      const { outcome, observer } = await h.run(document, {});

      expect(errorOf(outcome)).toEqual({
        ...CONFLICT,
        instance: '/do/0/attempt/try/0/fail',
      });
      expect(observer.startedNamed('handle')).toHaveLength(0);
      expect(observer.startedNamed('after')).toHaveLength(0);
      expect(observer.endedNamed('attempt')[0]?.status).toBe(
        TaskStatus.Faulted,
      );
    },
  );

  it('when_catches_only_the_errors_it_holds_for', async () => {
    const clause = { when: '${ $error.status == 409 }', do: HANDLED };
    const caught = aWorkflow([trying([{ fail: raising() }], clause)]);
    const missed = aWorkflow([
      trying([{ fail: raising({ ...CONFLICT, status: 410 }) }], clause),
    ]);

    const first = await h.run(caught, {});
    const second = await h.run(missed, {});

    expect(outputOf(first.outcome)).toMatchObject({ handled: { status: 409 } });
    expect(errorOf(second.outcome)).toMatchObject({ status: 410 });
  });

  it('except_when_leaves_the_errors_it_holds_for_uncaught', async () => {
    const clause = { exceptWhen: '${ $error.status == 409 }', do: HANDLED };
    const excepted = aWorkflow([trying([{ fail: raising() }], clause)]);
    const caught = aWorkflow([
      trying([{ fail: raising({ ...CONFLICT, status: 410 }) }], clause),
    ]);

    const first = await h.run(excepted, {});
    const second = await h.run(caught, {});

    expect(errorOf(first.outcome)).toMatchObject({ status: 409 });
    expect(outputOf(second.outcome)).toMatchObject({
      handled: { status: 410 },
    });
  });

  it('catch_as_names_the_error_variable_in_when_and_in_catch_do', async () => {
    const document = aWorkflow([
      trying([{ fail: raising() }], {
        as: 'oops',
        when: '${ $oops.title == "Conflict" }',
        do: [{ handle: { set: { status: '${ $oops.status }' } } }],
      }),
    ]);

    const { outcome } = await h.run(document, {});

    expect(outputOf(outcome)).toEqual({ status: 409 });
  });

  it('catch_do_starts_from_the_try_input_and_its_output_is_the_try_s', async () => {
    const document = aWorkflow([
      trying([{ first: { set: { changed: true } } }, { fail: raising() }], {
        do: [{ handle: { set: { seen: '${ . }' } } }],
      }),
      { after: { set: { after: '${ . }' } } },
    ]);

    const { outcome } = await h.run(document, { original: 1 });

    expect(outputOf(outcome)).toEqual({ after: { seen: { original: 1 } } });
  });

  it('a_caught_error_without_a_handler_completes_the_try_with_its_input', async () => {
    const document = aWorkflow([
      trying([{ fail: raising() }], { errors: { with: { status: 409 } } }),
      { after: { set: { after: '${ . }' } } },
    ]);

    const { outcome, observer } = await h.run(document, { original: 1 });

    expect(outputOf(outcome)).toEqual({ after: { original: 1 } });
    expect(observer.endedNamed('attempt')[0]?.status).toBe(
      TaskStatus.Completed,
    );
  });

  it('an_uncaught_error_in_an_inner_try_is_caught_by_an_outer_try', async () => {
    const document = aWorkflow([
      {
        outer: {
          try: [
            trying([{ fail: raising() }], {
              errors: { with: { status: 500 } },
            }),
          ],
          catch: {
            errors: { with: { status: 409 } },
            do: [
              { handle: { set: { by: 'outer', at: '${ $error.instance }' } } },
            ],
          },
        },
      },
    ]);

    const { outcome } = await h.run(document, {});

    expect(outputOf(outcome)).toEqual({
      by: 'outer',
      at: '/do/0/outer/try/0/attempt/try/0/fail',
    });
  });

  it('a_runtime_expression_error_is_caught_by_its_standard_type', async () => {
    const document = aWorkflow([
      trying([{ bad: { set: { x: '${ .a.b }' } } }], {
        errors: { with: { type: `${ERRORS}expression`, status: 400 } },
        do: HANDLED,
      }),
    ]);

    const { outcome } = await h.run(document, { a: 1 });

    expect(outputOf(outcome)).toMatchObject({
      handled: {
        type: `${ERRORS}expression`,
        instance: '/do/0/attempt/try/0/bad',
      },
    });
  });

  it('an_http_404_is_caught_as_a_communication_error_with_status_404', async () => {
    h.agent
      .get('https://catch-404.test')
      .intercept({ path: '/pets/Milou', method: 'GET' })
      .reply(404, { message: 'not found' }, { headers: JSON_HEADERS });
    const document = aWorkflow([
      trying(
        [
          {
            getPet: {
              call: 'http',
              with: {
                method: 'get',
                endpoint: { uri: 'https://catch-404.test/pets/{petName}' },
              },
            },
          },
        ],
        {
          errors: { with: { type: `${ERRORS}communication`, status: 404 } },
          as: 'err',
          do: [{ setError: { set: { error: '${ $err }' } } }],
        },
      ),
    ]);

    const { outcome } = await h.run(document, { petName: 'Milou' });

    expect(outputOf(outcome)).toMatchObject({
      error: {
        type: `${ERRORS}communication`,
        status: 404,
        instance: '/do/0/attempt/try/0/getPet',
      },
    });
  });

  it('an_error_raised_in_catch_do_faults_the_workflow', async () => {
    const document = aWorkflow([
      trying([{ fail: raising() }], {
        do: [
          { again: raising({ type: 'https://example.com/b', status: 500 }) },
        ],
      }),
    ]);

    const { outcome } = await h.run(document, {});

    expect(errorOf(outcome)).toMatchObject({
      type: 'https://example.com/b',
      instance: '/do/0/attempt/catch/do/0/again',
    });
  });
});

describe('retry', () => {
  function retried(
    body: JsonObject[],
    retry: JsonObject | string,
    rest: JsonObject = {},
  ) {
    return trying(body, { retry, do: HANDLED, ...rest });
  }

  const second = { seconds: 1 };

  it('count_limits_the_retries_after_the_first_attempt_then_catch_do_runs_with_the_last_error', async () => {
    const document = aWorkflow([
      retried([{ fail: raising() }], {
        delay: second,
        backoff: { constant: {} },
        limit: { attempt: { count: 2 } },
      }),
    ]);

    const { outcome, observer, durability } = await h.run(document, {});

    expect(outputOf(outcome)).toMatchObject({ handled: { status: 409 } });
    expect(observer.startedNamed('fail')).toHaveLength(3);
    expect(observer.endedNamed('fail')).toHaveLength(3);
    expect(durability.backoffs.map((b) => b.milliseconds)).toEqual([
      1000, 1000,
    ]);
  });

  it.each([
    ['constant', [1000, 1000, 1000]],
    ['linear', [1000, 2000, 3000]],
    ['exponential', [1000, 2000, 4000]],
  ])('a_single_task_s_%s_backoff_gives_its_delays', async (kind, delays) => {
    const document = aWorkflow([
      retried([{ fail: raising() }], {
        delay: second,
        backoff: { [kind]: {} },
        limit: { attempt: { count: 3 } },
      }),
    ]);

    const { durability } = await h.run(document, {});

    expect(durability.backoffs.map((b) => b.milliseconds)).toEqual(delays);
  });

  it.each([
    ['constant', [1000, 1000, 1000]],
    ['linear', [1000, 2000, 3000]],
    ['exponential', [1000, 2000, 4000]],
  ])(
    'a_task_list_s_%s_backoff_sleeps_its_delays_between_runs_of_the_list',
    async (kind, delays) => {
      const document = aWorkflow([
        retried([{ first: { set: { a: 1 } } }, { fail: raising() }], {
          delay: second,
          backoff: { [kind]: {} },
          limit: { attempt: { count: 3 } },
        }),
      ]);

      const { durability, observer, journal } = await h.run(document, {});

      expect(durability.newSleeps.map((s) => s.milliseconds)).toEqual(delays);
      expect(observer.endedNamed('first')).toHaveLength(4);
      expect([...journal.keys()]).toEqual(
        expect.arrayContaining([
          '/do/0/attempt/try/0/first',
          '/do/0/attempt#2/try/0/first',
          '/do/0/attempt#4/try/1/fail',
        ]),
      );
    },
  );

  it('a_jitter_adds_a_delay_within_its_bounds', async () => {
    const document = aWorkflow([
      retried([{ fail: raising() }], {
        delay: second,
        backoff: { constant: {} },
        jitter: { from: { milliseconds: 100 }, to: { milliseconds: 300 } },
        limit: { attempt: { count: 8 } },
      }),
    ]);

    const { durability } = await h.run(document, {});

    const delays = durability.backoffs.map((b) => b.milliseconds);
    expect(delays).toHaveLength(8);

    for (const delay of delays) {
      expect(delay).toBeGreaterThanOrEqual(1100);
      expect(delay).toBeLessThanOrEqual(1300);
    }
  });

  it('limit_duration_stops_the_retries_of_a_task_list', async () => {
    const document = aWorkflow([
      retried([{ first: { set: { a: 1 } } }, { fail: raising() }], {
        delay: { milliseconds: 400 },
        backoff: { constant: {} },
        limit: { duration: second },
      }),
    ]);

    const { outcome, observer } = await h.run(document, {});

    expect(outputOf(outcome)).toMatchObject({ handled: { status: 409 } });
    const attempts = observer.endedNamed('fail').length;
    expect(attempts).toBeGreaterThanOrEqual(3);
    expect(attempts).toBeLessThanOrEqual(4);
  });

  // The single-task path measures `limit.duration` on the engine's clock from the try's start,
  // also when that clock is not the wall clock (a manual test clock).
  it('limit_duration_of_a_single_task_counts_on_the_engine_clock', async () => {
    const document = aWorkflow([
      retried([{ fail: raising() }], {
        delay: { milliseconds: 400 },
        backoff: { constant: {} },
        limit: { duration: second },
      }),
    ]);

    const { outcome, observer } = await h.run(
      document,
      {},
      {
        clockStart: Date.now(),
        maxAttempts: 20,
      },
    );

    expect(outputOf(outcome)).toMatchObject({ handled: { status: 409 } });
    expect(observer.startedNamed('fail').length).toBeLessThanOrEqual(4);
  });

  it('a_task_that_succeeds_on_a_retry_completes_with_that_output', async () => {
    const pool = h.agent.get('https://retry-503.test');
    pool
      .intercept({ path: '/health', method: 'GET' })
      .reply(503, 'down')
      .times(2);
    pool
      .intercept({ path: '/health', method: 'GET' })
      .reply(200, { up: true }, { headers: JSON_HEADERS });
    const document = aWorkflow([
      trying(
        [
          {
            check: {
              call: 'http',
              with: {
                method: 'get',
                endpoint: 'https://retry-503.test/health',
              },
            },
          },
        ],
        {
          errors: { with: { status: 503 } },
          retry: {
            delay: { seconds: 3 },
            backoff: { linear: {} },
            limit: { attempt: { count: 5 } },
          },
        },
      ),
    ]);

    const { outcome, observer, durability } = await h.run(document, {});

    expect(outputOf(outcome)).toEqual({ up: true });
    expect(observer.startedNamed('check')).toHaveLength(3);
    expect(observer.endedNamed('check').map((task) => task.status)).toEqual([
      TaskStatus.Faulted,
      TaskStatus.Faulted,
      TaskStatus.Completed,
    ]);
    expect(durability.backoffs.map((b) => b.milliseconds)).toEqual([
      3000, 6000,
    ]);
  });

  it('spent_retries_without_a_handler_fault_with_the_last_error', async () => {
    const document = aWorkflow([
      trying([{ fail: raising() }], {
        retry: { delay: second, limit: { attempt: { count: 1 } } },
      }),
    ]);

    const { outcome, observer } = await h.run(document, {});

    expect(errorOf(outcome)).toMatchObject({
      status: 409,
      instance: '/do/0/attempt/try/0/fail',
    });
    expect(observer.startedNamed('fail')).toHaveLength(2);
  });

  it('an_error_the_catch_does_not_filter_is_not_retried', async () => {
    const document = aWorkflow([
      trying([{ fail: raising() }], {
        errors: { with: { status: 503 } },
        retry: { delay: second, limit: { attempt: { count: 3 } } },
      }),
    ]);

    const { outcome, observer } = await h.run(document, {});

    expect(errorOf(outcome)).toMatchObject({ status: 409 });
    expect(observer.startedNamed('fail')).toHaveLength(1);
  });

  it('the_retry_s_when_and_except_when_decide_whether_to_retry', async () => {
    const no = aWorkflow([
      retried([{ fail: raising() }], {
        when: '${ $error.status == 503 }',
        delay: second,
        limit: { attempt: { count: 3 } },
      }),
    ]);
    const excepted = aWorkflow([
      retried([{ fail: raising() }], {
        exceptWhen: '${ $error.status == 409 }',
        delay: second,
        limit: { attempt: { count: 3 } },
      }),
    ]);
    const yes = aWorkflow([
      retried([{ fail: raising() }], {
        when: '${ $error.status == 409 }',
        delay: second,
        limit: { attempt: { count: 3 } },
      }),
    ]);

    const first = await h.run(no, {});
    const secondRun = await h.run(excepted, {});
    const third = await h.run(yes, {});

    expect(first.observer.startedNamed('fail')).toHaveLength(1);
    expect(secondRun.observer.startedNamed('fail')).toHaveLength(1);
    expect(third.observer.startedNamed('fail')).toHaveLength(4);
    expect(outputOf(first.outcome)).toMatchObject({ handled: { status: 409 } });
  });

  // Each attempt of a step the engine retries is its own record (FR-016): it starts with its
  // number, and a retried one ends faulted with when the next begins, on the engine's clock.
  it('every_attempt_of_a_single_task_is_its_own_record', async () => {
    const document = aWorkflow([
      retried([{ fail: raising() }], {
        delay: second,
        backoff: { linear: {} },
        limit: { attempt: { count: 2 } },
      }),
    ]);

    const { observer } = await h.run(document, {});

    const first = '/do/0/attempt/try/0/fail';
    const started = Date.parse(STARTED_AT);
    const starts = observer.startedNamed('fail');
    expect(starts.map((task) => [task.execution, task.attempt])).toEqual([
      [first, 1],
      [`${first}#2`, 2],
      [`${first}#3`, 3],
    ]);
    expect(observer.endedNamed('fail')).toEqual([
      expect.objectContaining({
        execution: first,
        reference: first,
        status: TaskStatus.Faulted,
        error: expect.objectContaining({ status: 409 }),
        retryAt: new Date(started + 1000).toISOString(),
      }),
      expect.objectContaining({
        execution: `${first}#2`,
        reference: first,
        status: TaskStatus.Faulted,
        retryAt: new Date(started + 3000).toISOString(),
      }),
      expect.objectContaining({
        execution: `${first}#3`,
        reference: first,
        status: TaskStatus.Faulted,
        retryAt: null,
      }),
    ]);
  });

  it('a_jittered_retry_announces_the_delay_the_engine_waits', async () => {
    const document = aWorkflow([
      retried([{ fail: raising() }], {
        delay: second,
        backoff: { constant: {} },
        jitter: { from: { milliseconds: 100 }, to: { milliseconds: 300 } },
        limit: { attempt: { count: 4 } },
      }),
    ]);

    const { observer, durability } = await h.run(document, {});

    let due = Date.parse(STARTED_AT);
    const ended = observer.endedNamed('fail');
    const announced = ended.map((task) => task.retryAt);
    const waited: (string | null)[] = durability.backoffs.map((backoff) => {
      due += backoff.milliseconds;
      return new Date(due).toISOString();
    });
    expect(waited).toHaveLength(4);
    expect(announced).toEqual(waited.concat([null]));
  });

  // The engine's reserve for outages was spent while the policy still retried: the last attempt
  // that ran ends the task, on its own record.
  it('a_step_the_engine_gives_up_on_ends_on_its_last_attempt_s_record', async () => {
    const document = aWorkflow([
      trying([{ fail: raising() }], {
        retry: { delay: second, limit: { attempt: { count: 3 } } },
      }),
    ]);

    const { outcome, observer, journal } = await h.run(
      document,
      {},
      { stepAttempts: 2 },
    );

    const first = '/do/0/attempt/try/0/fail';
    const ended = observer.endedNamed('fail');
    expect(errorOf(outcome)).toMatchObject({ status: 409, instance: first });
    expect(ended.map((task) => [task.execution, task.retryAt])).toEqual([
      [first, new Date(Date.parse(STARTED_AT) + 1000).toISOString()],
      [`${first}#2`, expect.any(String)],
      [`${first}#2`, null],
    ]);
    expect(journal.get(first)).toMatchObject({ attempts: 2 });

    const replayed = await h.run(document, {}, { journal, stepAttempts: 2 });

    expect(errorOf(replayed.outcome)).toMatchObject({ status: 409 });
    expect(replayed.observer.ended).toEqual([]);
  });

  // A task list's run again is new executions of its tasks; the fault the try retries says when,
  // as a single task's attempt does, on the task and on the tasks it faulted on its way out.
  it('a_task_list_s_retried_fault_says_when_its_tasks_run_again', async () => {
    const document = aWorkflow([
      retried(
        [
          { first: { set: { a: 1 } } },
          { group: { do: [{ fail: raising() }] } },
        ],
        { delay: second, limit: { attempt: { count: 1 } } },
      ),
    ]);

    const { observer, durability } = await h.run(document, {});

    const due = new Date(Date.parse(STARTED_AT) + 1000).toISOString();
    const starts = observer.startedNamed('fail');
    expect(starts.map((task) => [task.execution, task.attempt])).toEqual([
      ['/do/0/attempt/try/1/group/do/0/fail', 1],
      ['/do/0/attempt#2/try/1/group/do/0/fail', 1],
    ]);
    expect(observer.endedNamed('fail').map((task) => task.retryAt)).toEqual([
      due,
      null,
    ]);
    expect(observer.endedNamed('group').map((task) => task.retryAt)).toEqual([
      due,
      null,
    ]);
    expect(durability.newSleeps.map((sleep) => sleep.milliseconds)).toEqual([
      1000,
    ]);
  });

  // The nearest try that catches a fault decides on it: here not the single task's own try.
  it('a_fault_an_inner_try_does_not_catch_says_when_the_outer_try_runs_again', async () => {
    const inner = trying([{ fail: raising() }], {
      errors: { with: { status: 503 } },
      retry: { delay: second, limit: { attempt: { count: 3 } } },
    });
    const document = aWorkflow([
      retried([{ first: { set: { a: 1 } } }, inner], {
        delay: { seconds: 2 },
        limit: { attempt: { count: 1 } },
      }),
    ]);

    const { observer } = await h.run(document, {});

    const due = new Date(Date.parse(STARTED_AT) + 2000).toISOString();
    const ended = observer.endedNamed('fail');
    expect(ended.map((task) => [task.attempt, task.retryAt])).toEqual([
      [1, due],
      [1, null],
    ]);
  });

  // An outage of the platform runs the same attempt again: the same record, and the policy's
  // count is not spent on it.
  it('an_outage_runs_the_same_attempt_again_and_spends_no_retry', async () => {
    h.sandbox.queued.push(
      { kind: SandboxOutcomeKind.Unreachable },
      ScriptedSandbox.exited(1, '', 'Error: boom'),
      ScriptedSandbox.exited(0, 'done', ''),
    );
    const document = aWorkflow([
      trying(
        [
          {
            compute: {
              run: { script: { language: 'js', code: 'main()' } },
            },
          },
        ],
        { retry: { delay: second, limit: { attempt: { count: 1 } } } },
      ),
    ]);

    const { outcome, observer } = await h.run(document, {});

    const first = '/do/0/attempt/try/0/compute';
    const starts = observer.startedNamed('compute');
    const ended = observer.endedNamed('compute');
    expect(outputOf(outcome)).toBe('done');
    expect(starts.map((task) => [task.execution, task.attempt])).toEqual([
      [first, 1],
      [first, 1],
      [`${first}#2`, 2],
    ]);
    expect(ended.map((task) => [task.execution, task.status])).toEqual([
      [first, TaskStatus.Faulted],
      [`${first}#2`, TaskStatus.Completed],
    ]);
  });

  // The platform answers the retried attempt's end with stop (the instance ended meanwhile): the
  // step ends there, so no worker runs another attempt.
  it('a_retried_attempt_of_an_ended_instance_schedules_no_next_attempt', async () => {
    const observer = new RecordingObserver((task) =>
      task.retryAt === null ? RunDirective.Continue : RunDirective.Stop,
    );
    const document = aWorkflow([
      retried([{ fail: raising() }], {
        delay: second,
        limit: { attempt: { count: 3 } },
      }),
    ]);

    const { outcome, durability, journal } = await h.run(
      document,
      {},
      { observer },
    );

    expect(outcome.kind).toBe(RunOutcomeKind.Stopped);
    expect(observer.startedNamed('fail')).toHaveLength(1);
    expect(durability.backoffs).toEqual([]);
    expect(journal.get('/do/0/attempt/try/0/fail')).toMatchObject({
      value: { status: TaskStatus.Faulted, directive: RunDirective.Stop },
    });
  });

  it('a_retry_policy_declared_in_use_retries_is_used_by_name', async () => {
    const document = aWorkflow([retried([{ fail: raising() }], 'twice')], {
      use: {
        retries: {
          twice: {
            delay: { milliseconds: 250 },
            backoff: { exponential: {} },
            limit: { attempt: { count: 2 } },
          },
        },
      },
    });

    const { durability, observer } = await h.run(document, {});

    expect(observer.startedNamed('fail')).toHaveLength(3);
    expect(durability.backoffs.map((b) => b.milliseconds)).toEqual([250, 500]);
  });
});
