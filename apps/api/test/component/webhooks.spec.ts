import { createHmac, randomUUID } from 'node:crypto';
import {
  ManualWorkflowClock,
  WORKFLOWS_MODULE_OPTIONS,
  WorkflowWorker,
} from '@nestjs/workflows';
import request from 'supertest';
import { Role } from '../../src/domain/enums.js';
import { authHeaders, createUser, signIn } from '../support/auth-helpers.js';
import { createTestApp, type TestApp } from '../support/create-test-app.js';
import { truncateAll } from '../support/db.js';

const HOOK = randomUUID();
const STEP = randomUUID();

describe('webhook ingress', () => {
  let t: TestApp;
  let editor: string;

  beforeAll(async () => {
    t = await createTestApp((builder) =>
      builder.overrideProvider(WORKFLOWS_MODULE_OPTIONS).useValue({
        worker: false,
        clock: new ManualWorkflowClock(Date.now()),
      }),
    );
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await truncateAll(t.db);
    await createUser(t, { email: 'editor@example.com', role: Role.Editor });
    editor = await signIn(t.server, 'editor@example.com');
  });

  const call = (method: 'get' | 'post' | 'put' | 'delete', path: string) =>
    request(t.server)[method](`/api/v1${path}`).set(authHeaders(editor));

  const active = async (authentication: 'token' | 'signature') => {
    const created = await call('post', '/workflows')
      .send({ name: 'Orders in' })
      .expect(201);
    const id = created.body.id as string;
    await call('put', `/workflows/${id}/draft`)
      .send({
        revision: 1,
        graph: {
          nodes: [
            {
              id: HOOK,
              name: 'Hook',
              type: 'webhook',
              typeVersion: 1,
              parameters: {
                methods: { fixed: ['POST', 'PUT'] },
                authentication: { fixed: authentication },
              },
              position: [0, 0],
            },
            {
              id: STEP,
              name: 'Step',
              type: 'noOp',
              typeVersion: 1,
              position: [200, 0],
            },
          ],
          connections: [
            {
              from: { node: HOOK, output: 'main' },
              to: { node: STEP, input: 'main' },
            },
          ],
        },
        settings: {},
      })
      .expect(200);
    await call('post', `/workflows/${id}/releases`)
      .send({ revision: 2 })
      .expect(201);
    await call('put', `/workflows/${id}/activation`)
      .send({ release: 1 })
      .expect(200);
    const endpoints = await call('get', `/workflows/${id}/webhooks`).expect(
      200,
    );
    const [endpoint] = endpoints.body.items as {
      url: string;
      secret: string;
    }[];
    return {
      id,
      path: new URL(endpoint!.url).pathname,
      secret: endpoint!.secret,
    };
  };

  it('an_authenticated_delivery_starts_a_run_of_the_active_release_with_the_request', async () => {
    const { id, path, secret } = await active('token');
    const accepted = await request(t.server)
      .post(`${path}?source=shop`)
      .set('x-webhook-token', secret)
      .set('x-delivery-id', 'delivery-1')
      .send({ order: 7 })
      .expect(202);
    await t.app.get(WorkflowWorker).drain();
    const run = await call('get', `/runs/${accepted.body.runId}`).expect(200);
    expect(run.body).toMatchObject({
      workflowId: id,
      status: 'succeeded',
      mode: 'production',
      trigger: 'webhook',
      release: 1,
    });
    const output = await call(
      'get',
      `/runs/${accepted.body.runId}/steps/${HOOK}/output`,
    ).expect(200);
    const [item] = output.body.items;
    expect(item).toMatchObject({
      method: 'POST',
      query: { source: 'shop' },
      body: { order: 7 },
      headers: {
        'content-type': 'application/json',
        'x-delivery-id': 'delivery-1',
      },
    });
    expect(item.headers['x-webhook-token']).toBeUndefined();
  });

  it('every_refusal_gets_the_same_not_found_answer', async () => {
    const { id, path, secret } = await active('token');
    const refusals = [
      request(t.server).post(path).set('x-webhook-token', 'wrong').send({}),
      request(t.server).post(path).send({}),
      request(t.server).get(path).set('x-webhook-token', secret),
      request(t.server)
        .post(`/api/v1/webhooks/${'x'.repeat(43)}`)
        .set('x-webhook-token', secret)
        .send({}),
      request(t.server)
        .post('/api/v1/webhooks/short')
        .set('x-webhook-token', secret)
        .send({}),
    ];
    const answers = await Promise.all(refusals);
    await call('delete', `/workflows/${id}/activation`).expect(204);
    answers.push(
      await request(t.server)
        .post(path)
        .set('x-webhook-token', secret)
        .send({}),
    );

    for (const answer of answers) {
      expect(answer.status).toBe(404);
      expect(answer.body).toEqual({ statusCode: 404, message: 'Not Found' });
    }
  });

  it('a_repeated_delivery_gets_the_first_answer_and_a_changed_one_is_refused', async () => {
    const { path, secret } = await active('token');
    const deliver = (body: object) =>
      request(t.server)
        .post(path)
        .set('x-webhook-token', secret)
        .set('x-delivery-id', 'delivery-1')
        .send(body);
    const first = await deliver({ order: 7 }).expect(202);
    const again = await deliver({ order: 7 }).expect(202);
    expect(again.body.runId).toBe(first.body.runId);
    expect(again.headers['idempotent-replayed']).toBe('true');
    await deliver({ order: 8 }).expect(422);
    const other = await request(t.server)
      .post(path)
      .set('x-webhook-token', secret)
      .send({ order: 7 })
      .expect(202);
    expect(other.body.runId).not.toBe(first.body.runId);
  });

  it('a_signed_delivery_passes_only_with_a_fresh_signature_of_its_raw_body', async () => {
    const { path, secret } = await active('signature');
    const body = 'plain text order 7';
    const sign = (timestamp: number) =>
      `sha256=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;
    const now = Math.floor(Date.now() / 1000);
    await request(t.server)
      .put(path)
      .set('content-type', 'text/plain')
      .set('x-webhook-timestamp', String(now))
      .set('x-webhook-signature', sign(now))
      .send(body)
      .expect(202);
    await request(t.server)
      .put(path)
      .set('content-type', 'text/plain')
      .set('x-webhook-timestamp', String(now - 600))
      .set('x-webhook-signature', sign(now - 600))
      .send(body)
      .expect(404);
  });

  it('an_authenticated_body_above_one_megabyte_or_nested_too_deep_is_refused', async () => {
    const { path, secret } = await active('token');
    await request(t.server)
      .post(path)
      .set('x-webhook-token', secret)
      .send({ blob: 'x'.repeat(1024 * 1024) })
      .expect(413);
    let deep: Record<string, unknown> = {};

    for (let level = 0; level < 70; level++) deep = { next: deep };

    await request(t.server)
      .post(path)
      .set('x-webhook-token', secret)
      .send(deep)
      .expect(400);
  });
});
