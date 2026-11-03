import request from 'supertest';
import { Role } from '../../../src/domain/identity/enums.js';
import { authHeaders, createUser, signIn } from '../../support/auth-helpers.js';
import { aDocument } from '../../support/builders.js';
import type { TestApp } from '../../support/create-test-app.js';
import {
  createRunApp,
  drain,
  instanceOf,
  namesOf,
  publish,
  type RunApp,
  resetRuns,
  start,
  statusesOf,
  tasksOf,
} from '../../support/run-helpers.js';

const PROBLEM = 'application/problem+json';
const ERRORS = 'https://serverlessworkflow.io/spec/1.0.0/errors/';
const SUMMARY_KEYS = [
  'createdAt',
  'endedAt',
  'id',
  'name',
  'namespace',
  'phase',
  'startedAt',
  'trigger',
  'version',
];

// A version whose output names it, so a run shows which version it ran.
const aVersion = (version: string) =>
  aDocument({ version }, [{ greet: { set: { ranVersion: version } } }]);

describe('running a workflow and following its execution over HTTP', () => {
  let run: RunApp;
  let t: TestApp;
  let editor: Record<string, string>;
  let viewer: Record<string, string>;
  let editorId: string;

  beforeAll(async () => {
    run = await createRunApp();
    t = run.t;
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await resetRuns(t);
    const author = await createUser(t, {
      email: 'editor@example.com',
      role: Role.Editor,
    });
    editorId = author.id;
    await createUser(t, { email: 'viewer@example.com', role: Role.Viewer });
    editor = authHeaders(await signIn(t.server, 'editor@example.com'));
    viewer = authHeaders(await signIn(t.server, 'viewer@example.com'));
  });

  describe('starting', () => {
    it('a_start_without_a_version_answers_a_pending_summary_of_the_current_version', async () => {
      await publish(t, editor, aVersion('1.0.0'));
      await publish(t, editor, aVersion('1.1.0'));

      const started = await request(t.server)
        .post('/api/v1/workflows/sales/route-lead/instances')
        .set(editor)
        .send({ input: { lead: 'ada' } })
        .expect(201);
      await drain(t);
      const instance = await instanceOf(t, viewer, String(started.body.id));

      expect(Object.keys(started.body).sort()).toEqual(SUMMARY_KEYS);
      expect(started.body).toMatchObject({
        namespace: 'sales',
        name: 'route-lead',
        version: '1.1.0',
        phase: 'pending',
        trigger: 'manual',
        startedAt: null,
        endedAt: null,
      });
      expect(instance).toMatchObject({
        phase: 'completed',
        version: '1.1.0',
        output: { ranVersion: '1.1.0' },
      });
    });

    it('a_start_of_a_named_version_runs_that_version_and_not_the_current_one', async () => {
      await publish(t, editor, aVersion('1.0.0'));
      await publish(t, editor, aVersion('1.1.0'));

      const started = await start(t, editor, { version: '1.0.0', input: {} });
      await drain(t);
      const instance = await instanceOf(t, viewer, started.id);

      expect(started.body.version).toBe('1.0.0');
      expect(instance).toMatchObject({
        phase: 'completed',
        version: '1.0.0',
        output: { ranVersion: '1.0.0' },
      });
    });

    // The contract (openapi.yaml, StartInstance.version): "A published semantic version, or `latest`".
    it('a_start_of_the_version_latest_runs_the_current_version', async () => {
      await publish(t, editor, aVersion('1.0.0'));
      await publish(t, editor, aVersion('1.1.0'));

      const started = await request(t.server)
        .post('/api/v1/workflows/sales/route-lead/instances')
        .set(editor)
        .send({ version: 'latest', input: {} });

      expect(started.status).toBe(201);
      expect(started.body.version).toBe('1.1.0');
    });

    it('an_omitted_input_starts_with_an_empty_object', async () => {
      await publish(t, editor, aDocument());

      const started = await start(t, editor, {});
      const instance = await instanceOf(t, viewer, started.id);

      expect(instance.input).toEqual({});
    });

    it('any_json_value_is_an_input', async () => {
      await publish(t, editor, aDocument());

      const list = await start(t, editor, { input: [1, 'two', null] });
      const text = await start(t, editor, { input: 'plain' });

      expect((await instanceOf(t, viewer, list.id)).input).toEqual([
        1,
        'two',
        null,
      ]);
      expect((await instanceOf(t, viewer, text.id)).input).toBe('plain');
    });

    it('an_unknown_workflow_is_not_found', async () => {
      const missing = await request(t.server)
        .post('/api/v1/workflows/sales/missing/instances')
        .set(editor)
        .send({ input: {} })
        .expect(404);

      expect(missing.headers['content-type']).toContain(PROBLEM);
      expect(missing.body).toMatchObject({
        type: 'urn:problem:workflow.not-found',
        status: 404,
      });
    });

    it('an_unpublished_version_is_not_found_and_starts_nothing', async () => {
      await publish(t, editor, aDocument());

      const missing = await request(t.server)
        .post('/api/v1/workflows/sales/route-lead/instances')
        .set(editor)
        .send({ version: '9.9.9', input: {} })
        .expect(404);
      const list = await request(t.server)
        .get('/api/v1/instances')
        .set(viewer)
        .expect(200);

      expect(missing.headers['content-type']).toContain(PROBLEM);
      expect(missing.body).toMatchObject({
        type: 'urn:problem:version.not-found',
        status: 404,
      });
      expect(list.body.items).toEqual([]);
    });

    it('an_archived_workflow_starts_no_instance', async () => {
      await publish(t, editor, aDocument());
      await request(t.server)
        .post('/api/v1/workflows/sales/route-lead/archive')
        .set(editor)
        .expect(204);

      const refused = await request(t.server)
        .post('/api/v1/workflows/sales/route-lead/instances')
        .set(editor)
        .send({ input: {} })
        .expect(409);
      const named = await request(t.server)
        .post('/api/v1/workflows/sales/route-lead/instances')
        .set(editor)
        .send({ version: '1.0.0', input: {} })
        .expect(409);

      expect(refused.headers['content-type']).toContain(PROBLEM);
      expect(refused.body).toMatchObject({
        type: 'urn:problem:workflow.archived',
        status: 409,
      });
      expect(named.body.type).toBe('urn:problem:workflow.archived');
    });

    it('a_malformed_start_body_is_a_bad_request', async () => {
      await publish(t, editor, aDocument());
      const url = '/api/v1/workflows/sales/route-lead/instances';

      await request(t.server)
        .post(url)
        .set(editor)
        .send({ input: {}, extra: true })
        .expect(400);
      await request(t.server)
        .post(url)
        .set(editor)
        .send({ version: 1, input: {} })
        .expect(400);
      await request(t.server).post(url).set(editor).send([1, 2]).expect(400);
      await request(t.server)
        .post(url)
        .set(editor)
        .type('text/plain')
        .send('hello')
        .expect(415);
      const list = await request(t.server)
        .get('/api/v1/instances')
        .set(viewer)
        .expect(200);

      expect(list.body.items).toEqual([]);
    });

    // The contract: `version` has `minLength: 1`.
    it('an_empty_version_is_a_bad_request', async () => {
      await publish(t, editor, aDocument());

      await request(t.server)
        .post('/api/v1/workflows/sales/route-lead/instances')
        .set(editor)
        .send({ version: '', input: {} })
        .expect(400);
    });

    it('an_input_that_violates_the_input_schema_starts_an_instance_that_faults_with_a_validation_error', async () => {
      const document = {
        ...aDocument(),
        input: {
          schema: {
            format: 'json',
            document: {
              type: 'object',
              required: ['lead'],
              properties: { lead: { type: 'string' } },
            },
          },
        },
      };
      await publish(t, editor, document);

      const started = await start(t, editor, { input: { lead: 42 } });
      await drain(t);
      const instance = await instanceOf(t, viewer, started.id);
      const tasks = await tasksOf(t, viewer, started.id);

      expect(instance.phase).toBe('faulted');
      expect(instance.output).toBeNull();
      expect(instance.error).toMatchObject({
        type: `${ERRORS}validation`,
        status: 400,
      });
      expect(tasks).toEqual([]);
    });
  });

  describe('idempotency', () => {
    it('a_repeated_start_with_the_same_key_answers_the_same_instance_and_starts_one', async () => {
      await publish(t, editor, aDocument());
      const url = '/api/v1/workflows/sales/route-lead/instances';

      const first = await request(t.server)
        .post(url)
        .set(editor)
        .set('Idempotency-Key', 'start-1')
        .send({ input: { lead: 'ada' } })
        .expect(201);
      const again = await request(t.server)
        .post(url)
        .set(editor)
        .set('Idempotency-Key', 'start-1')
        .send({ input: { lead: 'ada' } })
        .expect(201);
      const list = await request(t.server)
        .get('/api/v1/instances')
        .set(viewer)
        .expect(200);

      expect(again.body).toEqual(first.body);
      expect(list.body.items).toHaveLength(1);
    });

    it('the_same_key_with_another_input_or_version_is_refused_and_starts_nothing', async () => {
      await publish(t, editor, aVersion('1.0.0'));
      await publish(t, editor, aVersion('1.1.0'));
      const url = '/api/v1/workflows/sales/route-lead/instances';
      await request(t.server)
        .post(url)
        .set(editor)
        .set('Idempotency-Key', 'start-2')
        .send({ input: { lead: 'ada' } })
        .expect(201);

      const otherInput = await request(t.server)
        .post(url)
        .set(editor)
        .set('Idempotency-Key', 'start-2')
        .send({ input: { lead: 'bob' } });
      const otherVersion = await request(t.server)
        .post(url)
        .set(editor)
        .set('Idempotency-Key', 'start-2')
        .send({ version: '1.0.0', input: { lead: 'ada' } });
      const list = await request(t.server)
        .get('/api/v1/instances')
        .set(viewer)
        .expect(200);

      expect(otherInput.status).toBe(422);
      expect(otherVersion.status).toBe(422);
      expect(list.body.items).toHaveLength(1);
    });

    // FR-009 compares the version and the input: an omitted input is the empty object (contract).
    it('an_omitted_input_and_an_empty_object_are_the_same_request_under_one_key', async () => {
      await publish(t, editor, aDocument());
      const url = '/api/v1/workflows/sales/route-lead/instances';
      const first = await request(t.server)
        .post(url)
        .set(editor)
        .set('Idempotency-Key', 'start-3')
        .send({})
        .expect(201);

      const again = await request(t.server)
        .post(url)
        .set(editor)
        .set('Idempotency-Key', 'start-3')
        .send({ input: {} });

      expect(again.status).toBe(201);
      expect(again.body.id).toBe(first.body.id);
    });

    // SC-010: concurrent starts with one key create exactly one instance.
    it('concurrent_starts_with_the_same_key_create_one_instance', async () => {
      await publish(t, editor, aDocument());
      const url = '/api/v1/workflows/sales/route-lead/instances';
      const attempts = Array.from({ length: 8 }, () =>
        request(t.server)
          .post(url)
          .set(editor)
          .set('Idempotency-Key', 'start-concurrent')
          .send({ input: { lead: 'ada' } })
          .then((response) => response),
      );

      const responses = await Promise.all(attempts);
      const list = await request(t.server)
        .get('/api/v1/instances')
        .set(viewer)
        .expect(200);
      const created = responses.filter((response) => response.status === 201);
      const ids = new Set(created.map((response) => String(response.body.id)));

      expect(
        responses.every((response) => [201, 409].includes(response.status)),
      ).toBe(true);
      expect(ids.size).toBe(1);
      expect(list.body.items).toHaveLength(1);
    });

    // A key names one request: its refusal is its answer too, as @nestjs/idempotency stores every
    // outcome below 500 by default and Stripe keeps a 4xx its endpoint answered. A later attempt
    // takes a new key.
    it('a_start_refused_as_not_found_answers_the_same_under_its_key', async () => {
      const url = '/api/v1/workflows/sales/route-lead/instances';
      await request(t.server)
        .post(url)
        .set(editor)
        .set('Idempotency-Key', 'start-early')
        .send({ input: {} })
        .expect(404);
      await publish(t, editor, aDocument());

      const retried = await request(t.server)
        .post(url)
        .set(editor)
        .set('Idempotency-Key', 'start-early')
        .send({ input: {} });
      const fresh = await request(t.server)
        .post(url)
        .set(editor)
        .set('Idempotency-Key', 'start-later')
        .send({ input: {} });

      expect(retried.status).toBe(404);
      expect(fresh.status).toBe(201);
    });

    it('a_malformed_key_is_a_bad_request', async () => {
      await publish(t, editor, aDocument());

      await request(t.server)
        .post('/api/v1/workflows/sales/route-lead/instances')
        .set(editor)
        .set('Idempotency-Key', 'x'.repeat(300))
        .send({ input: {} })
        .expect(400);
    });
  });

  describe('following a run', () => {
    it('a_run_completes_with_its_output_and_its_task_records_in_start_order', async () => {
      const document = aDocument({}, [
        { first: { set: { a: 1 } } },
        { skipped: { if: '${ false }', set: { never: true } } },
        { second: { set: { a: '${ .a }', b: 2 } } },
      ]);
      await publish(t, editor, document);

      const started = await start(t, editor, { input: { lead: 'ada' } });
      const pending = await instanceOf(t, viewer, started.id);
      await drain(t);
      const instance = await instanceOf(t, viewer, started.id);
      const tasks = await tasksOf(t, viewer, started.id);

      expect(pending.phase).toBe('pending');
      expect(instance).toMatchObject({
        phase: 'completed',
        trigger: 'manual',
        input: { lead: 'ada' },
        output: { a: 1, b: 2 },
        error: null,
        originId: null,
        starterId: editorId,
      });
      expect(instance.startedAt).not.toBeNull();
      expect(instance.endedAt).not.toBeNull();
      expect(statusesOf(tasks)).toEqual([
        'first:completed',
        'skipped:skipped',
        'second:completed',
      ]);
      expect(tasks.map((task) => task.reference)).toEqual([
        '/do/0/first',
        '/do/1/skipped',
        '/do/2/second',
      ]);
      expect(tasks[0]).toMatchObject({
        input: { lead: 'ada' },
        output: { a: 1 },
        error: null,
      });
      expect(tasks[1]).toMatchObject({ input: { a: 1 }, output: { a: 1 } });
      expect(tasks.every((task) => task.endedAt !== null)).toBe(true);
    });

    it('task_records_lie_within_their_instance_run', async () => {
      await publish(t, editor, aDocument());

      const started = await start(t, editor);
      await drain(t);
      const instance = await instanceOf(t, viewer, started.id);
      const [task] = await tasksOf(t, viewer, started.id);
      const begun = Date.parse(String(instance.startedAt));
      const ended = Date.parse(String(instance.endedAt));

      expect(Date.parse(String(task?.startedAt))).toBeGreaterThanOrEqual(begun);
      expect(Date.parse(String(task?.endedAt))).toBeLessThanOrEqual(ended);
    });

    it('an_uncaught_raise_faults_the_instance_with_the_standard_error_shape', async () => {
      const document = aDocument({}, [
        { check: { set: { checked: true } } },
        {
          refuse: {
            raise: {
              error: {
                type: `${ERRORS}validation`,
                status: 400,
                title: 'Lead refused',
                detail: 'The lead has no email',
              },
            },
          },
        },
        { never: { set: { reached: true } } },
      ]);
      await publish(t, editor, document);

      const started = await start(t, editor);
      await drain(t);
      const instance = await instanceOf(t, viewer, started.id);
      const tasks = await tasksOf(t, viewer, started.id);

      expect(instance.phase).toBe('faulted');
      expect(instance.output).toBeNull();
      expect(instance.endedAt).not.toBeNull();
      expect(instance.error).toEqual({
        type: `${ERRORS}validation`,
        status: 400,
        title: 'Lead refused',
        detail: 'The lead has no email',
        instance: '/do/1/refuse',
      });
      expect(statusesOf(tasks)).toEqual(['check:completed', 'refuse:faulted']);
      expect(tasks[1]?.error).toEqual(instance.error);
    });

    it('a_failing_expression_faults_with_an_expression_error_located_at_its_task', async () => {
      const document = aDocument({}, [
        { compute: { set: { value: '${ .lead | tonumber }' } } },
      ]);
      await publish(t, editor, document);

      const started = await start(t, editor, {
        input: { lead: 'not-a-number' },
      });
      await drain(t);
      const instance = await instanceOf(t, viewer, started.id);

      expect(instance.phase).toBe('faulted');
      expect(instance.error).toMatchObject({
        type: `${ERRORS}expression`,
        status: 400,
        instance: '/do/0/compute',
      });
      expect(typeof instance.error?.title).toBe('string');
    });

    it('task_records_page_in_start_order', async () => {
      const document = aDocument({}, [
        { one: { set: { n: 1 } } },
        { two: { set: { n: 2 } } },
        { three: { set: { n: 3 } } },
      ]);
      await publish(t, editor, document);
      const started = await start(t, editor);
      await drain(t);
      const url = `/api/v1/instances/${started.id}/tasks`;

      const first = await request(t.server)
        .get(`${url}?limit=2`)
        .set(viewer)
        .expect(200);
      const second = await request(t.server)
        .get(`${url}?limit=2&cursor=${String(first.body.next)}`)
        .set(viewer)
        .expect(200);

      expect(namesOf(first.body.items)).toEqual(['one', 'two']);
      expect(namesOf(second.body.items)).toEqual(['three']);
      expect(second.body.next).toBeNull();
      await request(t.server).get(`${url}?limit=0`).set(viewer).expect(400);
      await request(t.server).get(`${url}?limit=501`).set(viewer).expect(400);
      await request(t.server).get(`${url}?cursor=abc`).set(viewer).expect(400);
    });

    it('an_unknown_or_malformed_instance_id_is_answered_as_such', async () => {
      const unknown = '00000000-0000-4000-8000-000000000000';

      const missing = await request(t.server)
        .get(`/api/v1/instances/${unknown}`)
        .set(viewer)
        .expect(404);
      await request(t.server)
        .get(`/api/v1/instances/${unknown}/tasks`)
        .set(viewer)
        .expect(404);
      await request(t.server)
        .get('/api/v1/instances/not-a-uuid')
        .set(viewer)
        .expect(400);

      expect(missing.headers['content-type']).toContain(PROBLEM);
      expect(missing.body).toMatchObject({
        type: 'urn:problem:instance.not-found',
        status: 404,
      });
    });

    // Wall time of one simple run, start to completion, over HTTP and the engine.
    it('a_simple_run_takes_little_wall_time', async () => {
      await publish(t, editor, aDocument());
      const runs = 10;
      const times: number[] = [];

      for (let index = 0; index < runs; index += 1) {
        const begun = performance.now();
        const started = await start(t, editor);
        await drain(t);
        const instance = await instanceOf(t, viewer, started.id);
        const elapsed = performance.now() - begun;
        times.push(elapsed);
        expect(instance.phase).toBe('completed');
      }

      const sorted = times.slice().sort((a, b) => a - b);
      const mean = times.reduce((sum, time) => sum + time, 0) / runs;
      const median = sorted[Math.floor(runs / 2)] ?? 0;
      const max = sorted.at(-1) ?? 0;
      console.info(
        `[wall time] simple run (start + drain + read), ${String(runs)} runs: mean ${mean.toFixed(1)} ms, median ${median.toFixed(1)} ms, max ${max.toFixed(1)} ms`,
      );
      expect(median).toBeLessThan(2_000);
    });
  });

  describe('listing', () => {
    async function seed(): Promise<Record<string, string>> {
      await publish(t, editor, aDocument({ name: 'alpha' }));
      await publish(t, editor, aDocument({ name: 'beta' }));
      await publish(t, editor, aDocument({ namespace: 'ops', name: 'alpha' }));
      const a1 = await start(t, editor, { input: {} }, 'sales/alpha');
      await drain(t);
      run.clock.advance('1s');
      const a2 = await start(t, editor, { input: {} }, 'sales/alpha');
      run.clock.advance('1s');
      const b1 = await start(t, editor, { input: {} }, 'sales/beta');
      run.clock.advance('1s');
      const o1 = await start(t, editor, { input: {} }, 'ops/alpha');
      return { a1: a1.id, a2: a2.id, b1: b1.id, o1: o1.id };
    }

    const idsOf = (body: { items: { id: string }[] }) =>
      body.items.map((item) => item.id);

    it('instances_list_newest_first_page_by_page', async () => {
      const ids = await seed();

      const first = await request(t.server)
        .get('/api/v1/instances?limit=3')
        .set(viewer)
        .expect(200);
      const second = await request(t.server)
        .get(`/api/v1/instances?limit=3&cursor=${String(first.body.next)}`)
        .set(viewer)
        .expect(200);

      expect(idsOf(first.body)).toEqual([ids.o1, ids.b1, ids.a2]);
      expect(idsOf(second.body)).toEqual([ids.a1]);
      expect(second.body.next).toBeNull();
      expect(Object.keys(first.body.items[0]).sort()).toEqual(SUMMARY_KEYS);
    });

    it('instances_with_one_creation_time_still_page_without_loss_or_repeat', async () => {
      await publish(t, editor, aDocument());
      const started: string[] = [];

      for (let index = 0; index < 5; index += 1)
        started.push((await start(t, editor)).id);

      const seen: string[] = [];
      let cursor: string | null = null;

      for (let page = 0; page < 10; page += 1) {
        const query: string =
          cursor === null ? '?limit=2' : `?limit=2&cursor=${cursor}`;
        const response = await request(t.server)
          .get(`/api/v1/instances${query}`)
          .set(viewer)
          .expect(200);
        seen.push(...idsOf(response.body));
        cursor = response.body.next as string | null;

        if (cursor === null) break;
      }

      expect(seen.slice().sort()).toEqual(started.slice().sort());
    });

    it('instances_filter_by_namespace_name_and_phase', async () => {
      const ids = await seed();
      const list = async (query: string) => {
        const response = await request(t.server)
          .get(`/api/v1/instances?${query}`)
          .set(viewer)
          .expect(200);
        return idsOf(response.body);
      };

      expect(await list('name=alpha')).toEqual([ids.o1, ids.a2, ids.a1]);
      expect(await list('namespace=sales')).toEqual([ids.b1, ids.a2, ids.a1]);
      expect(await list('namespace=sales&name=alpha')).toEqual([
        ids.a2,
        ids.a1,
      ]);
      expect(await list('phase=completed')).toEqual([ids.a1]);
      expect(await list('phase=pending&name=alpha')).toEqual([ids.o1, ids.a2]);
      expect(await list('namespace=none')).toEqual([]);
    });

    it('a_malformed_filter_cursor_or_limit_is_a_bad_request', async () => {
      const bad = [
        'phase=sleeping',
        'limit=0',
        'limit=201',
        'limit=ten',
        'cursor=garbage',
        'unknown=1',
      ];

      for (const query of bad)
        await request(t.server)
          .get(`/api/v1/instances?${query}`)
          .set(viewer)
          .expect(400);
    });

    // The contract lists `version`, `startedFrom` and `startedTo` as filters of GET /instances.
    it('instances_filter_by_version_and_start_time_as_the_contract_lists', async () => {
      await publish(t, editor, aVersion('1.0.0'));
      await start(t, editor);

      await request(t.server)
        .get('/api/v1/instances?version=1.0.0')
        .set(viewer)
        .expect(200);
      await request(t.server)
        .get('/api/v1/instances?startedFrom=2020-01-01T00:00:00Z')
        .set(viewer)
        .expect(200);
    });
  });

  describe('access', () => {
    it('a_viewer_reads_instances_but_starts_and_controls_none', async () => {
      await publish(t, editor, aDocument());
      const started = await start(t, editor);
      await drain(t);
      const id = started.id;

      await request(t.server).get('/api/v1/instances').set(viewer).expect(200);
      await request(t.server)
        .get(`/api/v1/instances/${id}`)
        .set(viewer)
        .expect(200);
      await request(t.server)
        .get(`/api/v1/instances/${id}/tasks`)
        .set(viewer)
        .expect(200);
      await request(t.server)
        .post('/api/v1/workflows/sales/route-lead/instances')
        .set(viewer)
        .send({ input: {} })
        .expect(403);

      for (const action of ['cancel', 'suspend', 'resume', 'restart'])
        await request(t.server)
          .post(`/api/v1/instances/${id}/${action}`)
          .set(viewer)
          .expect(403);

      await request(t.server)
        .delete(`/api/v1/instances/${id}`)
        .set(viewer)
        .expect(403);
      const instance = await instanceOf(t, viewer, id);
      const list = await request(t.server)
        .get('/api/v1/instances')
        .set(viewer)
        .expect(200);

      expect(instance.phase).toBe('completed');
      expect(list.body.items).toHaveLength(1);
    });

    it('an_administrator_starts_and_controls_instances', async () => {
      await createUser(t, { email: 'admin@example.com', role: Role.Admin });
      const admin = authHeaders(await signIn(t.server, 'admin@example.com'));
      await publish(t, editor, aDocument());

      const started = await start(t, admin);
      await request(t.server)
        .post(`/api/v1/instances/${started.id}/cancel`)
        .set(admin)
        .expect(204);
    });

    it('without_a_session_nothing_is_answered', async () => {
      await publish(t, editor, aDocument());
      const started = await start(t, editor);
      const id = started.id;

      await request(t.server).get('/api/v1/instances').expect(401);
      await request(t.server).get(`/api/v1/instances/${id}`).expect(401);
      await request(t.server).get(`/api/v1/instances/${id}/tasks`).expect(401);
      await request(t.server)
        .post('/api/v1/workflows/sales/route-lead/instances')
        .send({ input: {} })
        .expect(401);

      for (const action of ['cancel', 'suspend', 'resume', 'restart'])
        await request(t.server)
          .post(`/api/v1/instances/${id}/${action}`)
          .expect(401);

      await request(t.server).delete(`/api/v1/instances/${id}`).expect(401);
      const instance = await instanceOf(t, viewer, id);

      expect(instance.phase).toBe('pending');
    });
  });
});
