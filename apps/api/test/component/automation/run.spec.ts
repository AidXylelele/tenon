import { ManualWorkflowClock, WorkflowWorker } from '@nestjs/workflows';
import request from 'supertest';
import { MockAgent } from 'undici';
import { Role } from '../../../src/domain/identity/enums.js';
import { EngineClock } from '../../../src/interface-adapters/workflows/runs/engine.clock.js';
import { EndpointDispatcher } from '../../../src/frameworks/undici/endpoint-dispatcher.js';
import { authHeaders, createUser, signIn } from '../../support/auth-helpers.js';
import { createTestApp, type TestApp } from '../../support/create-test-app.js';
import { truncateAll } from '../../support/db.js';

const JSON_TYPE = 'application/json';

function documentOf(name: string, body: unknown, extra: object = {}): string {
  return JSON.stringify({
    document: { dsl: '1.0.3', namespace: 'default', name, version: '1.0.0' },
    ...extra,
    do: body,
  });
}

function versionOf(name: string, version: string, body: unknown): string {
  return JSON.stringify({
    document: { dsl: '1.0.3', namespace: 'default', name, version },
    do: body,
  });
}

const runtimeError = {
  type: 'https://serverlessworkflow.io/spec/1.0.0/errors/runtime',
  status: 500,
  title: 'Boom',
};

describe('running workflows', () => {
  let t: TestApp;
  let agent: MockAgent;
  let clock: ManualWorkflowClock;
  let editor: Record<string, string>;
  let viewer: Record<string, string>;

  beforeAll(async () => {
    agent = new MockAgent();
    agent.disableNetConnect();
    clock = new ManualWorkflowClock();
    const engineClock = new EngineClock(clock);
    t = await createTestApp((builder) =>
      builder
        .overrideProvider(EndpointDispatcher)
        .useValue(agent)
        .overrideProvider(EngineClock)
        .useValue(engineClock),
    );
  });

  // The application closes the dispatcher it was given, the MockAgent included.
  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await truncateAll(t.db);
    await createUser(t, { email: 'editor@example.com', role: Role.Editor });
    await createUser(t, { email: 'viewer@example.com', role: Role.Viewer });
    editor = authHeaders(await signIn(t.server, 'editor@example.com'));
    viewer = authHeaders(await signIn(t.server, 'viewer@example.com'));
  });

  async function publish(text: string): Promise<void> {
    await request(t.server)
      .post('/api/v1/workflows')
      .set(editor)
      .type(JSON_TYPE)
      .send(text)
      .expect(201);
  }

  async function start(
    name: string,
    body: object,
    key: string | null = null,
  ): Promise<request.Response> {
    const call = request(t.server)
      .post(`/api/v1/workflows/default/${name}/instances`)
      .set(editor);

    if (key !== null) call.set('Idempotency-Key', key);

    return call.send(body);
  }

  async function drain(): Promise<void> {
    await t.app.get(WorkflowWorker).drain();
  }

  it('fork_branches_that_end_together_each_add_their_export_to_the_context', async () => {
    const branch = (name: string, value: number) => ({
      [name]: {
        set: { [name]: value },
        export: { as: `\${ $context + { ${name}: ${String(value)} } }` },
      },
    });
    await publish(
      documentOf('exports', [
        {
          split: {
            fork: {
              branches: [branch('a', 1), branch('b', 2), branch('c', 3)],
            },
          },
        },
        { read: { set: { context: '${ $context }' } } },
      ]),
    );

    const started = await start('exports', { input: {} });
    await drain();
    const instance = await request(t.server)
      .get(`/api/v1/instances/${String(started.body.id)}`)
      .set(viewer)
      .expect(200);

    expect(instance.body).toMatchObject({
      phase: 'completed',
      output: { context: { a: 1, b: 2, c: 3 } },
    });
  });

  it('a_loop_over_thousands_of_items_completes_in_one_round', async () => {
    await publish(
      documentOf('loop', [
        {
          each: {
            for: { in: '${ [range(.n)] }' },
            do: [{ one: { set: { x: 1 } } }],
          },
        },
      ]),
    );

    const started = await start('loop', { input: { n: 5000 } });
    await drain();
    const instance = await request(t.server)
      .get(`/api/v1/instances/${String(started.body.id)}`)
      .set(viewer)
      .expect(200);

    expect(instance.body).toMatchObject({ phase: 'completed' });
  }, 120_000);

  it('a_start_carries_an_input_beyond_the_default_body_limit_of_express', async () => {
    await publish(
      documentOf('large', [{ keep: { set: '${ .items | length }' } }]),
    );
    const items = Array.from(
      { length: 2000 },
      (_, index) => 'x'.repeat(100) + String(index),
    );

    const started = await start('large', { input: { items } });
    await drain();
    const instance = await request(t.server)
      .get(`/api/v1/instances/${String(started.body.id)}`)
      .set(viewer)
      .expect(200);

    expect(started.status).toBe(201);
    expect(instance.body).toMatchObject({ phase: 'completed', output: 2000 });
  });

  it('an_instance_runs_to_completion_with_the_output_the_standard_prescribes', async () => {
    await publish(
      documentOf('greet', [
        { first: { set: { greeting: 'hello' } } },
        { second: { set: { greeting: 'hello', done: true } } },
      ]),
    );

    const started = await start('greet', { input: { who: 'Ada' } });
    await drain();
    const instance = await request(t.server)
      .get(`/api/v1/instances/${String(started.body.id)}`)
      .set(viewer)
      .expect(200);
    const tasks = await request(t.server)
      .get(`/api/v1/instances/${String(started.body.id)}/tasks`)
      .set(viewer)
      .expect(200);
    const events = await request(t.server)
      .get(`/api/v1/instances/${String(started.body.id)}/events`)
      .set(viewer)
      .expect(200);

    expect(started.status).toBe(201);
    expect(started.body).toMatchObject({ phase: 'pending', version: '1.0.0' });
    expect(instance.body).toMatchObject({
      phase: 'completed',
      input: { who: 'Ada' },
      output: { greeting: 'hello', done: true },
      error: null,
    });
    expect(
      (tasks.body.items as { name: string }[]).map((task) => task.name),
    ).toEqual(['first', 'second']);
    expect(
      (events.body.items as { type: string }[]).map((event) => event.type),
    ).toEqual([
      'io.serverlessworkflow.workflow.started.v1',
      'io.serverlessworkflow.task.created.v1',
      'io.serverlessworkflow.task.started.v1',
      'io.serverlessworkflow.task.completed.v1',
      'io.serverlessworkflow.task.created.v1',
      'io.serverlessworkflow.task.started.v1',
      'io.serverlessworkflow.task.completed.v1',
      'io.serverlessworkflow.workflow.completed.v1',
    ]);
  });

  it('an_input_that_breaks_the_input_schema_faults_the_instance_with_a_validation_error', async () => {
    await publish(
      documentOf('orders', [{ a: { set: { a: 1 } } }], {
        input: {
          schema: {
            format: 'json',
            document: { type: 'object', required: ['orderId'] },
          },
        },
      }),
    );

    const started = await start('orders', { input: {} });
    await drain();
    const instance = await request(t.server)
      .get(`/api/v1/instances/${String(started.body.id)}`)
      .set(viewer)
      .expect(200);

    expect(instance.body.phase).toBe('faulted');
    expect(instance.body.error).toMatchObject({
      type: 'https://serverlessworkflow.io/spec/1.0.0/errors/validation',
      status: 400,
    });
  });

  it('a_call_to_a_service_records_its_response', async () => {
    agent
      .get('https://petstore.example')
      .intercept({ path: '/v2/pet/7', method: 'GET' })
      .reply(
        200,
        { id: 7, name: 'Rex' },
        {
          headers: { 'content-type': 'application/json' },
        },
      );
    await publish(
      documentOf('pets', [
        {
          getPet: {
            call: 'http',
            with: {
              method: 'get',
              endpoint: { uri: 'https://petstore.example/v2/pet/{petId}' },
            },
          },
        },
      ]),
    );

    const started = await start('pets', { input: { petId: 7 } });
    await drain();
    const instance = await request(t.server)
      .get(`/api/v1/instances/${String(started.body.id)}`)
      .set(viewer)
      .expect(200);

    expect(instance.body).toMatchObject({
      phase: 'completed',
      output: { id: 7, name: 'Rex' },
    });
  });

  it('a_retry_waits_on_the_engine_clock_and_spent_retries_fault_the_instance', async () => {
    await publish(
      documentOf('flaky', [
        {
          attempt: {
            try: [
              {
                fail: {
                  raise: {
                    error: {
                      type: 'https://serverlessworkflow.io/spec/1.0.0/errors/runtime',
                      status: 500,
                      title: 'Boom',
                    },
                  },
                },
              },
            ],
            catch: {
              errors: { with: { status: 500 } },
              retry: {
                delay: { seconds: 5 },
                limit: { attempt: { count: 1 } },
              },
            },
          },
        },
      ]),
    );

    const started = await start('flaky', {});
    await drain();
    const waiting = await request(t.server)
      .get(`/api/v1/instances/${String(started.body.id)}`)
      .set(viewer);
    clock.advance('5s');
    await drain();
    const ended = await request(t.server)
      .get(`/api/v1/instances/${String(started.body.id)}`)
      .set(viewer);

    expect(waiting.body.phase).toBe('waiting');
    expect(ended.body.phase).toBe('faulted');
    expect(ended.body.error).toMatchObject({ title: 'Boom' });
  });

  it('a_repeated_start_with_the_same_key_returns_the_first_instance', async () => {
    await publish(documentOf('greet', [{ a: { set: { a: 1 } } }]));

    const first = await start('greet', { input: { n: 1 } }, 'key-1');
    const again = await start('greet', { input: { n: 1 } }, 'key-1');
    const list = await request(t.server)
      .get('/api/v1/instances?namespace=default&name=greet')
      .set(viewer)
      .expect(200);

    expect(again.body.id).toBe(first.body.id);
    expect(list.body.items).toHaveLength(1);
  });

  it('a_start_names_a_version_or_runs_the_current_one', async () => {
    await publish(versionOf('greet', '1.0.0', [{ a: { set: { a: 1 } } }]));
    await publish(versionOf('greet', '2.0.0', [{ a: { set: { a: 2 } } }]));

    const current = await start('greet', {});
    const named = await start('greet', { version: '1.0.0' });
    const unknown = await start('greet', { version: '9.9.9' });
    const missing = await request(t.server)
      .post('/api/v1/workflows/default/nothing/instances')
      .set(editor)
      .send({});

    expect(current.body.version).toBe('2.0.0');
    expect(named.body.version).toBe('1.0.0');
    expect(unknown.status).toBe(404);
    expect(missing.status).toBe(404);
  });

  it('the_same_key_with_another_input_is_refused', async () => {
    await publish(documentOf('greet', [{ a: { set: { a: 1 } } }]));

    const first = await start('greet', { input: { n: 1 } }, 'key-2');
    const other = await start('greet', { input: { n: 2 } }, 'key-2');
    const version = await start(
      'greet',
      { version: '1.0.0', input: { n: 1 } },
      'key-2',
    );

    expect(first.status).toBe(201);
    expect(other.status).toBe(422);
    expect(version.status).toBe(422);
  });

  it('a_workflow_timeout_faults_the_instance_with_a_timeout_error', async () => {
    await publish(
      documentOf(
        'slow',
        [
          {
            attempt: {
              try: [{ fail: { raise: { error: runtimeError } } }],
              catch: {
                errors: { with: { status: 500 } },
                retry: {
                  delay: { seconds: 5 },
                  limit: { attempt: { count: 3 } },
                },
              },
            },
          },
        ],
        { timeout: { after: { seconds: 2 } } },
      ),
    );

    const started = await start('slow', {});
    await drain();
    clock.advance('2s');
    await drain();
    const instance = await request(t.server)
      .get(`/api/v1/instances/${String(started.body.id)}`)
      .set(viewer)
      .expect(200);

    expect(instance.body.phase).toBe('faulted');
    expect(instance.body.error).toMatchObject({
      type: 'https://serverlessworkflow.io/spec/1.0.0/errors/timeout',
      status: 408,
    });
  });

  it('instances_are_filtered_by_workflow_version_phase_and_start_and_read_page_by_page', async () => {
    await publish(versionOf('greet', '1.0.0', [{ a: { set: { a: 1 } } }]));
    await publish(versionOf('other', '1.0.0', [{ a: { set: { a: 1 } } }]));
    await start('greet', {});
    await start('greet', {});
    await start('other', {});
    await drain();
    const since = clock.now();

    const byName = await request(t.server)
      .get('/api/v1/instances?name=greet')
      .set(viewer)
      .expect(200);
    const byNamespace = await request(t.server)
      .get('/api/v1/instances?namespace=nowhere')
      .set(viewer)
      .expect(200);
    const byPhase = await request(t.server)
      .get('/api/v1/instances?phase=completed&version=1.0.0')
      .set(viewer)
      .expect(200);
    const later = await request(t.server)
      .get(`/api/v1/instances?startedFrom=${new Date(since + 1).toISOString()}`)
      .set(viewer)
      .expect(200);
    const first = await request(t.server)
      .get('/api/v1/instances?limit=2')
      .set(viewer)
      .expect(200);
    const second = await request(t.server)
      .get(`/api/v1/instances?limit=2&cursor=${String(first.body.next)}`)
      .set(viewer)
      .expect(200);
    const malformed = await request(t.server)
      .get('/api/v1/instances?cursor=bm9wZQ')
      .set(viewer);

    expect(byName.body.items).toHaveLength(2);
    expect(byNamespace.body.items).toHaveLength(0);
    expect(byPhase.body.items).toHaveLength(3);
    expect(later.body.items).toHaveLength(0);
    expect(first.body.items).toHaveLength(2);
    expect(second.body.items).toHaveLength(1);
    expect(second.body.next).toBeNull();
    expect(malformed.status).toBe(400);
  });

  it('task_records_show_status_input_output_error_retries_and_their_parent', async () => {
    await publish(
      documentOf('records', [
        { skipped: { if: '${ false }', set: { never: true } } },
        {
          outer: {
            do: [{ inner: { set: { inner: true } } }],
          },
        },
        {
          attempt: {
            try: [{ fail: { raise: { error: runtimeError } } }],
            catch: {
              errors: { with: { status: 500 } },
              retry: {
                delay: { seconds: 1 },
                limit: { attempt: { count: 1 } },
              },
            },
          },
        },
      ]),
    );

    const started = await start('records', { input: { n: 1 } });
    await drain();
    clock.advance('1s');
    await drain();
    const tasks = await request(t.server)
      .get(`/api/v1/instances/${String(started.body.id)}/tasks`)
      .set(viewer)
      .expect(200);

    const events = await request(t.server)
      .get(`/api/v1/instances/${String(started.body.id)}/events?limit=500`)
      .set(viewer)
      .expect(200);
    const records = tasks.body.items as {
      id: string;
      name: string;
      status: string;
      parentId: string | null;
      input: unknown;
      output: unknown;
      error: { status: number } | null;
      retries: number;
    }[];
    const types = (events.body.items as { type: string }[]).map(
      (event) => event.type,
    );
    const skipped = records.find((record) => record.name === 'skipped');
    const outer = records.find((record) => record.name === 'outer');
    const inner = records.find((record) => record.name === 'inner');
    const attempts = records.filter((record) => record.name === 'attempt');
    const failed = records.filter((record) => record.name === 'fail');
    expect(skipped).toMatchObject({
      status: 'skipped',
      parentId: null,
      input: { n: 1 },
      output: { n: 1 },
    });
    expect(outer?.parentId).toBeNull();
    expect(inner?.parentId).toBe(outer?.id);
    expect(attempts.at(-1)?.status).toBe('faulted');
    expect(attempts.at(-1)?.retries).toBe(1);
    expect(failed).toHaveLength(2);
    expect(failed[0]?.error?.status).toBe(500);
    expect(types).toContain('io.serverlessworkflow.task.retried.v1');
  });

  it('task_records_and_lifecycle_events_are_read_page_by_page', async () => {
    await publish(
      documentOf('steps', [
        { one: { set: { n: 1 } } },
        { two: { set: { n: 2 } } },
        { three: { set: { n: 3 } } },
      ]),
    );

    const started = await start('steps', {});
    await drain();
    const path = `/api/v1/instances/${String(started.body.id)}`;
    const firstTasks = await request(t.server)
      .get(`${path}/tasks?limit=2`)
      .set(viewer)
      .expect(200);
    const restTasks = await request(t.server)
      .get(`${path}/tasks?limit=2&cursor=${String(firstTasks.body.next)}`)
      .set(viewer)
      .expect(200);
    const firstEvents = await request(t.server)
      .get(`${path}/events?limit=4`)
      .set(viewer)
      .expect(200);
    const restEvents = await request(t.server)
      .get(`${path}/events?limit=20&cursor=${String(firstEvents.body.next)}`)
      .set(viewer)
      .expect(200);
    const malformed = await request(t.server)
      .get(`${path}/tasks?cursor=next`)
      .set(viewer);

    const names = (firstTasks.body.items as { name: string }[])
      .concat(restTasks.body.items as { name: string }[])
      .map((task) => task.name);
    expect(names).toEqual(['one', 'two', 'three']);
    expect(restTasks.body.next).toBeNull();
    expect(firstEvents.body.items).toHaveLength(4);
    expect(restEvents.body.items).toHaveLength(7);
    expect(restEvents.body.next).toBeNull();
    expect(malformed.status).toBe(400);
  });

  it('a_faulted_run_announces_the_faulted_task_and_workflow', async () => {
    await publish(
      documentOf('boom', [{ fail: { raise: { error: runtimeError } } }]),
    );

    const started = await start('boom', {});
    await drain();
    const events = await request(t.server)
      .get(`/api/v1/instances/${String(started.body.id)}/events`)
      .set(viewer)
      .expect(200);

    const items = events.body.items as {
      type: string;
      data: { error?: { title?: string } };
    }[];
    const types = items.map((event) => event.type);
    expect(types).toEqual([
      'io.serverlessworkflow.workflow.started.v1',
      'io.serverlessworkflow.task.created.v1',
      'io.serverlessworkflow.task.started.v1',
      'io.serverlessworkflow.task.faulted.v1',
      'io.serverlessworkflow.workflow.faulted.v1',
    ]);
    expect(items.at(-1)?.data.error?.title).toBe('Boom');
  });

  it('input_that_looks_like_an_expression_is_never_evaluated', async () => {
    await publish(
      documentOf('echo', [{ copy: { set: { copied: '${ .a }' } } }]),
    );

    const started = await start('echo', { input: { a: '${ 1 + 1 }' } });
    await drain();
    const instance = await request(t.server)
      .get(`/api/v1/instances/${String(started.body.id)}`)
      .set(viewer)
      .expect(200);

    expect(instance.body.output).toEqual({ copied: '${ 1 + 1 }' });
  });

  it('a_viewer_cannot_start_an_instance', async () => {
    await publish(documentOf('greet', [{ a: { set: { a: 1 } } }]));

    const refused = await request(t.server)
      .post('/api/v1/workflows/default/greet/instances')
      .set(viewer)
      .send({});

    expect(refused.status).toBe(403);
  });

  it('a_run_workflow_task_runs_its_sub_workflow_and_completes_with_its_output', async () => {
    await publish(documentOf('child', [{ send: { set: { sent: true } } }]));
    await publish(
      documentOf('parent', [
        {
          invoice: {
            run: {
              workflow: {
                namespace: 'default',
                name: 'child',
                version: 'latest',
              },
            },
          },
        },
      ]),
    );

    const started = await start('parent', { input: { id: 1 } });
    await drain();
    await drain();
    const instance = await request(t.server)
      .get(`/api/v1/instances/${String(started.body.id)}`)
      .set(viewer)
      .expect(200);
    const children = await request(t.server)
      .get('/api/v1/instances?namespace=default&name=child')
      .set(viewer)
      .expect(200);

    expect(instance.body).toMatchObject({
      phase: 'completed',
      output: { sent: true },
    });
    expect(children.body.items).toHaveLength(1);
  });

  it('a_run_workflow_task_naming_an_unpublished_workflow_faults_with_a_configuration_error', async () => {
    await publish(
      documentOf('parent', [
        {
          invoice: {
            run: {
              workflow: {
                namespace: 'default',
                name: 'absent',
                version: '1.0.0',
              },
            },
          },
        },
      ]),
    );

    const started = await start('parent', {});
    await drain();
    const instance = await request(t.server)
      .get(`/api/v1/instances/${String(started.body.id)}`)
      .set(viewer)
      .expect(200);

    expect(instance.body.phase).toBe('faulted');
    expect(instance.body.error).toMatchObject({
      type: 'https://serverlessworkflow.io/spec/1.0.0/errors/configuration',
      status: 400,
      instance: '/do/0/invoice',
    });
  });

  it('a_hundred_concurrent_starts_with_one_key_create_one_instance', async () => {
    await publish(documentOf('greet', [{ a: { set: { a: 1 } } }]));

    const starts = Array.from({ length: 100 }, () =>
      start('greet', { input: { n: 1 } }, 'same-key'),
    );
    const responses = await Promise.all(starts);
    const list = await request(t.server)
      .get('/api/v1/instances?namespace=default&name=greet')
      .set(viewer)
      .expect(200);

    const created = responses.filter((response) => response.status === 201);
    const statuses = new Set(responses.map((response) => response.status));
    expect(created.length).toBeGreaterThan(0);
    expect([...statuses].every((status) => [201, 409].includes(status))).toBe(
      true,
    );
    expect(list.body.items).toHaveLength(1);
  });
});
