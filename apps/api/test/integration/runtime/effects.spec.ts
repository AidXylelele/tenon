import { TaskStatus } from '../../../src/application/automation/instances/enums.js';
import { Phase } from '../../../src/domain/automation/instances/enums.js';
import type { JsonObject } from '../../../src/domain/automation/json.js';
import { RunOutcomeKind } from '../../../src/interface-adapters/workflows/enums.js';
import type { RunOutcome } from '../../../src/interface-adapters/workflows/interfaces.js';
import {
  ERRORS,
  JSON_HEADERS,
  RecordingObserver,
  RuntimeHarness,
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

const TIMEOUT = { type: `${ERRORS}timeout`, status: 408 };

function slowCall(origin: string, delay: number): JsonObject {
  h.agent
    .get(origin)
    .intercept({ path: '/slow', method: 'GET' })
    .reply(200, { slow: true }, { headers: JSON_HEADERS })
    .delay(delay);
  return { call: 'http', with: { method: 'get', endpoint: `${origin}/slow` } };
}

describe('emit', () => {
  it('gives_an_id_a_time_and_the_spec_version_and_evaluates_the_event', async () => {
    const document = aWorkflow([
      {
        placed: {
          emit: {
            event: {
              with: {
                source: 'https://petstore.com',
                type: 'com.petstore.order.placed.v1',
                data: { client: '${ .client }', quantity: 101 },
              },
            },
          },
        },
      },
    ]);

    const { outcome, observer } = await h.run(document, { client: 'Cruella' });

    const event = outputOf(outcome) as JsonObject;
    expect(event).toMatchObject({
      specversion: '1.0',
      source: 'https://petstore.com',
      type: 'com.petstore.order.placed.v1',
      data: { client: 'Cruella', quantity: 101 },
    });
    expect(event.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(typeof event.time).toBe('string');
    expect(Number.isNaN(Date.parse(event.time as string))).toBe(false);
    expect(observer.emittedEvents).toEqual([event]);
  });

  it('keeps_the_id_and_time_the_author_gives', async () => {
    const document = aWorkflow([
      {
        placed: {
          emit: {
            event: {
              with: {
                id: '${ "order-" + (.id | tostring) }',
                time: '2026-01-01T00:00:00Z',
                source: 'https://petstore.com',
                type: 'com.petstore.order.placed.v1',
              },
            },
          },
        },
      },
    ]);

    const { outcome } = await h.run(document, { id: 9 });

    expect(outputOf(outcome)).toMatchObject({
      id: 'order-9',
      time: '2026-01-01T00:00:00Z',
      specversion: '1.0',
    });
  });

  it('refuses_the_platform_s_lifecycle_source', async () => {
    const document = aWorkflow([
      {
        fake: {
          emit: {
            event: {
              with: {
                source: '${ "/workflows/qa/probe" }',
                type: 'io.serverlessworkflow.workflow.completed.v1',
              },
            },
          },
        },
      },
    ]);

    const { outcome, observer } = await h.run(document, {});

    expect(errorOf(outcome)).toMatchObject({
      type: `${ERRORS}runtime`,
      instance: '/do/0/fake',
    });
    expect(observer.emittedEvents).toHaveLength(0);
  });
});

describe('wait', () => {
  it.each([
    ['inline_seconds', { seconds: 10 }, 10_000],
    ['inline_milliseconds', { milliseconds: 250 }, 250],
    ['iso_8601', 'PT1.5S', 1_500],
    ['mixed_units', { minutes: 1, seconds: 2 }, 62_000],
  ])(
    'a_%s_wait_sleeps_its_duration_and_keeps_the_data',
    async (_name, wait, ms) => {
      const document = aWorkflow([{ pause: { wait } }]);

      const { outcome, durability, observer } = await h.run(document, {
        kept: true,
      });

      expect(outputOf(outcome)).toEqual({ kept: true });
      expect(durability.newSleeps.map((s) => s.milliseconds)).toEqual([ms]);
      expect(observer.waitingCalls).toBe(1);
      expect(observer.runningCalls).toBe(1);
    },
  );

  it('an_expression_wait_is_evaluated_on_the_task_input', async () => {
    const document = aWorkflow([
      { pause: { wait: '${ "PT" + (.s | tostring) + "S" }' } },
    ]);

    const { durability } = await h.run(document, { s: 3 });

    expect(durability.newSleeps.map((s) => s.milliseconds)).toEqual([3_000]);
  });

  it.each([
    ['not_a_duration', 'soon'],
    ['calendar_units', 'P1M'],
  ])(
    'an_expression_wait_that_gives_%s_faults_with_an_expression_error',
    async (_name, value) => {
      const document = aWorkflow([{ pause: { wait: '${ .d }' } }]);

      const { outcome } = await h.run(document, { d: value });

      expect(errorOf(outcome)).toMatchObject({
        type: `${ERRORS}expression`,
        status: 400,
        instance: '/do/0/pause',
      });
    },
  );
});

describe('timeouts', () => {
  it('a_task_outlasting_its_timeout_faults_with_a_timeout_error', async () => {
    const call = slowCall('https://timeout-task.test', 1_500);
    const document = aWorkflow([
      { slow: { ...call, timeout: { after: { milliseconds: 200 } } } },
    ]);

    const began = Date.now();
    const { outcome } = await h.run(document, {});

    expect(errorOf(outcome)).toMatchObject({
      ...TIMEOUT,
      instance: '/do/0/slow',
    });
    expect(Date.now() - began).toBeLessThan(1_200);
  });

  it('a_task_timeout_declared_in_use_timeouts_is_used_by_name', async () => {
    const call = slowCall('https://timeout-named.test', 1_500);
    const document = aWorkflow([{ slow: { ...call, timeout: 'short' } }], {
      use: { timeouts: { short: { after: { milliseconds: 200 } } } },
    });

    const { outcome } = await h.run(document, {});

    expect(errorOf(outcome)).toMatchObject(TIMEOUT);
  });

  it('a_task_timeout_is_caught_by_a_try_on_the_timeout_type', async () => {
    const call = slowCall('https://timeout-caught.test', 1_500);
    const document = aWorkflow([
      {
        guarded: {
          try: [
            { slow: { ...call, timeout: { after: { milliseconds: 200 } } } },
          ],
          catch: {
            errors: { with: { type: `${ERRORS}timeout` } },
            do: [{ fallback: { set: { timedOut: true } } }],
          },
        },
      },
    ]);

    const { outcome } = await h.run(document, {});

    expect(outputOf(outcome)).toEqual({ timedOut: true });
  });

  it('a_task_within_its_timeout_completes', async () => {
    const document = aWorkflow([
      { quick: { set: { done: true }, timeout: { after: { seconds: 5 } } } },
    ]);

    const { outcome } = await h.run(document, {});

    expect(outputOf(outcome)).toEqual({ done: true });
  });

  it('a_wait_past_the_workflow_timeout_faults_with_a_timeout_error_at_the_deadline', async () => {
    const document = aWorkflow([{ pause: { wait: { seconds: 10 } } }], {
      timeout: { after: { seconds: 5 } },
    });

    const { outcome, durability } = await h.run(document, {});

    expect(errorOf(outcome)).toMatchObject({
      ...TIMEOUT,
      instance: '/do/0/pause',
    });
    expect(durability.newSleeps.map((s) => s.milliseconds)).toEqual([5_000]);
  });

  it('a_workflow_timeout_declared_in_use_timeouts_is_used_by_name', async () => {
    const document = aWorkflow([{ pause: { wait: { seconds: 10 } } }], {
      timeout: 'fiveSeconds',
      use: { timeouts: { fiveSeconds: { after: { seconds: 5 } } } },
    });

    const { outcome } = await h.run(document, {});

    expect(errorOf(outcome)).toMatchObject(TIMEOUT);
  });

  it('the_workflow_timeout_bounds_a_task_that_runs_past_the_deadline', async () => {
    const call = slowCall('https://timeout-workflow.test', 1_500);
    const document = aWorkflow([{ slow: call }], {
      timeout: { after: { milliseconds: 300 } },
    });

    const { outcome } = await h.run(document, {});

    expect(errorOf(outcome)).toMatchObject({
      ...TIMEOUT,
      instance: '/do/0/slow',
    });
  });

  it('a_task_that_starts_after_the_workflow_deadline_faults_with_a_timeout_error', async () => {
    const call = slowCall('https://timeout-after.test', 100);
    const document = aWorkflow(
      [{ pause: { wait: { seconds: 1 } } }, { late: call }],
      { timeout: { after: { seconds: 1 } } },
    );

    const { outcome, observer } = await h.run(document, {});

    expect(errorOf(outcome)).toMatchObject(TIMEOUT);
    expect(observer.endedNamed('late')[0]?.status).toBe(TaskStatus.Faulted);
  });

  // A task that starts with no time left before the workflow's deadline does not begin its work.
  it('a_quick_task_starting_at_the_workflow_deadline_faults_with_a_timeout_error', async () => {
    const document = aWorkflow(
      [{ pause: { wait: { seconds: 1 } } }, { late: { set: { ran: true } } }],
      { timeout: { after: { seconds: 1 } } },
    );

    const { outcome } = await h.run(document, {});

    expect(errorOf(outcome)).toMatchObject(TIMEOUT);
  });

  // DSL 1.0.3, "Timeouts": "Workflows and tasks alike can be configured to timeout"; "When a
  // timeout occur, runtimes must abruptly interrupt the execution of the workflow/task".
  it('a_wait_task_ends_at_its_own_timeout', async () => {
    const document = aWorkflow([
      {
        pause: {
          wait: { seconds: 10 },
          timeout: { after: { seconds: 1 } },
        },
      },
    ]);

    const { outcome } = await h.run(document, {});

    expect(errorOf(outcome)).toMatchObject({
      ...TIMEOUT,
      instance: '/do/0/pause',
    });
  });

  it('a_do_task_starts_no_task_past_its_own_timeout', async () => {
    const document = aWorkflow([
      {
        outer: {
          timeout: { after: { seconds: 1 } },
          do: [
            { pause: { wait: { seconds: 10 } } },
            { after: { set: { reached: true } } },
          ],
        },
      },
    ]);

    const { outcome, observer } = await h.run(document, {});

    expect(observer.startedNamed('after')).toHaveLength(0);
    expect(errorOf(outcome)).toMatchObject(TIMEOUT);
  });

  // "Duration": durations can be defined "with a runtime expression that is evaluated to an ISO
  // 8601 string"; the workflow's own timeout written so is evaluated as the run starts.
  it('a_workflow_timeout_written_as_an_expression_bounds_the_run', async () => {
    const document = aWorkflow([{ pause: { wait: { seconds: 10 } } }], {
      timeout: { after: '${ "PT1S" }' },
    });

    const { outcome } = await h.run(document, {});

    expect(errorOf(outcome)).toMatchObject(TIMEOUT);
  });
});

describe('function calls', () => {
  const greet = {
    use: {
      functions: {
        greet: { set: { greeting: '${ "Hello " + .name }' } },
      },
    },
  };

  it('the_function_s_task_runs_with_the_arguments_of_with_as_its_input', async () => {
    const document = aWorkflow(
      [{ hello: { call: 'greet', with: { name: '${ .user }' } } }],
      greet,
    );

    const { outcome, observer } = await h.run(document, { user: 'Ada' });

    expect(outputOf(outcome)).toEqual({ greeting: 'Hello Ada' });
    expect(observer.startedNamed('greet')[0]).toMatchObject({
      reference: '/use/functions/greet',
      input: { name: 'Ada' },
    });
  });

  it('the_call_task_s_own_output_and_export_apply_to_the_function_s_output', async () => {
    const document = aWorkflow(
      [
        {
          hello: {
            call: 'greet',
            with: { name: 'Bob' },
            output: { as: '${ .greeting }' },
            export: { as: '${ { said: . } }' },
          },
        },
        { after: { set: { said: '${ $context.said }', value: '${ . }' } } },
      ],
      greet,
    );

    const { outcome } = await h.run(document, {});

    expect(outputOf(outcome)).toEqual({
      said: 'Hello Bob',
      value: 'Hello Bob',
    });
  });

  it('a_fault_in_the_function_points_into_use_functions', async () => {
    const document = aWorkflow([{ invoke: { call: 'fail' } }], {
      use: {
        functions: {
          fail: {
            raise: { error: { type: 'https://example.com/f', status: 500 } },
          },
        },
      },
    });

    const { outcome } = await h.run(document, {});

    expect(errorOf(outcome)).toMatchObject({
      type: 'https://example.com/f',
      instance: '/use/functions/fail',
    });
  });

  it('a_function_called_in_a_loop_journals_each_call_apart', async () => {
    const document = aWorkflow(
      [
        {
          loop: {
            for: { each: 'who', in: '${ .people }' },
            do: [
              {
                hello: {
                  call: 'greet',
                  with: { name: '${ $who }' },
                  output: {
                    as: '${ { all: ((.all // []) + [ .greeting ]) } }',
                  },
                },
              },
            ],
          },
        },
      ],
      greet,
    );

    const { outcome, observer } = await h.run(document, {
      people: ['Ada', 'Bob'],
    });

    expect(observer.endedNamed('greet')).toHaveLength(2);
    expect(outputOf(outcome)).toMatchObject({ all: ['Hello Bob'] });
  });

  // The call journals its own steps as `<task>@start`, `<task>@with` and `<task>@end`, and the
  // function's task as `<task>:<function>`: a function named like a step does not collide.
  for (const name of ['start', 'with', 'end']) {
    it(`a_function_named_${name}_runs_apart_from_the_call_s_own_steps`, async () => {
      const document = aWorkflow([{ invoke: { call: name, with: { v: 1 } } }], {
        use: { functions: { [name]: { set: { got: '${ .v }' } } } },
      });

      const run = h.run(document, {});

      await expect(run).resolves.toMatchObject({
        outcome: { kind: RunOutcomeKind.Completed, output: { got: 1 } },
      });
    });
  }
});

describe('run: workflow and detached processes', () => {
  const child = {
    namespace: 'qa',
    name: 'child',
    version: '1.0.0',
    input: { order: '${ .order }' },
  };

  it('an_awaited_sub_workflow_starts_a_child_and_gives_its_output', async () => {
    const observer = new RecordingObserver(undefined, [], {
      outcome: (childId) => ({
        phase: Phase.Completed,
        output: { shipped: childId },
        error: null,
      }),
    });
    const document = aWorkflow([{ sub: { run: { workflow: child } } }]);

    const { outcome, durability } = await h.run(
      document,
      { order: 7 },
      {
        observer,
      },
    );

    expect(outputOf(outcome)).toEqual({ shipped: 'child-1' });
    expect(observer.childStarts).toEqual([
      {
        parentId: 'instance-1',
        request: {
          namespace: 'qa',
          name: 'child',
          version: '1.0.0',
          input: { order: 7 },
          detached: false,
        },
      },
    ]);
    expect(durability.children).toEqual([
      expect.objectContaining({ kind: 'child', childId: 'child-1' }),
    ]);
    expect(observer.outcomeReads).toEqual(['child-1']);
  });

  // "run.workflow.version": "Defaults to `latest`", the version the platform runs now.
  it.each([
    ['omitted', undefined, null],
    ['latest', 'latest', null],
    ['named', '2.0.0', '2.0.0'],
  ])('a_sub_workflow_version_%s_asks_for_%s', async (_, version, asked) => {
    const named = version === undefined ? {} : { version };
    const target: JsonObject = Object.assign(
      { namespace: 'qa', name: 'child' },
      named,
    );

    const observer = new RecordingObserver();
    const document = aWorkflow([{ sub: { run: { workflow: target } } }]);

    await h.run(document, {}, { observer, unchecked: version === undefined });

    expect(observer.childStarts[0]?.request.version).toBe(asked);
  });

  it('a_faulted_child_faults_the_task_with_the_child_s_error', async () => {
    const childError = {
      type: `${ERRORS}communication`,
      status: 503,
      instance: '/do/0/call',
    };
    const observer = new RecordingObserver(undefined, [], {
      outcome: () => ({
        phase: Phase.Faulted,
        output: null,
        error: childError,
      }),
    });
    const document = aWorkflow([{ sub: { run: { workflow: child } } }]);

    const { outcome } = await h.run(document, {}, { observer });

    expect(errorOf(outcome)).toEqual(childError);
  });

  it('a_cancelled_child_faults_the_task_with_a_runtime_error', async () => {
    const observer = new RecordingObserver(undefined, [], {
      outcome: () => ({ phase: Phase.Cancelled, output: null, error: null }),
    });
    const document = aWorkflow([{ sub: { run: { workflow: child } } }]);

    const { outcome } = await h.run(document, {}, { observer });

    expect(errorOf(outcome)).toMatchObject({
      type: `${ERRORS}runtime`,
      instance: '/do/0/sub',
    });
  });

  it('a_child_the_platform_refuses_faults_with_a_configuration_error', async () => {
    const observer = new RecordingObserver(undefined, [], {
      start: () => ({
        childId: null,
        refusal: 'qa/child@1.0.0 is not published',
      }),
    });
    const document = aWorkflow([{ sub: { run: { workflow: child } } }]);

    const { outcome, durability } = await h.run(document, {}, { observer });

    expect(errorOf(outcome)).toMatchObject({
      type: `${ERRORS}configuration`,
      status: 400,
      detail: 'qa/child@1.0.0 is not published',
    });
    expect(durability.children).toHaveLength(0);
  });

  it('a_detached_sub_workflow_starts_a_child_unawaited_and_outputs_the_transformed_input', async () => {
    const document = aWorkflow([
      {
        sub: {
          input: { from: '${ { order: .order } }' },
          run: { workflow: child, await: false },
        },
      },
    ]);

    const { outcome, observer, durability } = await h.run(document, {
      order: 7,
      noise: 1,
    });

    expect(outputOf(outcome)).toEqual({ order: 7 });
    expect(observer.childStarts[0]?.request.detached).toBe(true);
    expect(durability.children).toEqual([
      expect.objectContaining({ kind: 'detached-child', childId: 'child-1' }),
    ]);
    expect(observer.outcomeReads).toHaveLength(0);
  });

  it('a_detached_shell_command_starts_a_process_and_outputs_its_input', async () => {
    const document = aWorkflow([
      {
        notify: {
          run: {
            shell: {
              command: 'echo "$GREETING"',
              arguments: ['${ .who }'],
              environment: { GREETING: '${ "hi " + .who }' },
            },
            await: false,
          },
        },
      },
    ]);

    const { outcome, durability } = await h.run(document, { who: 'Ada' });

    expect(outputOf(outcome)).toEqual({ who: 'Ada' });
    expect(durability.processes).toHaveLength(1);
    expect(durability.processes[0]?.command).toMatchObject({
      args: ['/bin/sh', '-c', 'echo "$GREETING"', 'sh', 'Ada'],
      env: expect.arrayContaining(['GREETING=hi Ada']),
    });
  });
});
